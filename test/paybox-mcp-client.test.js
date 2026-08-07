import test from "node:test";
import assert from "node:assert/strict";
import * as clientModule from "../src/paybox-mcp-client.js";
import {
  PAYBOX_MCP_PROTOCOL,
  closePayboxMcpSession,
  discoverAuthenticatedPayboxTools,
  parseMcpBody,
} from "../src/paybox-mcp-client.js";

function jsonRpcResponse(value, headers = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sessionToken() {
  return ["paybox", "session", "fixture", "z".repeat(32)].join("-");
}

function cancellableResponse({
  status,
  body = '{"error":"fixture"}',
  headers = { "content-type": "application/json" },
}) {
  let cancelled = false;
  const bytes = new TextEncoder().encode(body);
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
      },
      cancel() {
        cancelled = true;
      },
    }),
    { status, headers },
  );
  return { response, wasCancelled: () => cancelled };
}

test("authenticated client exposes discovery but structurally no tools/call", () => {
  assert.equal(Object.hasOwn(clientModule, "callTool"), false);
  assert.equal(Object.hasOwn(clientModule, "callPayboxTool"), false);
});

test("initializes, paginates tools/list, and returns a redacted authenticated snapshot", async () => {
  const token = sessionToken();
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    const body = options.body ? JSON.parse(options.body) : null;
    if (body?.method === "initialize") {
      return jsonRpcResponse(
        {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: PAYBOX_MCP_PROTOCOL,
            capabilities: { tools: {} },
            serverInfo: { name: "paybox", version: "fixture" },
          },
        },
        { "mcp-session-id": "opaque-session-fixture" },
      );
    }
    if (body?.method === "notifications/initialized") {
      return new Response(null, { status: 202 });
    }
    if (body?.method === "tools/list" && body.params.cursor === undefined) {
      return jsonRpcResponse({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "list_credentials",
              description: "List granted credential display metadata.",
              inputSchema: { type: "object", properties: {} },
            },
          ],
          nextCursor: "page-two",
        },
      });
    }
    return jsonRpcResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        tools: [
          {
            name: "request_payment",
            description: "Request a one-time payment card.",
            inputSchema: {
              type: "object",
              properties: {
                credential_id: { type: "string" },
                amount_cents: { type: "integer" },
              },
            },
          },
        ],
      },
    });
  };

  const { snapshot, sessionId } = await discoverAuthenticatedPayboxTools({
    accessToken: token,
    fetchImpl,
  });
  assert.equal(sessionId, "opaque-session-fixture");
  assert.equal(snapshot.source.provider_authenticated, true);
  assert.equal(snapshot.source.resource, "https://api.paybox.sh/mcp");
  assert.equal(snapshot.tool_count, 2);
  assert.equal(snapshot.tools[0].name, "list_credentials");
  assert.equal(snapshot.tools[1].name, "request_payment");
  assert.equal(snapshot.tools[1].requires_mandate_gate, true);
  assert.ok(requests.every((request) => request.redirect === "error"));
  assert.ok(
    requests.every(
      (request) => request.headers.authorization === `Bearer ${token}`,
    ),
  );
  assert.equal(JSON.stringify(snapshot).includes(token), false);
  assert.equal(JSON.stringify(snapshot).includes(sessionId), false);
});

test("parses matching JSON and SSE responses but rejects ID confusion", () => {
  assert.deepEqual(
    parseMcpBody(
      JSON.stringify({ jsonrpc: "2.0", id: 4, result: { ok: true } }),
      "application/json",
      4,
    ).result,
    { ok: true },
  );
  const sse = [
    "event: message",
    'data: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}',
    "",
  ].join("\n");
  assert.deepEqual(parseMcpBody(sse, "text/event-stream", 7).result, { ok: true });
  assert.throws(
    () => parseMcpBody(sse, "text/event-stream", 8),
    (error) => error.code === "PAYBOX_MCP_RESPONSE_INVALID",
  );
});

test("401 terminates discovery without retry and never reflects the token", async () => {
  const token = sessionToken();
  let requests = 0;
  let rejected;
  const tracked = cancellableResponse({ status: 401 });
  try {
    await discoverAuthenticatedPayboxTools({
      accessToken: token,
      fetchImpl: async () => {
        requests += 1;
        return tracked.response;
      },
    });
  } catch (error) {
    rejected = error;
  }
  assert.equal(requests, 1);
  assert.equal(rejected.code, "PAYBOX_OAUTH_EXPIRED");
  assert.equal(rejected.message.includes(token), false);
  assert.equal(tracked.wasCancelled(), true);
});

test("malformed initialize responses with a session header are cleaned up", async () => {
  const methods = [];
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        if (options.method === "DELETE") return new Response(null, { status: 204 });
        return new Response("not-json", {
          status: 200,
          headers: {
            "content-type": "application/json",
            "mcp-session-id": "malformed-initialize-session",
          },
        });
      },
    }),
    (error) => error.code === "PAYBOX_MCP_RESPONSE_INVALID",
  );
  assert.deepEqual(methods, ["POST", "DELETE"]);
});

test("rejects non-ASCII MCP session identifiers", async () => {
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        return jsonRpcResponse(
          {
            jsonrpc: "2.0",
            id: body.id,
            result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
          },
          { "mcp-session-id": "opaque-sessión" },
        );
      },
    }),
    (error) => error.code === "PAYBOX_MCP_SESSION_INVALID",
  );
});

test("malformed provider catalogs fail generically without exposing raw tool names", async () => {
  const rawToolName = "provider raw name must not escape";
  let rejected;
  try {
    await discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        if (options.method === "DELETE") return new Response(null, { status: 204 });
        const body = JSON.parse(options.body);
        if (body.method === "initialize") {
          return jsonRpcResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
            },
            { "mcp-session-id": "catalog-session" },
          );
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        return jsonRpcResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [{ name: rawToolName, inputSchema: {}, outputSchema: {} }],
          },
        });
      },
    });
  } catch (error) {
    rejected = error;
  }
  assert.equal(rejected.code, "PAYBOX_MCP_TOOLS_INVALID");
  assert.equal(rejected.message.includes(rawToolName), false);
  assert.equal(String(rejected).includes(rawToolName), false);
});

test("exact reflected access-token and session text is rejected without persistence", async () => {
  const token = sessionToken();
  const sessionId = "exact-reflected-session";
  let rejected;
  try {
    await discoverAuthenticatedPayboxTools({
      accessToken: token,
      fetchImpl: async (_url, options) => {
        if (options.method === "DELETE") return new Response(null, { status: 204 });
        const body = JSON.parse(options.body);
        if (body.method === "initialize") {
          return jsonRpcResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
            },
            { "mcp-session-id": sessionId },
          );
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        return jsonRpcResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [
              {
                name: "get_reflected_values",
                description: `Provider reflected ${token} and ${sessionId}`,
                inputSchema: {
                  type: "object",
                  description: token,
                  properties: {
                    value: { type: "string", default: sessionId },
                  },
                },
                outputSchema: {
                  type: "object",
                  properties: {
                    value: {
                      type: "string",
                      description: `${sessionId}:${token}`,
                    },
                  },
                },
              },
            ],
          },
        });
      },
    });
  } catch (error) {
    rejected = error;
  }

  assert.equal(rejected.code, "PAYBOX_MCP_TOOLS_INVALID");
  assert.equal(rejected.message.includes(token), false);
  assert.equal(rejected.message.includes(sessionId), false);
  assert.equal(String(rejected).includes(token), false);
  assert.equal(String(rejected).includes(sessionId), false);
});

test("remote MCP session deletion cancels an unused response body", async () => {
  const tracked = cancellableResponse({ status: 200, body: "unused" });
  const result = await closePayboxMcpSession({
    accessToken: sessionToken(),
    sessionId: "cleanup-response-session",
    fetchImpl: async () => tracked.response,
  });
  assert.equal(result.attempted, true);
  assert.equal(tracked.wasCancelled(), true);
});

test("rejects repeated pagination cursors and duplicate tool names", async () => {
  let requestCount = 0;
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        requestCount += 1;
        const body = JSON.parse(options.body);
        if (body.method === "initialize") {
          return jsonRpcResponse({
            jsonrpc: "2.0",
            id: body.id,
            result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
          });
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        return jsonRpcResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [{ name: `tool_${requestCount}`, inputSchema: {} }],
            nextCursor: "repeat",
          },
        });
      },
    }),
    (error) => error.code === "PAYBOX_MCP_CURSOR_INVALID",
  );
});

test("cleans up the initialized session when tools discovery fails", async () => {
  const methods = [];
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        if (options.method === "DELETE") return new Response(null, { status: 204 });
        const body = JSON.parse(options.body);
        if (body.method === "initialize") {
          return jsonRpcResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
            },
            { "mcp-session-id": "cleanup-session" },
          );
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        return new Response('{"jsonrpc":"2.0"}', {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    }),
    (error) => error.code === "PAYBOX_MCP_CONTENT_TYPE_INVALID",
  );
  assert.deepEqual(methods, ["POST", "POST", "POST", "DELETE"]);
});

test("rejects notification response bodies, missing media types, and session drift", async () => {
  const run = async (mode) =>
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        if (options.method === "DELETE") return new Response(null, { status: 204 });
        const body = JSON.parse(options.body);
        if (body.method === "initialize") {
          return jsonRpcResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
            },
            { "mcp-session-id": "stable-session" },
          );
        }
        if (body.method === "notifications/initialized") {
          if (mode === "notification-body") {
            return jsonRpcResponse({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32603, message: "failed" },
            });
          }
          return new Response(null, { status: 202 });
        }
        const payload = JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [] },
        });
        if (mode === "missing-content-type") {
          return new Response(payload, { status: 200 });
        }
        return new Response(payload, {
          status: 200,
          headers: {
            "content-type": "application/json",
            "mcp-session-id": "changed-session",
          },
        });
      },
    });

  await assert.rejects(
    run("notification-body"),
    (error) => error.code === "PAYBOX_MCP_NOTIFICATION_INVALID",
  );
  await assert.rejects(
    run("missing-content-type"),
    (error) => error.code === "PAYBOX_MCP_CONTENT_TYPE_INVALID",
  );
  await assert.rejects(
    run("session-drift"),
    (error) => error.code === "PAYBOX_MCP_SESSION_CHANGED",
  );
});

test("rejects protocol mismatch and 403 grants without retry", async () => {
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        return jsonRpcResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: { protocolVersion: "2024-11-05" },
        });
      },
    }),
    (error) => error.code === "PAYBOX_MCP_PROTOCOL_INVALID",
  );

  let requests = 0;
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async () => {
        requests += 1;
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      },
    }),
    (error) => error.code === "PAYBOX_PERMISSION_DENIED",
  );
  assert.equal(requests, 1);
});

test("caps tools/list pagination and cleans up the session", async () => {
  let listPages = 0;
  let deletes = 0;
  await assert.rejects(
    discoverAuthenticatedPayboxTools({
      accessToken: sessionToken(),
      fetchImpl: async (_url, options) => {
        if (options.method === "DELETE") {
          deletes += 1;
          return new Response(null, { status: 204 });
        }
        const body = JSON.parse(options.body);
        if (body.method === "initialize") {
          return jsonRpcResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              result: { protocolVersion: PAYBOX_MCP_PROTOCOL },
            },
            { "mcp-session-id": "page-limit-session" },
          );
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        listPages += 1;
        return jsonRpcResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [{ name: `get_page_${listPages}`, outputSchema: { type: "object" } }],
            nextCursor: `page-${listPages + 1}`,
          },
        });
      },
    }),
    (error) => error.code === "PAYBOX_MCP_PAGE_LIMIT",
  );
  assert.equal(listPages, 8);
  assert.equal(deletes, 1);
});

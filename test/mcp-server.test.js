import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildCardDemoEvidence, buildCardDemoIntent } from "../src/card/fixtures.js";
import { createCardPlan } from "../src/card/policy.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER = path.join(ROOT, "src", "mcp-server.js");

test("modern MCP discovery, deterministic tools, and card call work", async () => {
  const responses = await exchange([
    modernRequest("discover", "server/discover", {}),
    modernRequest("list", "tools/list", {}),
    modernRequest("call", "tools/call", {
      name: "protected_paybox_card_demo",
      arguments: { merchant: "doordash", scenario: "block-total" },
    }),
  ]);
  assert.deepEqual(responses[0].result.supportedVersions, ["2026-07-28"]);
  assert.equal(responses[1].result.resultType, "complete");
  const evaluateTool = responses[1].result.tools.find(
    (tool) => tool.name === "protected_paybox_card_evaluate",
  );
  assert.equal(evaluateTool.annotations.readOnlyHint, false);
  assert.equal(evaluateTool.annotations.idempotentHint, true);
  const names = responses[1].result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [...names].sort((left, right) => {
    const order = [
      "protected_paybox_capabilities",
      "protected_paybox_card_plan",
      "protected_paybox_card_demo",
      "protected_paybox_card_evaluate",
      "protected_paybox_swap_demo",
      "protected_paybox_verify_record",
    ];
    return order.indexOf(left) - order.indexOf(right);
  }));
  assert.equal(responses[2].result.structuredContent.outcome, "BLOCK");
  assert.equal(responses[2].result.resultType, "complete");
  assert.equal(responses[2].result.structuredContent.code, "CARD_TOTAL_EXCEEDED");
  assert.equal(
    responses[2].result.structuredContent.authorization_mode,
    "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION",
  );
  assert.match(
    responses[2].result.content[0].text,
    /NO CARD CREATED OR AUTHORIZED/,
  );
});

test("legacy initialize and tools/list remain compatible", async () => {
  const responses = await exchange([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "legacy-test", version: "1" },
      },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "protected_paybox_card_demo",
        arguments: { merchant: "doordash", scenario: "block-total" },
      },
    },
  ]);
  assert.equal(responses[0].result.protocolVersion, "2025-11-25");
  assert.ok(Array.isArray(responses[1].result.tools));
  assert.equal("resultType" in responses[1].result, false);
  assert.equal("resultType" in responses[2].result, false);
  assert.equal(responses[2].result.structuredContent.outcome, "BLOCK");
});

test("modern metadata remains stateless after a legacy initialize", async () => {
  const responses = await exchange([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "legacy-test", version: "1" },
      },
    },
    modernRequest("modern-list", "tools/list", {}),
  ]);
  assert.equal(responses[1].result.resultType, "complete");
});

test("unsupported protocol versions fail instead of falling through to legacy", async () => {
  const responses = await exchange([
    modernRequest("unsupported-modern", "tools/list", {}, "1900-01-01"),
    {
      jsonrpc: "2.0",
      id: "unsupported-initialize",
      method: "initialize",
      params: {
        protocolVersion: "1900-01-01",
        capabilities: {},
        clientInfo: { name: "legacy-test", version: "1" },
      },
    },
  ]);
  for (const response of responses) {
    assert.equal(response.error.code, -32022);
    assert.equal(response.error.message, "Unsupported protocol version");
    assert.deepEqual(response.error.data, {
      supported: ["2026-07-28", "2025-11-25", "2025-06-18"],
      requested: "1900-01-01",
    });
  }
});

test("MCP card evaluation durably blocks a second PASS nonce by default", async () => {
  const stateRoot = await mkdtemp(path.join(tmpdir(), "protected-paybox-mcp-state-"));
  try {
    const now = new Date();
    const plan = createCardPlan(buildCardDemoIntent(), {
      now,
      id: `mcp-durable-${now.getTime()}`,
    });
    const evidence = buildCardDemoEvidence(plan, { now });
    const common = {
      name: "protected_paybox_card_evaluate",
      arguments: {
        plan,
        evidence,
        confirmation_digest: plan.policy_digest,
        nonce: "mcp-durable-nonce-0001",
      },
    };
    const responses = await exchange(
      [
        modernRequest("first", "tools/call", common),
        modernRequest("second", "tools/call", {
          ...common,
          arguments: { ...common.arguments, nonce: "mcp-durable-nonce-0002" },
        }),
      ],
      { PROTECTED_PAYBOX_STATE_ROOT: stateRoot },
    );
    const decisions = responses.map((response) => response.result.structuredContent);
    assert.deepEqual(
      decisions.map((decision) => decision.outcome).sort(),
      ["BLOCK", "PASS"],
    );
    assert.equal(
      decisions.find((decision) => decision.outcome === "BLOCK").code,
      "PLAN_ALREADY_USED",
    );
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
  }
});

test("MCP one-use state converges across separate server processes", async () => {
  const stateRoot = await mkdtemp(path.join(tmpdir(), "protected-paybox-mcp-cross-"));
  try {
    const now = new Date();
    const plan = createCardPlan(buildCardDemoIntent(), {
      now,
      id: `mcp-cross-process-${now.getTime()}`,
    });
    const evidence = buildCardDemoEvidence(plan, { now });
    const request = (id, nonce) =>
      modernRequest(id, "tools/call", {
        name: "protected_paybox_card_evaluate",
        arguments: {
          plan,
          evidence,
          confirmation_digest: plan.policy_digest,
          nonce,
        },
      });
    const results = await Promise.all([
      exchange([request("process-a", "mcp-cross-process-nonce-01")], {
        PROTECTED_PAYBOX_STATE_ROOT: stateRoot,
      }),
      exchange([request("process-b", "mcp-cross-process-nonce-02")], {
        PROTECTED_PAYBOX_STATE_ROOT: stateRoot,
      }),
    ]);
    const decisions = results.flat().map(
      (response) => response.result.structuredContent,
    );
    assert.deepEqual(
      decisions.map((decision) => decision.outcome).sort(),
      ["BLOCK", "PASS"],
    );
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
  }
});

test("MCP rejects raw credential-shaped arguments before evaluation", async () => {
  const [response] = await exchange([
    modernRequest("secret", "tools/call", {
      name: "protected_paybox_card_plan",
      arguments: { intent: { card_number: "4111111111111111" } },
    }),
  ]);
  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /Sensitive credential field is prohibited/);
  assert.doesNotMatch(JSON.stringify(response), /4111111111111111/);
});

test("MCP rejects secret aliases and credential values without echoing them", async () => {
  const password = "correct-horse-battery-staple";
  const pan = "4111111111111111";
  const bearer = `${"Bea"}${"rer"} ${"a".repeat(32)}`;
  const responses = await exchange([
    modernRequest("password", "tools/call", {
      name: "protected_paybox_card_plan",
      arguments: { intent: { password } },
    }),
    modernRequest("pan-value", "tools/call", {
      name: "protected_paybox_card_plan",
      arguments: { intent: { title: `demo ${pan}` } },
    }),
    modernRequest("bearer-value", "tools/call", {
      name: "protected_paybox_card_plan",
      arguments: { intent: { note: bearer } },
    }),
  ]);
  for (const response of responses) assert.equal(response.error.code, -32602);
  const serialized = JSON.stringify(responses);
  assert.doesNotMatch(serialized, new RegExp(password));
  assert.doesNotMatch(serialized, new RegExp(pan));
  assert.doesNotMatch(serialized, /abcdefghijklmnopqrstuvwxyz123456/);
});

test("MCP rejects credential-shaped property names without echoing them", async () => {
  const panKey = ["4111", "1111", "1111", "1111"].join("");
  const [response] = await exchange([
    modernRequest("pan-key", "tools/call", {
      name: "protected_paybox_card_plan",
      arguments: { intent: { [panKey]: "fixture" } },
    }),
  ]);
  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /credential-shaped property name/);
  assert.equal(JSON.stringify(response).includes(panKey), false);
});

test("MCP distinguishes unknown methods from invalid tool parameters", async () => {
  const responses = await exchange([
    modernRequest("unknown", "unknown/method", {}),
    modernRequest("invalid", "tools/call", {
      name: "protected_paybox_card_demo",
      arguments: { unexpected: true },
    }),
  ]);
  const byId = new Map(responses.map((response) => [response.id, response]));
  const unknown = byId.get("unknown");
  const invalid = byId.get("invalid");
  assert.equal(unknown.error.code, -32601);
  assert.equal(invalid.error.code, -32602);
});

function modernRequest(id, method, params, protocolVersion = "2026-07-28") {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: {
      ...params,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": protocolVersion,
        "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

function exchange(messages, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        assert.equal(code, 0, stderr);
        const lines = stdout.trim().split("\n").filter(Boolean);
        assert.equal(lines.length, messages.length, stdout);
        resolve(lines.map((line) => JSON.parse(line)));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(`${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
  });
}

import { GuardError } from "./errors.js";
import { VERSION } from "./constants.js";
import { buildPayboxToolSnapshot } from "./paybox-discovery.js";
import { cancelResponseBody, readBoundedUtf8 } from "./http-body.js";
import { PAYBOX_OAUTH } from "./paybox-oauth.js";

export const PAYBOX_MCP_PROTOCOL = "2025-06-18";

const MAX_RESPONSE_BYTES = 1_048_576;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PAGES = 8;
const MAX_CURSOR_LENGTH = 1_024;

/**
 * Authenticated capability discovery only. This module intentionally has no
 * tools/call implementation.
 */
export async function discoverAuthenticatedPayboxTools({
  accessToken,
  fetchImpl = globalThis.fetch,
  signal = undefined,
} = {}) {
  assertAccessToken(accessToken);
  if (typeof fetchImpl !== "function") {
    throw clientError("PAYBOX_CLIENT_INVALID", "A fetch implementation is required.");
  }

  let requestId = 1;
  let initialized;
  try {
    initialized = await postMcp({
      accessToken,
      fetchImpl,
      signal,
      request: {
        jsonrpc: "2.0",
        id: requestId,
        method: "initialize",
        params: {
          protocolVersion: PAYBOX_MCP_PROTOCOL,
          capabilities: {},
          clientInfo: { name: "protected-paybox", version: VERSION },
        },
      },
    });
  } catch (error) {
    const failedSessionId = error?.payboxSessionId;
    if (failedSessionId) {
      await closePayboxMcpSession({
        accessToken,
        sessionId: failedSessionId,
        fetchImpl,
      });
    }
    throw error;
  }
  const negotiated = initialized.message?.result?.protocolVersion;
  const sessionId = validateSessionId(initialized.sessionId);
  if (negotiated !== PAYBOX_MCP_PROTOCOL) {
    await closePayboxMcpSession({ accessToken, sessionId, fetchImpl });
    throw clientError(
      "PAYBOX_MCP_PROTOCOL_INVALID",
      "PayBox negotiated an unsupported MCP protocol version.",
    );
  }
  try {
    await postMcp({
      accessToken,
      fetchImpl,
      signal,
      sessionId,
      request: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      notification: true,
    });

    const tools = [];
    const seenCursors = new Set();
    let cursor;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      requestId += 1;
      const response = await postMcp({
        accessToken,
        fetchImpl,
        signal,
        sessionId,
        request: {
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: cursor === undefined ? {} : { cursor },
        },
      });
      const result = response.message?.result;
      if (!result || !Array.isArray(result.tools)) {
        throw clientError(
          "PAYBOX_MCP_TOOLS_INVALID",
          "PayBox returned an invalid tools/list response.",
        );
      }
      tools.push(...result.tools);
      const next = result.nextCursor;
      if (next === undefined || next === null || next === "") {
        let snapshot;
        try {
          snapshot = buildPayboxToolSnapshot(
            { tools },
            {
              providerAuthenticated: true,
              resource: PAYBOX_OAUTH.resource,
              protocolVersion: PAYBOX_MCP_PROTOCOL,
              observedAt: new Date().toISOString(),
              sensitiveValues: [accessToken, sessionId].filter(Boolean),
            },
          );
        } catch {
          throw clientError(
            "PAYBOX_MCP_TOOLS_INVALID",
            "PayBox returned an invalid authenticated tools catalog.",
          );
        }
        return { snapshot, sessionId };
      }
      if (
        typeof next !== "string" ||
        next.length > MAX_CURSOR_LENGTH ||
        /[\x00-\x1f\x7f]/.test(next) ||
        seenCursors.has(next)
      ) {
        throw clientError(
          "PAYBOX_MCP_CURSOR_INVALID",
          "PayBox returned an invalid or repeated tools cursor.",
        );
      }
      seenCursors.add(next);
      cursor = next;
    }
    throw clientError(
      "PAYBOX_MCP_PAGE_LIMIT",
      "PayBox tools/list exceeded the pagination limit.",
    );
  } catch (error) {
    await closePayboxMcpSession({
      accessToken,
      sessionId,
      fetchImpl,
    });
    throw error;
  }
}

export async function closePayboxMcpSession({
  accessToken,
  sessionId,
  fetchImpl = globalThis.fetch,
  signal = undefined,
} = {}) {
  if (!sessionId) return { attempted: false };
  assertAccessToken(accessToken);
  validateSessionId(sessionId);
  try {
    const response = await request(fetchImpl, PAYBOX_OAUTH.resource, {
      method: "DELETE",
      headers: mcpHeaders(accessToken, sessionId),
      signal,
    });
    await cancelResponseBody(response);
  } catch {
    // Local credential destruction must not depend on optional remote cleanup.
  }
  return { attempted: true };
}

async function postMcp({
  accessToken,
  fetchImpl,
  request: message,
  sessionId,
  notification = false,
  signal,
}) {
  const response = await request(fetchImpl, PAYBOX_OAUTH.resource, {
    method: "POST",
    headers: mcpHeaders(accessToken, sessionId),
    body: JSON.stringify(message),
    signal,
  });
  let responseSession;
  try {
    responseSession = resolveResponseSessionId(response, sessionId);
  } catch (error) {
    await cancelResponseBody(response);
    throw error;
  }
  if (response.status === 401) {
    await cancelResponseBody(response);
    throw attachCleanupSession(
      clientError(
        "PAYBOX_OAUTH_EXPIRED",
        "PayBox rejected the session token; reconnect to continue.",
      ),
      sessionId === undefined ? responseSession : null,
    );
  }
  if (response.status === 403) {
    await cancelResponseBody(response);
    throw attachCleanupSession(
      clientError(
        "PAYBOX_PERMISSION_DENIED",
        "The PayBox grant does not permit authenticated discovery.",
      ),
      sessionId === undefined ? responseSession : null,
    );
  }
  if (notification && [200, 202, 204].includes(response.status)) {
    const body = await readBoundedText(response);
    if (response.status !== 202 || body !== "") {
      throw clientError(
        "PAYBOX_MCP_NOTIFICATION_INVALID",
        "PayBox returned an invalid initialized-notification response.",
      );
    }
    return { message: null, sessionId: responseSession };
  }
  if (response.status !== 200) {
    await cancelResponseBody(response);
    throw attachCleanupSession(
      clientError(
        "PAYBOX_MCP_REQUEST_FAILED",
        `PayBox MCP request failed with HTTP ${response.status}.`,
      ),
      sessionId === undefined ? responseSession : null,
    );
  }
  try {
    const mediaType = responseMediaType(response);
    const body = await readBoundedText(response);
    const parsed = parseMcpBody(body, mediaType, message.id);
    if (parsed.error) {
      throw clientError(
        "PAYBOX_MCP_ERROR_RESPONSE",
        "PayBox returned an MCP error during authenticated discovery.",
      );
    }
    return { message: parsed, sessionId: responseSession };
  } catch (error) {
    await cancelResponseBody(response);
    throw attachCleanupSession(
      error,
      sessionId === undefined ? responseSession : null,
    );
  }
}

function mcpHeaders(accessToken, sessionId) {
  const headers = {
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "mcp-protocol-version": PAYBOX_MCP_PROTOCOL,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  return headers;
}

async function request(fetchImpl, url, options) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      redirect: "error",
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw clientError(
      "PAYBOX_NETWORK_ERROR",
      "PayBox MCP request failed before a response was received.",
    );
  }
  return response;
}

async function readBoundedText(response) {
  return readBoundedUtf8(response, {
    maxBytes: MAX_RESPONSE_BYTES,
    invalidCode: "PAYBOX_RESPONSE_INVALID",
    tooLargeCode: "PAYBOX_RESPONSE_TOO_LARGE",
    label: "PayBox response",
  });
}

export function parseMcpBody(body, contentType, expectedId) {
  let candidates;
  if (contentType === "text/event-stream") {
    candidates = [];
    let dataLines = [];
    for (const line of body.split(/\r?\n/)) {
      if (line === "") {
        if (dataLines.length > 0) {
          candidates.push(dataLines.join("\n"));
          dataLines = [];
        }
        continue;
      }
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length > 0) candidates.push(dataLines.join("\n"));
  } else {
    candidates = [body];
  }

  for (const candidate of candidates) {
    let value;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (
      value &&
      value.jsonrpc === "2.0" &&
      Object.hasOwn(value, "id") &&
      value.id === expectedId &&
      (Object.hasOwn(value, "result") || Object.hasOwn(value, "error"))
    ) {
      return value;
    }
  }
  throw clientError(
    "PAYBOX_MCP_RESPONSE_INVALID",
    "PayBox returned no matching JSON-RPC response.",
  );
}

function responseMediaType(response) {
  const value = response.headers.get("content-type");
  if (typeof value !== "string") {
    throw clientError(
      "PAYBOX_MCP_CONTENT_TYPE_INVALID",
      "PayBox returned no MCP response content type.",
    );
  }
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json" && mediaType !== "text/event-stream") {
    throw clientError(
      "PAYBOX_MCP_CONTENT_TYPE_INVALID",
      "PayBox returned an unsupported MCP response content type.",
    );
  }
  return mediaType;
}

function resolveResponseSessionId(response, expected) {
  const header = response.headers.get("mcp-session-id");
  if (expected === undefined) return validateSessionId(header);
  if (header === null) return expected ?? null;
  const actual = validateSessionId(header);
  if (expected === null || expected === undefined || actual !== expected) {
    throw clientError(
      "PAYBOX_MCP_SESSION_CHANGED",
      "PayBox changed the MCP session identifier unexpectedly.",
    );
  }
  return expected;
}

function validateSessionId(value) {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw clientError(
      "PAYBOX_MCP_SESSION_INVALID",
      "PayBox returned an invalid MCP session identifier.",
    );
  }
  return value;
}

function assertAccessToken(value) {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > 16_384 ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw clientError(
      "PAYBOX_OAUTH_REQUIRED",
      "A valid in-memory PayBox session is required.",
    );
  }
}

function clientError(code, message) {
  return new GuardError(code, message);
}

function attachCleanupSession(error, sessionId) {
  if (
    sessionId &&
    error &&
    (typeof error === "object" || typeof error === "function")
  ) {
    Object.defineProperty(error, "payboxSessionId", {
      value: sessionId,
      enumerable: false,
      configurable: true,
    });
  }
  return error;
}

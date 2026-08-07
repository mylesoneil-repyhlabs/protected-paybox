#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { digest } from "./canonical.js";
import { VERSION } from "./constants.js";
import { evaluateProposal } from "./evaluator.js";
import { buildDemoEvidence, buildDemoIntent } from "./fixtures.js";
import { createPlan } from "./policy.js";
import { runPreflight } from "./preflight.js";
import { verifyRecord } from "./receipt.js";
import { listRepresentativeMerchants } from "./card/catalog.js";
import { evaluateCardProposal } from "./card/evaluator.js";
import {
  buildCardDemoEvidence,
  buildCardDemoIntent,
  CARD_DEMO_SCENARIOS,
} from "./card/fixtures.js";
import { createCardPlan, formatCardMandate } from "./card/policy.js";
import { rejectSensitiveInput } from "./sensitive-input.js";
import { PayboxConnection } from "./paybox-connection.js";

const MODERN_PROTOCOL = "2026-07-28";
const LEGACY_PROTOCOLS = new Set(["2025-11-25", "2025-06-18"]);
const SUPPORTED_PROTOCOLS = Object.freeze([
  MODERN_PROTOCOL,
  ...LEGACY_PROTOCOLS,
]);
const MAX_MESSAGE_BYTES = 1_000_000;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SWAP_SCENARIOS = [
  "pass",
  "block-minimum-receive",
  "block-network-fee",
  "block-price-impact",
  "block-recipient",
  "review-stale",
  "review-unknown-program",
  "review-hidden-inner-call",
  "review-simulation-failed",
];
const payboxConnection = new PayboxConnection();

const TOOLS = Object.freeze([
  {
    name: "protected_paybox_capabilities",
    title: "Protected PayBox capabilities",
    description:
      "List the exact simulated card and swap surface. Never claims live PayBox or merchant coverage.",
    inputSchema: closedObject({}),
    annotations: toolAnnotations({ readOnly: true, idempotent: true }),
  },
  {
    name: "protected_paybox_connect",
    title: "Connect a PayBox account",
    description:
      "Start a session-only PayBox OAuth flow. The user signs in and grants access only on PayBox; no credential is entered into this MCP. Financial tool calls remain disabled.",
    inputSchema: closedObject({
      timeout_seconds: {
        type: "integer",
        minimum: 60,
        maximum: 600,
        default: 300,
      },
    }),
    annotations: toolAnnotations({
      readOnly: false,
      idempotent: false,
      openWorld: true,
    }),
  },
  {
    name: "protected_paybox_connection_status",
    title: "Check PayBox connection",
    description:
      "Report session-only PayBox OAuth state without returning tokens, authorization codes, session identifiers, or credential data.",
    inputSchema: closedObject({}),
    annotations: toolAnnotations({ readOnly: true, idempotent: true }),
  },
  {
    name: "protected_paybox_sync_tools",
    title: "Discover authenticated PayBox tools",
    description:
      "Fetch PayBox initialize and tools/list using the in-memory OAuth session, then return only stable aliases, name digests, classifications, risk flags, and input/output schema digests. It cannot call any remote tool.",
    inputSchema: closedObject({}),
    annotations: toolAnnotations({
      readOnly: true,
      idempotent: true,
      openWorld: true,
    }),
  },
  {
    name: "protected_paybox_disconnect",
    title: "Disconnect the local PayBox session",
    description:
      "Destroy the in-memory PayBox token and attempt best-effort remote MCP session cleanup. Server-side client revocation remains a separate PayBox action.",
    inputSchema: closedObject({}),
    annotations: toolAnnotations({ readOnly: false, idempotent: true }),
  },
  {
    name: "protected_paybox_card_plan",
    title: "Compile a card mandate",
    description:
      "Compile a closed card-purchase intent into a canonical mandate for separate user authorization. Does not contact PayBox or a merchant.",
    inputSchema: closedObject(
      { intent: { type: "object", description: "Card intent matching the bundled closed schema." } },
      ["intent"],
    ),
    annotations: toolAnnotations({ readOnly: true, idempotent: false }),
  },
  {
    name: "protected_paybox_card_demo",
    title: "Run a card-protection fixture",
    description:
      "Run a labeled merchant checkout fixture and return PASS, BLOCK, or REVIEW with a local checksum record.",
    inputSchema: closedObject({
      merchant: {
        type: "string",
        enum: listRepresentativeMerchants().map((entry) => entry.key),
        default: "doordash",
      },
      scenario: { type: "string", enum: CARD_DEMO_SCENARIOS, default: "pass" },
    }),
    annotations: toolAnnotations({ readOnly: true, idempotent: false }),
  },
  {
    name: "protected_paybox_card_evaluate",
    title: "Evaluate exact card evidence",
    description:
      "Evaluate a separately authorized card plan against a closed offline evidence bundle. Live evidence and credential release remain unavailable.",
    inputSchema: closedObject(
      {
        plan: { type: "object" },
        evidence: { type: "object" },
        confirmation_digest: { type: "string", pattern: "^[a-f0-9]{64}$" },
        nonce: { type: "string", minLength: 16, maxLength: 128 },
      },
      ["plan", "evidence", "confirmation_digest", "nonce"],
    ),
    annotations: toolAnnotations({ readOnly: false, idempotent: true }),
  },
  {
    name: "protected_paybox_swap_demo",
    title: "Run the legacy swap fixture",
    description:
      "Run the preserved USDC-to-SOL exact-input fixture. This remains one fixed simulated asset pair, not generalized swap coverage.",
    inputSchema: closedObject({
      scenario: { type: "string", enum: SWAP_SCENARIOS, default: "pass" },
    }),
    annotations: toolAnnotations({ readOnly: true, idempotent: false }),
  },
  {
    name: "protected_paybox_verify_record",
    title: "Verify a local record checksum",
    description:
      "Verify local record self-consistency. This is not publisher authentication or a production Delta proof.",
    inputSchema: closedObject(
      { record: { type: "object" } },
      ["record"],
    ),
    annotations: toolAnnotations({ readOnly: true, idempotent: true }),
  },
]);

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line) {
  if (Buffer.byteLength(line, "utf8") > MAX_MESSAGE_BYTES) {
    write(errorResponse(null, -32600, "MCP message exceeds the one-megabyte limit."));
    return;
  }
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    write(errorResponse(null, -32700, "Parse error"));
    return;
  }
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    write(errorResponse(request?.id ?? null, -32600, "Invalid Request"));
    return;
  }
  if (request.id === undefined) return;
  try {
    const result = await dispatch(request);
    write({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    const code = error instanceof McpError ? error.code : -32603;
    const data = error instanceof McpError ? error.data : undefined;
    write(errorResponse(request.id, code, safeErrorMessage(error), data));
  }
}

async function dispatch(request) {
  assertSupportedRequestProtocol(request);
  switch (request.method) {
    case "server/discover":
      return {
        resultType: "complete",
        supportedVersions: [MODERN_PROTOCOL],
        capabilities: { tools: { listChanged: false } },
        _meta: {
          "io.modelcontextprotocol/serverInfo": {
            name: "protected-paybox",
            version: VERSION,
          },
        },
        instructions: serverInstructions(),
        ttlMs: 300_000,
        cacheScope: "public",
      };
    case "initialize": {
      const requested = request.params?.protocolVersion;
      if (!LEGACY_PROTOCOLS.has(requested)) {
        throw unsupportedProtocolVersion(requested);
      }
      return {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "protected-paybox", version: VERSION },
        instructions: serverInstructions(),
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return isModern(request)
        ? {
            resultType: "complete",
            tools: TOOLS,
            ttlMs: 300_000,
            cacheScope: "public",
          }
        : { tools: TOOLS };
    case "tools/call":
      try {
        const result = await callTool(
          request.params?.name,
          request.params?.arguments ?? {},
        );
        return isModern(request)
          ? { resultType: "complete", ...result }
          : result;
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(-32602, safeErrorMessage(error));
      }
    default:
      throw new McpError(-32601, `Method not found: ${request.method}`);
  }
}

async function callTool(name, args) {
  rejectSensitiveInput(args, "arguments");
  let value;
  switch (name) {
    case "protected_paybox_capabilities":
      assertKeys(args, []);
      value = {
        version: VERSION,
        default_surface: "card purchase partner-evaluation fixtures",
        card_merchants: listRepresentativeMerchants(),
        card_scenarios: CARD_DEMO_SCENARIOS,
        swap_surface: "one fixed Solana USDC-to-SOL exact-input fixture",
        account_connection:
          "session-only OAuth plus authenticated tools/list discovery",
        remote_tool_calls: "structurally unavailable",
        execution: "locked",
        paybox_card_contract:
          "public docs describe request_payment and claim_payment_credentials; account exposure remains unverified until authenticated discovery",
        receipt: "unkeyed local SHA-256 self-consistency checksum",
      };
      break;
    case "protected_paybox_connect": {
      assertKeys(args, ["timeout_seconds"], true);
      const timeoutSeconds = args.timeout_seconds ?? 300;
      if (
        !Number.isInteger(timeoutSeconds) ||
        timeoutSeconds < 60 ||
        timeoutSeconds > 600
      ) {
        throw new Error("timeout_seconds must be an integer from 60 through 600.");
      }
      value = await payboxConnection.begin({
        timeoutMs: timeoutSeconds * 1_000,
      });
      break;
    }
    case "protected_paybox_connection_status":
      assertKeys(args, []);
      value = await payboxConnection.status();
      break;
    case "protected_paybox_sync_tools": {
      assertKeys(args, []);
      const result = await payboxConnection.syncTools();
      value = result.summary;
      break;
    }
    case "protected_paybox_disconnect":
      assertKeys(args, []);
      value = await payboxConnection.disconnect();
      break;
    case "protected_paybox_card_plan":
      assertKeys(args, ["intent"]);
      value = cardPlan(args.intent);
      break;
    case "protected_paybox_card_demo":
      assertKeys(args, ["merchant", "scenario"], true);
      value = await cardDemo(args.merchant ?? "doordash", args.scenario ?? "pass");
      break;
    case "protected_paybox_card_evaluate":
      assertKeys(args, ["plan", "evidence", "confirmation_digest", "nonce"]);
      value = await cardEvaluate(args);
      break;
    case "protected_paybox_swap_demo":
      assertKeys(args, ["scenario"], true);
      value = await swapDemo(args.scenario ?? "pass");
      break;
    case "protected_paybox_verify_record":
      assertKeys(args, ["record"]);
      value = verifyRecord(args.record);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
  return {
    content: [{ type: "text", text: summarizeToolResult(name, value) }],
    structuredContent: value,
    isError: false,
  };
}

function cardPlan(intent) {
  const plan = createCardPlan(intent);
  return {
    mandate: formatCardMandate(plan),
    plan,
    confirmation_workflow:
      "Ask for a separate message, then supply the exact displayed policy digest. This models confirmation but does not authenticate human authorization.",
    security_boundary:
      "The MCP cannot authenticate who authored a chat message and is not a bypass-resistant enforcement point.",
  };
}

async function cardDemo(merchant, scenario) {
  const now = new Date();
  const plan = createCardPlan(buildCardDemoIntent(merchant), {
    now,
    id: `mcp-card-${digest(`${merchant}-${scenario}-${now.toISOString()}`).slice(0, 24)}`,
  });
  const evidence = buildCardDemoEvidence(plan, { scenario, now });
  const result = await runPreflight({
    plan,
    evidence,
    confirmationDigest: plan.policy_digest,
    nonce: `mcp-card-${merchant}-${scenario}-${digest(now.toISOString()).slice(0, 24)}`,
    now,
    evaluator: evaluateCardProposal,
    authorizationMode: "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION",
  });
  return toolDecision(result);
}

async function cardEvaluate(args) {
  const historyDirectory = path.join(mcpStateRoot(), "mcp-card-history");
  const result = await runPreflight({
    plan: args.plan,
    evidence: args.evidence,
    confirmationDigest: args.confirmation_digest,
    nonce: args.nonce,
    evaluator: evaluateCardProposal,
    historyDirectory,
  });
  return {
    ...toolDecision(result),
    replay_state:
      "durable private fixture replay records enabled",
  };
}

async function swapDemo(scenario) {
  if (!SWAP_SCENARIOS.includes(scenario)) throw new Error("Unknown swap scenario.");
  const now = new Date();
  const plan = createPlan(buildDemoIntent(), {
    now,
    id: `mcp-swap-${digest(`${scenario}-${now.toISOString()}`).slice(0, 24)}`,
  });
  const evidence = buildDemoEvidence(plan, { scenario, now });
  const result = await runPreflight({
    plan,
    evidence,
    confirmationDigest: plan.policy_digest,
    nonce: `mcp-swap-${scenario}-${digest(now.toISOString()).slice(0, 24)}`,
    now,
    evaluator: evaluateProposal,
    authorizationMode: "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION",
  });
  return toolDecision(result);
}

function toolDecision(result) {
  return {
    outcome: result.record.decision.outcome,
    code: result.record.decision.code,
    reason: result.record.decision.reason,
    record: result.record,
    verification: verifyRecord(result.record),
    authorization_mode: result.record.authorization_mode,
    boundary:
      "LOCAL FIXTURE ONLY · NO PAYBOX OR MERCHANT CONTACT · NO CARD CREATED OR AUTHORIZED · NO ORDER PLACED · NO MONEY MOVED",
  };
}

function summarizeToolResult(name, value) {
  if (value?.outcome) {
    return [
      `SIMULATED ${value.outcome} — ${value.reason}`,
      value.authorization_mode === "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION"
        ? "Fixture auto-bound; no user authorization occurred."
        : "Matching digest supplied; user authorship was not authenticated.",
      value.boundary,
      "Receipt: local checksum only; not a production Delta proof.",
    ].join("\n");
  }
  if (name === "protected_paybox_card_plan") return value.mandate;
  if (name === "protected_paybox_verify_record") {
    return value.verified
      ? "VERIFIED — local checksum self-consistent; not signed."
      : `INVALID — ${value.reason}`;
  }
  return JSON.stringify(value);
}

function serverInstructions() {
  return "Card-first partner-evaluation MCP. It may connect to PayBox through session-only browser OAuth and discover authenticated tool schemas, but it cannot call any remote PayBox tool or move money. Never request PayBox/card credentials, never imply merchant coverage, and never describe a local checksum as a Delta proof.";
}

function isModern(request) {
  return request.params?._meta?.["io.modelcontextprotocol/protocolVersion"] ===
    MODERN_PROTOCOL;
}

function assertSupportedRequestProtocol(request) {
  const requested =
    request.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  if (requested !== undefined && !SUPPORTED_PROTOCOLS.includes(requested)) {
    throw unsupportedProtocolVersion(requested);
  }
}

function unsupportedProtocolVersion(requested) {
  return new McpError(
    -32022,
    "Unsupported protocol version",
    {
      supported: SUPPORTED_PROTOCOLS,
      requested: requested ?? null,
    },
  );
}

function closedObject(properties, required = []) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function toolAnnotations({ readOnly, idempotent, openWorld = false }) {
  return {
    readOnlyHint: readOnly,
    destructiveHint: false,
    idempotentHint: idempotent,
    openWorldHint: openWorld,
  };
}

function mcpStateRoot() {
  const override = process.env.PROTECTED_PAYBOX_STATE_ROOT;
  if (override) return safeAbsoluteRoot(override, "PROTECTED_PAYBOX_STATE_ROOT");
  const xdgData = process.env.XDG_DATA_HOME;
  if (xdgData) {
    return path.join(
      safeAbsoluteRoot(xdgData, "XDG_DATA_HOME"),
      "delta",
      "protected-paybox",
      "state",
    );
  }
  const home = process.env.HOME;
  if (home) {
    return path.join(
      safeAbsoluteRoot(home, "HOME"),
      ".local",
      "share",
      "delta",
      "protected-paybox",
      "state",
    );
  }
  return path.join(ROOT, ".protected-paybox-runtime");
}

function safeAbsoluteRoot(value, name) {
  if (
    typeof value !== "string" ||
    !path.isAbsolute(value) ||
    path.resolve(value) !== value ||
    value === path.parse(value).root
  ) {
    throw new Error(`${name} must be a normalized absolute directory.`);
  }
  return value;
}

function assertKeys(value, allowed, optional = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool arguments must be an object.");
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`Unknown tool argument: ${unknown[0]}`);
  if (!optional) {
    const missing = allowed.filter((key) => !(key in value));
    if (missing.length > 0) throw new Error(`Missing tool argument: ${missing[0]}`);
  }
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Tool call failed.";
  return message.replaceAll(/[\r\n]/g, " ").slice(0, 500);
}

function errorResponse(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

class McpError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

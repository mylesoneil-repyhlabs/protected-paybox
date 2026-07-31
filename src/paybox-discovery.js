import { Buffer } from "node:buffer";
import { canonicalize, digest, isPlainObject } from "./canonical.js";
import { GuardError } from "./errors.js";

export const PAYBOX_DISCOVERY_LIMITS = Object.freeze({
  maxInputBytes: 512 * 1024,
  maxDepth: 18,
  maxNodes: 20_000,
  maxArrayLength: 1_024,
  maxObjectKeys: 256,
  maxKeyLength: 256,
  maxStringLength: 8_192,
  maxTools: 128,
  maxToolNameLength: 128,
  maxDescriptionLength: 4_096,
});

const SNAPSHOT_SCHEMA = "protected-paybox/paybox-tool-snapshot/v1";
const BLOCKED_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SECRET_VALUE_KEY =
  /^(?:authorization|cookie|credential|oauth|passphrase|private[_-]?key|secret|seed|session[_-]?key|token|api[_-]?key|default|example|examples|enum|const)$/i;
const SECRET_LIKE_VALUE =
  /(?:-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----|\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}|\b(?:ows_key_|sk_live_|pk_live_)[A-Za-z0-9_-]{16,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b)/i;

const READ_NAME =
  /^(?:get|list|read|fetch|lookup|inspect|describe|search|query|health|status|whoami|balances?|positions?|markets?|history)(?:_|-|$)/i;
const READ_TEXT =
  /\b(?:get|list|read|fetch|retrieve|look up|inspect|describe|search|query|show|check|view)\b/i;
const PREPARE_TEXT =
  /\b(?:prepare|build|construct|compose|unsigned|quote|simulate|preview|estimate|route|calldata|transaction request)\b/i;
const SIGN_TEXT =
  /\b(?:sign|signs|signing|signature|authorize|authorization|approve|approval)\b/i;
const BROADCAST_TEXT =
  /\b(?:broadcast|submit|send|dispatch|relay|publish)\b(?:[\s\S]{0,48}\b(?:transaction|order|trade|swap|payment|transfer)\b)?/i;
const DIRECT_WRITE_TEXT =
  /\b(?:swap|trade|transfer|payment|pay|purchase|buy|sell|withdraw|deposit|bridge|lend|borrow|stake|unstake|mint|burn|place order|cancel order|open position|close position|liquidate|execute transaction)\b/i;
const EXPLICIT_EXECUTION_TEXT =
  /\b(?:execute|perform|initiate|place order|cancel order|open position|close position|liquidate)\b/i;
const DESTRUCTIVE_TEXT =
  /\b(?:delete|destroy|remove|revoke|wipe|clear|reset|close account|drain)\b/i;

const SIGN_SCHEMA_FIELD =
  /(?:privatekey|secretkey|sessionkey|passphrase|seedphrase|mnemonic|signature|signatures|signer|sign|signandbroadcast)$/;
const BROADCAST_SCHEMA_FIELD =
  /(?:signedtransaction|rawtransaction|serializedtransaction|signedmessage|transactionbytes|wiretransaction|broadcast|signandbroadcast)$/;
const PREPARE_SCHEMA_FIELD =
  /(?:recipient|destination|toaddress|amount|quantity|sellasset|buyasset|selltoken|buytoken|tokenin|tokenout|slippage|priceimpact|instruction|instructions|transactionrequest|calldata|route)$/;
const DIRECT_WRITE_SCHEMA_FIELD =
  /(?:broadcast|submit|execute|sendtransaction|placetrade|placeorder|swap|transfer|delete|destroy|revoke|signandbroadcast)$/;
const SENSITIVE_SCHEMA_FIELD =
  /(?:privatekey|secretkey|sessionkey|passphrase|seedphrase|mnemonic|credential|authorization|oauth|apikey)$/;

/**
 * Parse an offline capture of an MCP tools/list response.
 *
 * Accepted shapes are a direct tool array, { tools: [...] }, or the JSON-RPC
 * result shape { result: { tools: [...] } }. This function never performs I/O.
 */
export function parseCapturedToolsList(capture) {
  let value = capture;
  if (typeof capture === "string") {
    if (Buffer.byteLength(capture, "utf8") > PAYBOX_DISCOVERY_LIMITS.maxInputBytes) {
      throw discoveryError("CAPTURE_TOO_LARGE", "Captured tools/list JSON is too large.");
    }
    try {
      value = JSON.parse(capture);
    } catch {
      throw discoveryError("CAPTURE_JSON_INVALID", "Captured tools/list data is not valid JSON.");
    }
  }

  assertBoundedJson(value);
  const tools = unwrapTools(value);
  if (tools.length > PAYBOX_DISCOVERY_LIMITS.maxTools) {
    throw discoveryError(
      "TOOL_COUNT_EXCEEDED",
      `Captured tools/list data exceeds ${PAYBOX_DISCOVERY_LIMITS.maxTools} tools.`,
    );
  }

  const names = new Set();
  return tools.map((tool, index) => {
    const normalized = normalizeTool(tool, index);
    const comparisonName = normalized.name.toLowerCase();
    if (names.has(comparisonName)) {
      throw discoveryError(
        "DUPLICATE_TOOL_NAME",
        `Captured tools/list data contains a duplicate tool name: ${normalized.name}.`,
      );
    }
    names.add(comparisonName);
    return normalized;
  });
}

/**
 * Classify one normalized or raw MCP tool definition.
 *
 * A read classification requires positive read evidence and no preparation,
 * signing, broadcast, direct-write, or suspicious input-schema signal.
 */
export function classifyPayboxTool(tool) {
  const normalized = normalizeTool(tool, 0);
  const name = normalized.name;
  const description = normalized.description;
  const nameText = humanize(name);
  const descriptionText = humanize(description);
  const schemaSignals = inspectInputSchema(normalized.inputSchema);

  const readName = READ_NAME.test(name);
  const readDescription = READ_TEXT.test(descriptionText);
  const prepare =
    PREPARE_TEXT.test(nameText) ||
    PREPARE_TEXT.test(descriptionText) ||
    schemaSignals.prepare;
  const sign =
    SIGN_TEXT.test(nameText) ||
    SIGN_TEXT.test(descriptionText) ||
    schemaSignals.sign;
  const broadcast =
    BROADCAST_TEXT.test(nameText) ||
    BROADCAST_TEXT.test(descriptionText) ||
    schemaSignals.broadcast;
  const directWrite =
    DESTRUCTIVE_TEXT.test(nameText) ||
    DESTRUCTIVE_TEXT.test(descriptionText) ||
    normalized.annotations?.destructiveHint === true ||
    EXPLICIT_EXECUTION_TEXT.test(nameText) ||
    EXPLICIT_EXECUTION_TEXT.test(descriptionText) ||
    (DIRECT_WRITE_TEXT.test(nameText) && !PREPARE_TEXT.test(nameText)) ||
    (DIRECT_WRITE_TEXT.test(descriptionText) &&
      !PREPARE_TEXT.test(descriptionText)) ||
    schemaSignals.directWrite;

  let classification;
  if (directWrite || (sign && broadcast)) {
    classification = "combined_write";
  } else if (sign) {
    classification = "sign";
  } else if (broadcast) {
    classification = "broadcast";
  } else if (prepare) {
    classification = "prepare";
  } else if (readName || readDescription) {
    classification = "read";
  } else {
    classification = "unknown";
  }

  const riskFlags = [];
  if (classification === "prepare") riskFlags.push("PREPARES_ACTION");
  if (sign) riskFlags.push("CAN_SIGN");
  if (broadcast) riskFlags.push("CAN_BROADCAST");
  if (directWrite) riskFlags.push("DIRECT_WRITE_CAPABILITY");
  if (classification === "combined_write") riskFlags.push("COMBINED_WRITE");
  if (classification === "unknown") riskFlags.push("UNKNOWN_CAPABILITY");
  if (schemaSignals.mutating) riskFlags.push("MUTATING_INPUT_SCHEMA");
  if (schemaSignals.sensitive) riskFlags.push("SENSITIVE_SIGNING_INPUT");
  if (readName && classification !== "read") riskFlags.push("DECEPTIVE_READ_NAME");

  const readOnlyHint = normalized.annotations?.readOnlyHint;
  if (readOnlyHint === false) riskFlags.push("PROVIDER_MUTATION_HINT");
  if (readOnlyHint === true && classification !== "read") {
    riskFlags.push("MISLEADING_READ_ONLY_HINT");
  }
  if (normalized.annotations?.destructiveHint === true) {
    riskFlags.push("PROVIDER_DESTRUCTIVE_HINT");
  }

  const uniqueRiskFlags = [...new Set(riskFlags)].sort();
  const safeReadOnlyCandidate =
    classification === "read" && uniqueRiskFlags.length === 0;
  const writeCapable = ["sign", "broadcast", "combined_write"].includes(
    classification,
  );

  return {
    classification,
    safe_read_only_candidate: safeReadOnlyCandidate,
    write_capable: writeCapable,
    requires_mandate_gate: !safeReadOnlyCandidate,
    risk_flags: uniqueRiskFlags,
  };
}

/**
 * Produce a deterministic, redacted discovery snapshot.
 *
 * The digest covers canonical JSON for every field except snapshot_digest.
 * Timestamps and live claims are deliberately excluded so the same capture
 * produces the same digest.
 */
export function buildPayboxToolSnapshot(capture) {
  const tools = parseCapturedToolsList(capture)
    .map((tool) => {
      const assessment = classifyPayboxTool(tool);
      const redactedSchema = redactSnapshotValue(tool.inputSchema);
      return {
        name: tool.name,
        description: redactSnapshotValue(tool.description),
        input_schema: redactedSchema,
        input_schema_digest: digest(tool.inputSchema),
        provider_read_only_hint:
          typeof tool.annotations?.readOnlyHint === "boolean"
            ? tool.annotations.readOnlyHint
            : null,
        ...assessment,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const material = {
    schema_version: SNAPSHOT_SCHEMA,
    source: {
      kind: "captured_mcp_tools_list",
      offline_analysis: true,
      provider_authenticated: false,
    },
    tool_count: tools.length,
    risk_summary: {
      read: countClassification(tools, "read"),
      prepare: countClassification(tools, "prepare"),
      sign: countClassification(tools, "sign"),
      broadcast: countClassification(tools, "broadcast"),
      combined_write: countClassification(tools, "combined_write"),
      unknown: countClassification(tools, "unknown"),
      safe_read_only_candidates: tools.filter(
        (tool) => tool.safe_read_only_candidate,
      ).length,
      mandate_gated_tools: tools.filter((tool) => tool.requires_mandate_gate)
        .length,
    },
    tools,
  };

  return {
    ...material,
    snapshot_digest: digest(material),
  };
}

export function canonicalizePayboxToolSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw discoveryError("SNAPSHOT_INVALID", "Tool snapshot must be an object.");
  }
  return canonicalize(snapshot);
}

export function assertBoundedJson(value) {
  const state = { nodes: 0, seen: new WeakSet() };
  visitJson(value, 0, state);
  return value;
}

function visitJson(value, depth, state) {
  state.nodes += 1;
  if (state.nodes > PAYBOX_DISCOVERY_LIMITS.maxNodes) {
    throw discoveryError("JSON_NODE_LIMIT", "Captured JSON contains too many values.");
  }
  if (depth > PAYBOX_DISCOVERY_LIMITS.maxDepth) {
    throw discoveryError("JSON_DEPTH_LIMIT", "Captured JSON is nested too deeply.");
  }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw discoveryError("JSON_NUMBER_INVALID", "Captured JSON contains a non-finite number.");
    }
    return;
  }
  if (typeof value === "string") {
    if (value.length > PAYBOX_DISCOVERY_LIMITS.maxStringLength) {
      throw discoveryError("JSON_STRING_LIMIT", "Captured JSON contains an overlong string.");
    }
    return;
  }
  if (typeof value !== "object") {
    throw discoveryError("JSON_VALUE_INVALID", "Captured data contains a non-JSON value.");
  }
  if (state.seen.has(value)) {
    throw discoveryError("JSON_GRAPH_INVALID", "Captured data must be an acyclic JSON tree.");
  }
  state.seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > PAYBOX_DISCOVERY_LIMITS.maxArrayLength) {
      throw discoveryError("JSON_ARRAY_LIMIT", "Captured JSON contains an oversized array.");
    }
    for (const entry of value) visitJson(entry, depth + 1, state);
    return;
  }
  if (!isPlainObject(value)) {
    throw discoveryError("JSON_OBJECT_INVALID", "Captured JSON contains a non-plain object.");
  }

  const entries = Object.entries(value);
  if (entries.length > PAYBOX_DISCOVERY_LIMITS.maxObjectKeys) {
    throw discoveryError("JSON_KEY_LIMIT", "Captured JSON object contains too many keys.");
  }
  for (const [key, entry] of entries) {
    if (
      key.length > PAYBOX_DISCOVERY_LIMITS.maxKeyLength ||
      BLOCKED_OBJECT_KEYS.has(key)
    ) {
      throw discoveryError("JSON_KEY_INVALID", "Captured JSON contains an invalid object key.");
    }
    visitJson(entry, depth + 1, state);
  }
}

function unwrapTools(value) {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) {
    throw discoveryError(
      "TOOLS_LIST_INVALID",
      "Captured tools/list data must be an array or response object.",
    );
  }
  if ("error" in value) {
    throw discoveryError(
      "TOOLS_LIST_ERROR_RESPONSE",
      "Captured tools/list data contains an MCP error response.",
    );
  }
  if (Array.isArray(value.tools)) return value.tools;
  if (isPlainObject(value.result) && Array.isArray(value.result.tools)) {
    return value.result.tools;
  }
  throw discoveryError(
    "TOOLS_LIST_MISSING",
    "Captured tools/list response does not contain a tools array.",
  );
}

function normalizeTool(tool, index) {
  if (!isPlainObject(tool)) {
    throw discoveryError(
      "TOOL_SCHEMA_INVALID",
      `Tool at index ${index} must be an object.`,
    );
  }
  if (
    typeof tool.name !== "string" ||
    tool.name.length === 0 ||
    tool.name.length > PAYBOX_DISCOVERY_LIMITS.maxToolNameLength ||
    tool.name.trim() !== tool.name ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(tool.name)
  ) {
    throw discoveryError(
      "TOOL_NAME_INVALID",
      `Tool at index ${index} has an invalid name.`,
    );
  }
  const description = tool.description ?? "";
  if (
    typeof description !== "string" ||
    description.length > PAYBOX_DISCOVERY_LIMITS.maxDescriptionLength
  ) {
    throw discoveryError(
      "TOOL_DESCRIPTION_INVALID",
      `Tool ${tool.name} has an invalid description.`,
    );
  }
  if ("inputSchema" in tool && "input_schema" in tool) {
    throw discoveryError(
      "TOOL_SCHEMA_AMBIGUOUS",
      `Tool ${tool.name} contains both inputSchema and input_schema.`,
    );
  }
  const inputSchema = tool.inputSchema ?? tool.input_schema ?? {
    type: "object",
    properties: {},
  };
  if (!isPlainObject(inputSchema)) {
    throw discoveryError(
      "TOOL_SCHEMA_INVALID",
      `Tool ${tool.name} input schema must be an object.`,
    );
  }
  const annotations = tool.annotations;
  if (annotations !== undefined && !isPlainObject(annotations)) {
    throw discoveryError(
      "TOOL_ANNOTATIONS_INVALID",
      `Tool ${tool.name} annotations must be an object.`,
    );
  }
  if (
    annotations?.readOnlyHint !== undefined &&
    typeof annotations.readOnlyHint !== "boolean"
  ) {
    throw discoveryError(
      "TOOL_ANNOTATIONS_INVALID",
      `Tool ${tool.name} readOnlyHint must be a boolean.`,
    );
  }
  for (const hint of [
    "destructiveHint",
    "idempotentHint",
    "openWorldHint",
  ]) {
    if (
      annotations?.[hint] !== undefined &&
      typeof annotations[hint] !== "boolean"
    ) {
      throw discoveryError(
        "TOOL_ANNOTATIONS_INVALID",
        `Tool ${tool.name} ${hint} must be a boolean.`,
      );
    }
  }
  return {
    name: tool.name,
    description,
    inputSchema,
    annotations,
  };
}

function inspectInputSchema(schema) {
  const fields = [];
  collectSchemaFields(schema, [], fields);
  const normalized = fields.map(normalizeIdentifier);
  return {
    sign: normalized.some((field) => SIGN_SCHEMA_FIELD.test(field)),
    broadcast: normalized.some((field) => BROADCAST_SCHEMA_FIELD.test(field)),
    prepare: normalized.some((field) => PREPARE_SCHEMA_FIELD.test(field)),
    directWrite: normalized.some((field) =>
      DIRECT_WRITE_SCHEMA_FIELD.test(field),
    ),
    mutating: normalized.some(
      (field) =>
        SIGN_SCHEMA_FIELD.test(field) ||
        BROADCAST_SCHEMA_FIELD.test(field) ||
        PREPARE_SCHEMA_FIELD.test(field) ||
        DIRECT_WRITE_SCHEMA_FIELD.test(field),
    ),
    sensitive: normalized.some((field) => SENSITIVE_SCHEMA_FIELD.test(field)),
  };
}

function collectSchemaFields(value, path, output) {
  if (Array.isArray(value)) {
    for (const entry of value) collectSchemaFields(entry, path, output);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "properties" && isPlainObject(entry)) {
      for (const [propertyName, definition] of Object.entries(entry)) {
        const propertyPath = [...path, propertyName];
        output.push(propertyPath.join("."));
        collectSchemaFields(definition, propertyPath, output);
      }
      continue;
    }
    if (key === "description" || key === "title") {
      if (typeof entry === "string") output.push(entry);
      continue;
    }
    if (key === "enum" || key === "const" || key === "default") {
      collectSchemaSignalValues(entry, output);
      continue;
    }
    collectSchemaFields(entry, path, output);
  }
}

function collectSchemaSignalValues(value, output) {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSchemaSignalValues(entry, output);
  }
}

function redactSnapshotValue(value, { key = "", propertyMap = false } = {}) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    if (SECRET_LIKE_VALUE.test(value)) return "[REDACTED:SECRET-LIKE]";
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactSnapshotValue(entry));
  }
  if (!isPlainObject(value)) return "[REDACTED:UNSUPPORTED]";

  const next = {};
  for (const [entryKey, entry] of Object.entries(value)) {
    const isPropertyDefinition = propertyMap;
    if (!isPropertyDefinition && SECRET_VALUE_KEY.test(entryKey)) {
      next[entryKey] = "[REDACTED:VALUE]";
      continue;
    }
    next[entryKey] = redactSnapshotValue(entry, {
      key: entryKey,
      propertyMap: entryKey === "properties",
    });
  }
  return next;
}

function humanize(value) {
  return String(value).replace(/[_./:-]+/g, " ").toLowerCase();
}

function normalizeIdentifier(value) {
  return String(value).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function countClassification(tools, classification) {
  return tools.filter((tool) => tool.classification === classification).length;
}

function discoveryError(code, message) {
  return new GuardError(code, message);
}

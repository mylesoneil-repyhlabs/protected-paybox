import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYBOX_DISCOVERY_LIMITS,
  buildPayboxToolSnapshot,
  canonicalizePayboxToolSnapshot,
  classifyPayboxTool,
  parseCapturedToolsList,
} from "../src/paybox-discovery.js";

test("parses JSON-RPC tools/list captures and direct arrays", () => {
  const tool = {
    name: "get_balance",
    description: "Read the current wallet balance.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      properties: { balance: { type: "string" } },
    },
  };

  assert.equal(parseCapturedToolsList([tool]).length, 1);
  assert.equal(
    parseCapturedToolsList(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [tool] } }),
    )[0].name,
    "get_balance",
  );
});

test("rejects malformed, ambiguous, duplicate, and over-bounded captures", () => {
  assert.throws(() => parseCapturedToolsList("{"), /not valid JSON/);
  assert.throws(() => parseCapturedToolsList({ result: {} }), /tools array/);
  assert.throws(
    () =>
      parseCapturedToolsList([
        { name: "same", inputSchema: {} },
        { name: "SAME", inputSchema: {} },
      ]),
    /duplicate tool name/,
  );
  assert.throws(
    () =>
      parseCapturedToolsList([
        {
          name: "bad_schema",
          inputSchema: {},
          input_schema: {},
        },
      ]),
    /both inputSchema and input_schema/,
  );
  assert.throws(
    () =>
      parseCapturedToolsList([
        {
          name: "too_long",
          description: "x".repeat(
            PAYBOX_DISCOVERY_LIMITS.maxDescriptionLength + 1,
          ),
          inputSchema: {},
        },
      ]),
    /invalid description/,
  );

  let deep = "end";
  for (let index = 0; index < PAYBOX_DISCOVERY_LIMITS.maxDepth + 2; index += 1) {
    deep = { nested: deep };
  }
  assert.throws(() => parseCapturedToolsList({ tools: [], deep }), /nested too deeply/);
});

test("classifies an explicit sign-and-broadcast tool as dangerous combined write", () => {
  const result = classifyPayboxTool({
    name: "sign_and_broadcast_transaction",
    description: "Sign and broadcast a serialized transaction.",
    inputSchema: {
      type: "object",
      properties: {
        transaction: { type: "string" },
        session_key: { type: "string" },
      },
    },
  });

  assert.equal(result.classification, "combined_write");
  assert.equal(result.safe_read_only_candidate, false);
  assert.equal(result.write_capable, true);
  assert.equal(result.requires_mandate_gate, true);
  assert.ok(result.risk_flags.includes("CAN_SIGN"));
  assert.ok(result.risk_flags.includes("CAN_BROADCAST"));
  assert.ok(result.risk_flags.includes("COMBINED_WRITE"));
});

test("does not trust a read-looking name when description and schema can write", () => {
  const result = classifyPayboxTool({
    name: "get_transaction_status",
    description: "Signs and submits a transaction, then returns its status.",
    inputSchema: {
      type: "object",
      properties: {
        signed_transaction: { type: "string" },
      },
    },
    annotations: { readOnlyHint: true },
  });

  assert.equal(result.classification, "combined_write");
  assert.equal(result.safe_read_only_candidate, false);
  assert.ok(result.risk_flags.includes("DECEPTIVE_READ_NAME"));
  assert.ok(result.risk_flags.includes("MISLEADING_READ_ONLY_HINT"));
});

test("classifies a prepare-only unsigned transaction candidate without marking it safe", () => {
  const result = classifyPayboxTool({
    name: "prepare_swap",
    description: "Build an unsigned swap transaction for later review.",
    inputSchema: {
      type: "object",
      properties: {
        sell_asset: { type: "string" },
        buy_asset: { type: "string" },
        amount: { type: "string" },
      },
    },
  });

  assert.equal(result.classification, "prepare");
  assert.equal(result.safe_read_only_candidate, false);
  assert.equal(result.write_capable, false);
  assert.equal(result.requires_mandate_gate, true);
  assert.ok(result.risk_flags.includes("PREPARES_ACTION"));
  assert.ok(result.risk_flags.includes("MUTATING_INPUT_SCHEMA"));
});

test("builds a deterministic, sorted, redacted canonical snapshot", () => {
  const capture = [
    {
      name: "prepare_swap",
      description: "Build an unsigned swap transaction.",
      inputSchema: {
        type: "object",
        properties: {
          api_key: {
            type: "string",
            default: ["sk", "live", "abcdefghijklmnopqrstuvwxyz"].join("_"),
          },
          amount: { type: "string" },
        },
      },
    },
    {
      name: "get_balance",
      description: "Retrieve a balance.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: {
        type: "object",
        properties: { balance: { type: "string" } },
      },
    },
  ];

  const first = buildPayboxToolSnapshot(capture);
  const second = buildPayboxToolSnapshot(JSON.stringify(capture));

  assert.deepEqual(first, second);
  assert.equal(first.tools[0].name, "get_balance");
  assert.equal(first.tools[0].safe_read_only_candidate, false);
  assert.ok(
    first.tools[0].risk_flags.includes("REMOTE_TOOL_CALL_UNREVIEWED"),
  );
  assert.equal(first.risk_summary.safe_read_only_candidates, 0);
  assert.equal(first.risk_summary.mandate_gated_tools, first.tool_count);
  assert.match(first.tools[0].output_schema_digest, /^[a-f0-9]{64}$/);
  assert.match(first.snapshot_digest, /^[a-f0-9]{64}$/);
  assert.equal(
    first.tools[1].input_schema.properties.api_key.default,
    "[REDACTED:VALUE]",
  );
  assert.doesNotMatch(canonicalizePayboxToolSnapshot(first), /sk_live_/);
});

test("missing, open, or sensitive output schemas can never be safe read candidates", () => {
  const missing = classifyPayboxTool({
    name: "get_balance",
    description: "Read a balance.",
    inputSchema: { type: "object", properties: {} },
  });
  assert.equal(missing.safe_read_only_candidate, false);
  assert.ok(missing.risk_flags.includes("OUTPUT_SCHEMA_UNBOUND"));

  const open = classifyPayboxTool({
    name: "get_open_result",
    description: "Read an open result.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: {},
  });
  assert.equal(open.safe_read_only_candidate, false);
  assert.ok(open.risk_flags.includes("REMOTE_TOOL_CALL_UNREVIEWED"));

  for (const field of ["secret", "credentials", "card_number"]) {
    const sensitive = classifyPayboxTool({
      name: `list_${field}`,
      description: "List provider values.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: {
        type: "object",
        properties: { [field]: { type: "string" } },
      },
    });
    assert.equal(sensitive.safe_read_only_candidate, false);
    assert.ok(sensitive.risk_flags.includes("SENSITIVE_OUTPUT_SCHEMA"));
    assert.ok(sensitive.risk_flags.includes("REMOTE_TOOL_CALL_UNREVIEWED"));
  }
});

test("missing input schemas are unbound and every remote classification stays gated", () => {
  const tools = [
    {
      name: "get_unbound",
      description: "Read a value.",
      outputSchema: {
        type: "object",
        properties: { value: { type: "string" } },
      },
    },
    {
      name: "get_bound",
      description: "Read a value.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: {
        type: "object",
        properties: { value: { type: "string" } },
      },
    },
    {
      name: "prepare_value",
      description: "Prepare an action.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: { type: "object", properties: {} },
    },
  ];

  const results = tools.map((tool) => classifyPayboxTool(tool));
  assert.ok(results[0].risk_flags.includes("INPUT_SCHEMA_UNBOUND"));
  for (const result of results) {
    assert.equal(result.safe_read_only_candidate, false);
    assert.equal(result.requires_mandate_gate, true);
    assert.ok(result.risk_flags.includes("REMOTE_TOOL_CALL_UNREVIEWED"));
  }
});

test("snapshot sorting uses deterministic ASCII code-point order", () => {
  const snapshot = buildPayboxToolSnapshot([
    { name: "a-", inputSchema: {}, outputSchema: {} },
    { name: "B", inputSchema: {}, outputSchema: {} },
    { name: "a", inputSchema: {}, outputSchema: {} },
    { name: "A_", inputSchema: {}, outputSchema: {} },
  ]);

  assert.deepEqual(
    snapshot.tools.map((tool) => tool.name),
    ["A_", "B", "a", "a-"],
  );
});

test("destructive annotations and names can never be safe reads", () => {
  for (const tool of [
    {
      name: "delete_wallet",
      description: "Return success.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_wallet",
      description: "View a wallet.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, destructiveHint: true },
    },
  ]) {
    const result = classifyPayboxTool(tool);
    assert.equal(result.classification, "combined_write");
    assert.equal(result.safe_read_only_candidate, false);
    assert.equal(result.requires_mandate_gate, true);
  }
});

test("schema enum actions are classified before their values are redacted", () => {
  const capture = [{
    name: "wallet_action",
    description: "Perform a wallet action.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["inspect", "sign_and_broadcast"],
        },
        credential: {
          type: "string",
          const: [
            "eyJhbGciOiJIUzI1NiJ9",
            "eyJzdWIiOiJmaXh0dXJlIn0",
            "signaturepart",
          ].join("."),
        },
      },
    },
  }];
  const assessment = classifyPayboxTool(capture[0]);
  assert.equal(assessment.classification, "combined_write");
  const snapshot = buildPayboxToolSnapshot(capture);
  const serialized = canonicalizePayboxToolSnapshot(snapshot);
  assert.doesNotMatch(serialized, /sign_and_broadcast|eyJhbGci/);
  assert.match(snapshot.tools[0].input_schema_digest, /^[a-f0-9]{64}$/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { canonicalize, digest, digestBytes } from "../src/canonical.js";
import { buildDemoEvidence, buildDemoIntent } from "../src/fixtures.js";
import { evaluateProposal, computeReferenceMinimum } from "../src/evaluator.js";
import { createPlan } from "../src/policy.js";

const NOW = new Date("2026-07-30T12:00:00Z");

function evaluate(scenario = "pass", mutate = null) {
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-evaluator" });
  const evidence = buildDemoEvidence(plan, { scenario, now: NOW });
  if (mutate) mutate(evidence, plan);
  return evaluateProposal({
    plan,
    confirmationDigest: plan.policy_digest,
    evidence,
    nonce: "evaluator-nonce-0001",
    now: NOW,
  });
}

function rebindDecodedMessage(evidence) {
  const bytes = Buffer.from(canonicalize(evidence.message.decoded), "utf8");
  const messageDigest = digestBytes(bytes);
  evidence.message.message_base64 = bytes.toString("base64");
  evidence.message.message_sha256 = messageDigest;
  evidence.simulation.message_sha256 = messageDigest;
}

test("recomputes slippage minimum with integer floor", () => {
  assert.equal(computeReferenceMinimum("26100000", 50), "25969500");
});

const scenarios = [
  ["pass", "PASS", "SIMULATED_EXACT_PROPOSAL_PASS"],
  ["block-minimum-receive", "BLOCK", "MINIMUM_RECEIVE_VIOLATED"],
  ["block-network-fee", "BLOCK", "NETWORK_FEE_EXCEEDED"],
  ["block-price-impact", "BLOCK", "PRICE_IMPACT_EXCEEDED"],
  ["block-recipient", "BLOCK", "RECIPIENT_MISMATCH"],
  ["review-stale", "REVIEW", "COLLECTION_STALE"],
  ["review-unknown-program", "REVIEW", "PROGRAM_NOT_ALLOWLISTED"],
  ["review-hidden-inner-call", "REVIEW", "INNER_PROGRAM_NOT_ALLOWLISTED"],
  ["review-simulation-failed", "REVIEW", "SIMULATION_FAILED"],
];

for (const [scenario, outcome, code] of scenarios) {
  test(`${scenario} returns ${outcome}`, () => {
    const result = evaluate(scenario);
    assert.equal(result.decision.outcome, outcome);
    assert.equal(result.decision.code, code);
  });
}

test("confirmation mismatch blocks before evidence validation", () => {
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-confirm" });
  const result = evaluateProposal({
    plan,
    confirmationDigest: "0".repeat(64),
    evidence: { malicious: true },
    nonce: "evaluator-nonce-0002",
    now: NOW,
  });
  assert.equal(result.decision.code, "POLICY_CONFIRMATION_MISMATCH");
  assert.equal(result.normalizedEvidence, null);
});

test("changed message bytes with unchanged digest returns REVIEW", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.message.message_base64 = Buffer.from("{}", "utf8").toString("base64");
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "MESSAGE_DIGEST_MISMATCH");
});

test("changed decoded semantics with unchanged bytes returns REVIEW", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.message.decoded.fee_payer =
      "7YttLkHDoNj9wyDur5NSVUtWcVwL7W7WvkkufBvZJf1";
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "MESSAGE_DECODE_MISMATCH");
});

test("extra evidence field fails the closed schema", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.agent_says_safe = true;
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "UNKNOWN_FIELD");
});

test("symbol spoof does not affect canonical asset enforcement", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.assets.sell.caip19 = "solana:fake/token:fake";
  });
  assert.equal(result.decision.outcome, "BLOCK");
  assert.equal(result.decision.code, "SELL_ASSET_MISMATCH");
});

test("future-dated evidence returns REVIEW", () => {
  const result = evaluate("pass", (evidence) => {
    const future = new Date(NOW.getTime() + 10_000).toISOString();
    evidence.quote.observed_at = future;
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "QUOTE_STALE_FUTURE");
});

test("token extensions return REVIEW", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.assets.sell.token_extensions = ["transfer_fee"];
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "TOKEN_EXTENSION_UNSUPPORTED");
});

test("unexpected asset movement is a deterministic BLOCK", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.simulation.unexpected_asset_deltas = [
      { asset: "unknown", amount_atomic: "-1" },
    ];
  });
  assert.equal(result.decision.outcome, "BLOCK");
  assert.equal(result.decision.code, "UNEXPECTED_ASSET_DELTA");
});

test("empty decoded instruction set can never PASS", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.message.decoded.instructions = [];
    rebindDecodedMessage(evidence);
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "INSTRUCTION_SET_INVALID");
});

test("arbitrary allowlisted operation can never PASS", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.message.decoded.instructions[1].decoded_operation.type =
      "close_account_and_drain";
    rebindDecodedMessage(evidence);
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "SWAP_OPERATION_UNSUPPORTED");
});

for (const [field, changedValue, expectedCode] of [
  ["builder", "evil-builder", "MESSAGE_BUILDER_MISMATCH"],
  ["sell_asset", "solana:changed/token:changed", "MESSAGE_SELL_ASSET_MISMATCH"],
  ["buy_asset", "solana:changed/slip44:1", "MESSAGE_BUY_ASSET_MISMATCH"],
  ["minimum_receive_atomic", "25000001", "MESSAGE_MINIMUM_RECEIVE_MISMATCH"],
]) {
  test(`decoded swap ${field} is exactly bound`, () => {
    const result = evaluate("pass", (evidence) => {
      evidence.message.decoded.instructions[1].decoded_operation[field] =
        changedValue;
      rebindDecodedMessage(evidence);
    });
    assert.equal(result.decision.outcome, "BLOCK");
    assert.equal(result.decision.code, expectedCode);
  });
}

test("decoded priority fee is bound to the simulated fee", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.message.decoded.instructions[0].decoded_operation
      .priority_fee_atomic = "70000";
    rebindDecodedMessage(evidence);
  });
  assert.equal(result.decision.outcome, "BLOCK");
  assert.equal(result.decision.code, "PRIORITY_FEE_MESSAGE_MISMATCH");
});

test("zero-slippage mandate still produces a valid PASS fixture", () => {
  const plan = createPlan(buildDemoIntent({ max_slippage_bps: 0 }), {
    now: NOW,
    id: "plan-zero-slippage",
  });
  const result = evaluateProposal({
    plan,
    confirmationDigest: plan.policy_digest,
    evidence: buildDemoEvidence(plan, { now: NOW }),
    nonce: "zero-slippage-nonce",
    now: NOW,
  });
  assert.equal(result.decision.outcome, "PASS");
});

test("price-impact BLOCK scenario refuses an unrepresentable 10000-bps cap", () => {
  const plan = createPlan(buildDemoIntent({ max_price_impact_bps: 10_000 }), {
    now: NOW,
    id: "plan-max-impact",
  });
  assert.throws(
    () => buildDemoEvidence(plan, {
      scenario: "block-price-impact",
      now: NOW,
    }),
    (error) => error.code === "SCENARIO_NOT_APPLICABLE",
  );
});

for (const [field, expectedCode] of [
  ["wallet", "WALLET_STALE"],
  ["assets", "ASSET_STALE"],
]) {
  test(`stale ${field} evidence returns REVIEW`, () => {
    const result = evaluate("pass", (evidence) => {
      evidence[field].observed_at = new Date(
        NOW.getTime() - 20_000,
      ).toISOString();
    });
    assert.equal(result.decision.outcome, "REVIEW");
    assert.equal(result.decision.code, expectedCode);
  });
}

test("non-boolean simulation success can never PASS", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.simulation.successful = "false";
    evidence.simulation.error_code = "PROGRAM_ERROR";
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "SIMULATION_STATUS_INVALID");
});

test("chain evidence must bind the exact message blockhash", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.chain.recent_blockhash =
      "DifferentFixtureBlockhash11111111111111111111111";
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "BLOCKHASH_BINDING_MISMATCH");
});

test("top-level collection timestamp is validated and fresh", () => {
  const malformed = evaluate("pass", (evidence) => {
    evidence.collected_at = "not-a-timestamp";
  });
  assert.equal(malformed.decision.outcome, "REVIEW");
  assert.equal(malformed.decision.code, "TIMESTAMP_INVALID");

  const stale = evaluate("pass", (evidence) => {
    evidence.collected_at = "2000-01-01T00:00:00.000Z";
  });
  assert.equal(stale.decision.outcome, "REVIEW");
  assert.equal(stale.decision.code, "COLLECTION_STALE");
});

test("quote expected receive cannot be below its minimum", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.quote.expected_receive_atomic = "1";
    evidence.quote.raw_response_digest = digest({
      builder: evidence.quote.builder,
      expected_receive_atomic: evidence.quote.expected_receive_atomic,
      minimum_receive_atomic: evidence.quote.minimum_receive_atomic,
      price_impact_bps: evidence.quote.price_impact_bps,
      expires_at: evidence.quote.expires_at,
    });
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "QUOTE_AMOUNTS_INCOHERENT");
});

test("blockhash and lookup-table accounts must be 32-byte base58 values", () => {
  const blockhash = evaluate("pass", (evidence) => {
    evidence.message.decoded.recent_blockhash = "x";
    evidence.chain.recent_blockhash = "x";
    rebindDecodedMessage(evidence);
  });
  assert.equal(blockhash.decision.outcome, "REVIEW");
  assert.equal(blockhash.decision.code, "PUBLIC_KEY_INVALID");

  const lookupTable = evaluate("pass", (evidence) => {
    evidence.message.decoded.address_lookup_tables[0].table_account = "x";
    rebindDecodedMessage(evidence);
  });
  assert.equal(lookupTable.decision.outcome, "REVIEW");
  assert.equal(lookupTable.decision.code, "PUBLIC_KEY_INVALID");
});

test("lookup-table resolution slot cannot be later than chain evidence", () => {
  const result = evaluate("pass", (evidence) => {
    evidence.message.decoded.address_lookup_tables[0].resolved_at_slot =
      "999999999999999999999";
    rebindDecodedMessage(evidence);
  });
  assert.equal(result.decision.outcome, "REVIEW");
  assert.equal(result.decision.code, "LOOKUP_TABLE_SLOT_INVALID");
});

for (const [mutate, expectedCode] of [
  [
    (evidence) => { evidence.assets.sell.decimals = 9; },
    "SELL_DECIMALS_MISMATCH",
  ],
  [
    (evidence) => { evidence.assets.buy.decimals = 6; },
    "BUY_DECIMALS_MISMATCH",
  ],
  [
    (evidence) => {
      evidence.assets.sell.token_program =
        "11111111111111111111111111111111";
    },
    "TOKEN_PROGRAM_MISMATCH",
  ],
]) {
  test(`asset metadata mismatch ${expectedCode} blocks`, () => {
    const result = evaluate("pass", mutate);
    assert.equal(result.decision.outcome, "BLOCK");
    assert.equal(result.decision.code, expectedCode);
  });
}

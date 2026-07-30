import test from "node:test";
import assert from "node:assert/strict";
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

test("recomputes slippage minimum with integer floor", () => {
  assert.equal(computeReferenceMinimum("26100000", 50), "25969500");
});

const scenarios = [
  ["pass", "PASS", "SIMULATED_EXACT_PROPOSAL_PASS"],
  ["block-minimum-receive", "BLOCK", "MINIMUM_RECEIVE_VIOLATED"],
  ["block-network-fee", "BLOCK", "NETWORK_FEE_EXCEEDED"],
  ["block-price-impact", "BLOCK", "PRICE_IMPACT_EXCEEDED"],
  ["block-recipient", "BLOCK", "RECIPIENT_MISMATCH"],
  ["review-stale", "REVIEW", "QUOTE_STALE"],
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

import test from "node:test";
import assert from "node:assert/strict";
import { buildDemoEvidence, buildDemoIntent } from "../src/fixtures.js";
import { evaluateProposal } from "../src/evaluator.js";
import { createPlan } from "../src/policy.js";
import { createRecord, verifyRecord } from "../src/receipt.js";
import { digest } from "../src/canonical.js";

const NOW = new Date("2026-07-30T12:00:00Z");

function recordFor(scenario = "pass") {
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-receipt" });
  const evaluation = evaluateProposal({
    plan,
    confirmationDigest: plan.policy_digest,
    evidence: buildDemoEvidence(plan, { scenario, now: NOW }),
    nonce: "receipt-nonce-00001",
    now: NOW,
  });
  return createRecord(evaluation, { now: NOW });
}

for (const scenario of ["pass", "block-minimum-receive", "review-stale"]) {
  test(`${scenario} record verifies`, () => {
    const record = recordFor(scenario);
    assert.equal(verifyRecord(record).verified, true);
  });
}

const mutations = [
  ["policy", (record) => {
    record.plan.policy.economics.max_slippage_bps += 1;
  }],
  ["message bytes", (record) => {
    record.proposal.message.message_base64 = Buffer.from("{}").toString("base64");
  }],
  ["evidence", (record) => {
    record.evidence.quote.minimum_receive_atomic = "1";
  }],
  ["decision", (record) => {
    record.decision.outcome = "BLOCK";
  }],
  ["boundary", (record) => {
    record.boundary.transaction_broadcast = true;
  }],
  ["nonce", (record) => {
    record.nonce_digest = digest("changed");
  }],
];

for (const [name, mutate] of mutations) {
  test(`receipt rejects ${name} mutation`, () => {
    const record = structuredClone(recordFor());
    mutate(record);
    assert.equal(verifyRecord(record).verified, false);
  });
}

test("repairing only outer record digest cannot forge receipt bindings", () => {
  const record = structuredClone(recordFor());
  record.evidence.quote.minimum_receive_atomic = "1";
  const { record_digest: _old, ...body } = record;
  record.record_digest = digest(body);
  const result = verifyRecord(record);
  assert.equal(result.verified, false);
  assert.match(result.reason, /bindings/i);
});

test("receipt explicitly disclaims production Delta proof", () => {
  const record = recordFor();
  assert.equal(record.receipt.verifier.production_delta_proof, false);
  assert.match(verifyRecord(record).statement, /not a production Delta/i);
});

test("receipt binds one-use authorization and expiry without redacting policy semantics", () => {
  const record = recordFor();
  assert.equal(record.plan.policy.authorization.use_count, 1);
  assert.equal(
    record.receipt.bindings.policy_digest,
    record.plan.policy_digest,
  );
  assert.match(record.plan.policy.authorization.expires_at, /Z$/);
});

test("invalid confirmation content is fingerprinted and never sealed raw", () => {
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-secret" });
  const secretLike = [
    "eyJhbGciOiJIUzI1NiJ9",
    "eyJzdWIiOiJub3QtYS1yZWFsLXRva2VuIn0",
    "signaturepart",
  ].join(".");
  const evaluation = evaluateProposal({
    plan,
    confirmationDigest: secretLike,
    evidence: buildDemoEvidence(plan, { now: NOW }),
    nonce: "receipt-secret-nonce",
    now: NOW,
  });
  const serialized = JSON.stringify(createRecord(evaluation, { now: NOW }));
  assert.doesNotMatch(serialized, /eyJhbGci/);
  assert.equal(evaluation.confirmation.supplied_was_valid_digest, false);
});

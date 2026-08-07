import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { digest } from "../src/canonical.js";
import { listRepresentativeMerchants } from "../src/card/catalog.js";
import { cardSnapshotPayload } from "../src/card/evidence.js";
import { evaluateCardProposal } from "../src/card/evaluator.js";
import {
  buildCardDemoEvidence,
  buildCardDemoIntent,
} from "../src/card/fixtures.js";
import { createCardPlan, validateCardPlan } from "../src/card/policy.js";
import { runPreflight } from "../src/preflight.js";
import { verifyRecord } from "../src/receipt.js";

const FIXED_NOW = new Date("2026-08-07T12:00:00.000Z");

test("every representative merchant fixture produces a labeled simulated PASS", async () => {
  for (const merchant of listRepresentativeMerchants()) {
    const plan = createCardPlan(buildCardDemoIntent(merchant.key), {
      now: FIXED_NOW,
      id: `test-${merchant.key}`,
    });
    const evidence = buildCardDemoEvidence(plan, { now: FIXED_NOW });
    const result = await evaluate(plan, evidence, `nonce-${merchant.key}-0000000000`);
    assert.equal(result.record.decision.outcome, "PASS", merchant.key);
    assert.equal(result.record.decision.code, "SIMULATED_CARD_PURCHASE_PASS");
    assert.equal(result.record.boundary.payment_credential_requested, false);
    assert.equal(result.record.boundary.card_authorization_requested, false);
    assert.equal(verifyRecord(result.record).verified, true);
  }
});

test("DoorDash fixture matrix distinguishes complete violations from evidence gaps", async () => {
  const expected = new Map([
    ["block-merchant", ["BLOCK", "CARD_MERCHANT_MISMATCH"]],
    ["block-storefront", ["BLOCK", "CARD_MERCHANT_REFERENCE_MISMATCH"]],
    ["block-total", ["BLOCK", "CARD_TOTAL_EXCEEDED"]],
    ["block-tip", ["BLOCK", "CARD_TIP_EXCEEDED"]],
    ["block-item", ["BLOCK", "CARD_REQUIRED_ITEM_MISSING"]],
    ["block-quantity", ["BLOCK", "CARD_ITEM_QUANTITY_MISMATCH"]],
    ["block-recurring", ["BLOCK", "CARD_RECURRING_PROHIBITED"]],
    ["block-address", ["BLOCK", "CARD_DELIVERY_ADDRESS_MISMATCH"]],
    ["block-subscription", ["BLOCK", "CARD_SUBSCRIPTION_PROHIBITED"]],
    ["block-credential-expiry", ["BLOCK", "CARD_CREDENTIAL_EXPIRY_EXCEEDED"]],
    ["review-stale", ["REVIEW", "CARD_CHECKOUT_STALE"]],
    ["review-low-confidence", ["REVIEW", "ITEM_EVIDENCE_LOW_CONFIDENCE"]],
    ["review-incomplete", ["REVIEW", "ITEM_EVIDENCE_INCOMPLETE"]],
    ["review-total-mismatch", ["REVIEW", "CARD_TOTAL_INCONSISTENT"]],
    ["review-snapshot-tamper", ["REVIEW", "CHECKOUT_SNAPSHOT_DIGEST_MISMATCH"]],
  ]);
  for (const [scenario, [outcome, code]] of expected) {
    const plan = createCardPlan(buildCardDemoIntent(), {
      now: FIXED_NOW,
      id: `test-${scenario}`,
    });
    const evidence = buildCardDemoEvidence(plan, { scenario, now: FIXED_NOW });
    const result = await evaluate(plan, evidence, `nonce-${scenario}-0000000000`);
    assert.equal(result.record.decision.outcome, outcome, scenario);
    assert.equal(result.record.decision.code, code, scenario);
    if (scenario === "block-total") {
      assert.deepEqual(
        result.record.violations.map((violation) => violation.code),
        ["CARD_TOTAL_EXCEEDED", "CARD_DELIVERY_FEE_EXCEEDED"],
      );
    }
  }
});

test("authorization is bound to the exact canonical card policy", async () => {
  const plan = createCardPlan(buildCardDemoIntent(), { now: FIXED_NOW, id: "auth-test" });
  const evidence = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  const result = await runPreflight({
    plan,
    evidence,
    confirmationDigest: digest("another policy"),
    nonce: "confirmation-mismatch-0001",
    now: FIXED_NOW,
    evaluator: evaluateCardProposal,
  });
  assert.equal(result.record.decision.outcome, "BLOCK");
  assert.equal(result.record.decision.code, "POLICY_CONFIRMATION_MISMATCH");
});

test("card plans reject changed policy content", () => {
  const plan = createCardPlan(buildCardDemoIntent(), { now: FIXED_NOW, id: "tamper-test" });
  const changed = structuredClone(plan);
  changed.policy.money.max_total_minor = "999999";
  assert.throws(() => validateCardPlan(changed), /policy/i);
});

test("extractor request and response digests are recomputed before policy checks", async () => {
  const plan = createCardPlan(buildCardDemoIntent(), {
    now: FIXED_NOW,
    id: "extractor-binding-test",
  });
  const responseTampered = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  responseTampered.items[0].extraction.attributes.dietary = "omnivore";
  rebindSnapshot(responseTampered);
  const responseResult = await evaluate(
    plan,
    responseTampered,
    "extractor-response-tamper-0001",
  );
  assert.equal(responseResult.record.decision.outcome, "REVIEW");
  assert.equal(
    responseResult.record.decision.code,
    "EXTRACTOR_RESPONSE_DIGEST_MISMATCH",
  );

  const requestTampered = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  requestTampered.items[0].extraction.request_digest = digest("changed request");
  rebindSnapshot(requestTampered);
  const requestResult = await evaluate(
    plan,
    requestTampered,
    "extractor-request-tamper-00001",
  );
  assert.equal(requestResult.record.decision.outcome, "REVIEW");
  assert.equal(
    requestResult.record.decision.code,
    "EXTRACTOR_REQUEST_DIGEST_MISMATCH",
  );

  const semanticChanged = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  semanticChanged.items[0].extraction.attributes.dietary = "omnivore";
  semanticChanged.items[0].extraction.response_digest = digest(
    semanticChanged.items[0].extraction.attributes,
  );
  rebindSnapshot(semanticChanged);
  const semanticResult = await evaluate(
    plan,
    semanticChanged,
    "extractor-semantic-change-0001",
  );
  assert.equal(semanticResult.record.decision.outcome, "BLOCK");
  assert.equal(
    semanticResult.record.decision.code,
    "CARD_ITEM_ATTRIBUTE_MISMATCH",
  );
});

test("exact authorized item title is enforced even when the checkout snapshot is rebound", async () => {
  const plan = createCardPlan(buildCardDemoIntent(), {
    now: FIXED_NOW,
    id: "item-title-binding-test",
  });
  const evidence = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  evidence.items[0].title = "Different demo product";
  rebindSnapshot(evidence);
  const result = await evaluate(
    plan,
    evidence,
    "item-title-binding-nonce-0001",
  );
  assert.equal(result.record.decision.outcome, "BLOCK");
  assert.equal(result.record.decision.code, "CARD_ITEM_TITLE_MISMATCH");
});

test("top-level evidence collection time independently fails closed when stale or future-dated", async () => {
  const plan = createCardPlan(buildCardDemoIntent(), {
    now: FIXED_NOW,
    id: "evidence-collection-freshness-test",
  });

  const stale = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  stale.collected_at = new Date(FIXED_NOW.getTime() - 60_001).toISOString();
  const staleResult = await evaluate(
    plan,
    stale,
    "evidence-collection-stale-0001",
  );
  assert.equal(staleResult.record.decision.outcome, "REVIEW");
  assert.equal(staleResult.record.decision.code, "CARD_EVIDENCE_STALE");

  const future = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  future.collected_at = new Date(FIXED_NOW.getTime() + 5_001).toISOString();
  const futureResult = await evaluate(
    plan,
    future,
    "evidence-collection-future-0001",
  );
  assert.equal(futureResult.record.decision.outcome, "REVIEW");
  assert.equal(futureResult.record.decision.code, "CARD_EVIDENCE_FUTURE");
});

test("durable fixture history permits a replay but blocks a second PASS nonce", async () => {
  const historyDirectory = await mkdtemp(path.join(tmpdir(), "protected-paybox-card-test-"));
  const plan = createCardPlan(buildCardDemoIntent(), { now: FIXED_NOW, id: "one-use-test" });
  const evidence = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  const first = await evaluate(
    plan,
    evidence,
    "one-use-card-nonce-0001",
    historyDirectory,
  );
  assert.equal(first.record.decision.outcome, "PASS");
  const replay = await evaluate(
    plan,
    evidence,
    "one-use-card-nonce-0001",
    historyDirectory,
  );
  assert.equal(replay.replayed, true);
  const second = await evaluate(
    plan,
    evidence,
    "one-use-card-nonce-0002",
    historyDirectory,
  );
  assert.equal(second.record.decision.outcome, "BLOCK");
  assert.equal(second.record.decision.code, "PLAN_ALREADY_USED");
});

test("sensitive raw-card fields are absent from generated records", async () => {
  const plan = createCardPlan(buildCardDemoIntent(), { now: FIXED_NOW, id: "secret-scan" });
  const evidence = buildCardDemoEvidence(plan, { now: FIXED_NOW });
  const result = await evaluate(plan, evidence, "secret-scan-nonce-0001");
  const serialized = JSON.stringify(result.record).toLowerCase();
  for (const forbidden of ["card_number", "seed_phrase", "private_key", '"cvv"', '"pan"']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

async function evaluate(plan, evidence, nonce, historyDirectory = null) {
  return runPreflight({
    plan,
    evidence,
    confirmationDigest: plan.policy_digest,
    nonce,
    now: FIXED_NOW,
    historyDirectory,
    evaluator: evaluateCardProposal,
  });
}

function rebindSnapshot(evidence) {
  evidence.checkout.snapshot_sha256 = digest(
    cardSnapshotPayload({
      merchant: evidence.merchant,
      items: evidence.items,
      pricing: evidence.pricing,
      fulfillment: evidence.fulfillment,
      payment_request: evidence.payment_request,
      risk: evidence.risk,
    }),
  );
}

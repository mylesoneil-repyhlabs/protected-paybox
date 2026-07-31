import test from "node:test";
import assert from "node:assert/strict";
import {
  createLocalOneUseConformanceConsumer,
  PAYBOX_HOOK_KIND,
  PAYBOX_HOOK_SCHEMA,
  PAYBOX_SIGNING_AUDIENCE,
  verifyPayBoxHookClaim,
} from "../src/integration/paybox-hook-contract.js";
import { createProductionComposition } from "../src/integration/production-composition.js";
import { SOLANA_PROFILE } from "../src/constants.js";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const WALLET = "11111111111111111111111111111111";

function buildClaim(overrides = {}) {
  return {
    schema_version: PAYBOX_HOOK_SCHEMA,
    claim_kind: PAYBOX_HOOK_KIND,
    audience: PAYBOX_SIGNING_AUDIENCE,
    decision: "PASS",
    policy_digest: "1".repeat(64),
    proposal_digest: "2".repeat(64),
    message_digest: "3".repeat(64),
    route_digest: "4".repeat(64),
    evidence_digest: "5".repeat(64),
    simulation_digest: "6".repeat(64),
    tool_contract_digest: "7".repeat(64),
    paybox_authority_digest: "8".repeat(64),
    action_type: "onchain.swap.exact_in",
    chain_id: SOLANA_PROFILE.chain_id,
    wallet_account: WALLET,
    fee_payer: WALLET,
    sell_asset: SOLANA_PROFILE.sell_asset,
    buy_asset: SOLANA_PROFILE.buy_asset,
    sell_amount_atomic: "25000000",
    minimum_receive_atomic: "180000000",
    quoted_receive_atomic: "185000000",
    recipient: WALLET,
    builder: "observed-provider",
    slippage_bps: 27,
    max_slippage_bps: 50,
    price_impact_bps: 21,
    max_price_impact_bps: 50,
    network_fee_atomic: "5000",
    max_network_fee_atomic: "10000",
    priority_fee_atomic: "1000",
    max_priority_fee_atomic: "2500",
    nonce: "hook-nonce-00000001",
    issued_at: "2026-07-30T11:59:30.000Z",
    expires_at: "2026-07-30T12:00:30.000Z",
    one_use: true,
    ...overrides,
  };
}

test("production composition locks before reading credentials or network clients", () => {
  let propertyReads = 0;
  const poison = new Proxy(
    {},
    {
      get() {
        propertyReads += 1;
        throw new Error("credential or network access attempted");
      },
    },
  );

  assert.throws(
    () => createProductionComposition(poison),
    (error) =>
      error.code === "PUBLIC_EXECUTION_LOCKED" &&
      /No credentials or network clients were accessed/.test(error.message),
  );
  assert.equal(propertyReads, 0);
});

test("exact local claim matches its independently supplied expected binding", () => {
  const claim = buildClaim();
  const result = verifyPayBoxHookClaim({
    claim,
    expectedClaim: structuredClone(claim),
    now: NOW,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.local_only, true);
  assert.match(result.claim_digest, /^[a-f0-9]{64}$/);
});

test("mutation of any signing-bound amount is rejected", () => {
  const expectedClaim = buildClaim();
  const claim = buildClaim({ sell_amount_atomic: "25000001" });
  assert.throws(
    () => verifyPayBoxHookClaim({ claim, expectedClaim, now: NOW }),
    (error) =>
      error.code === "HOOK_BINDING_MISMATCH" &&
      error.details.mismatched_fields.includes("sell_amount_atomic"),
  );
});

test("semantically unsafe expected claims are rejected before consumption", () => {
  for (const overrides of [
    {
      quoted_receive_atomic: "179999999",
      minimum_receive_atomic: "180000000",
    },
    { slippage_bps: 51, max_slippage_bps: 50 },
    { price_impact_bps: 51, max_price_impact_bps: 50 },
    { network_fee_atomic: "10001", max_network_fee_atomic: "10000" },
    { priority_fee_atomic: "2501", max_priority_fee_atomic: "2500" },
    { recipient: "4vJ9JU1bJJE96FWSJKvHsmmF94UyA4Q4xT7m7vYfCjBB" },
    { fee_payer: "4vJ9JU1bJJE96FWSJKvHsmmF94UyA4Q4xT7m7vYfCjBB" },
  ]) {
    const claim = buildClaim(overrides);
    assert.throws(
      () =>
        verifyPayBoxHookClaim({
          claim,
          expectedClaim: structuredClone(claim),
          now: NOW,
        }),
      (error) => error.code === "HOOK_SEMANTICS_INVALID",
    );
  }
});

test("evidence and authority mutation are rejected by exact binding", () => {
  const expectedClaim = buildClaim();
  for (const overrides of [
    { evidence_digest: "9".repeat(64) },
    { simulation_digest: "9".repeat(64) },
    { tool_contract_digest: "9".repeat(64) },
    { paybox_authority_digest: "9".repeat(64) },
  ]) {
    assert.throws(
      () =>
        verifyPayBoxHookClaim({
          claim: buildClaim(overrides),
          expectedClaim,
          now: NOW,
        }),
      (error) => error.code === "HOOK_BINDING_MISMATCH",
    );
  }
});

test("wrong signing-boundary audience is rejected", () => {
  const expectedClaim = buildClaim();
  const claim = buildClaim({ audience: "another-wallet.signing-boundary" });
  assert.throws(
    () => verifyPayBoxHookClaim({ claim, expectedClaim, now: NOW }),
    (error) => error.code === "HOOK_AUDIENCE_MISMATCH",
  );
});

test("caller cannot broaden the pinned signing-boundary audience", () => {
  const claim = buildClaim({
    audience: "attacker.signing-boundary",
  });
  assert.throws(
    () =>
      verifyPayBoxHookClaim({
        claim,
        expectedClaim: structuredClone(claim),
        expectedAudience: "attacker.signing-boundary",
        now: NOW,
      }),
    (error) => error.code === "HOOK_AUDIENCE_MISMATCH",
  );
});

test("claim is rejected at its expiry boundary", () => {
  const claim = buildClaim();
  assert.throws(
    () =>
      verifyPayBoxHookClaim({
        claim,
        expectedClaim: structuredClone(claim),
        now: new Date(claim.expires_at),
      }),
    (error) => error.code === "HOOK_EXPIRED",
  );
});

test("local one-use consumer rejects sequential replay", async () => {
  const consumer = createLocalOneUseConformanceConsumer();
  const claim = buildClaim();
  const input = {
    claim,
    expectedClaim: structuredClone(claim),
    now: NOW,
  };
  const first = await consumer.consume(input);
  assert.equal(first.consumed, true);
  assert.equal(first.durable, false);
  assert.equal(first.cryptographic_grant_verified, false);
  await assert.rejects(
    consumer.consume(input),
    (error) => error.code === "HOOK_REPLAYED",
  );
});

test("concurrent local consumption accepts exactly one attempt", async () => {
  const consumer = createLocalOneUseConformanceConsumer();
  const claim = buildClaim();
  const input = {
    claim,
    expectedClaim: structuredClone(claim),
    now: NOW,
  };
  const results = await Promise.allSettled(
    Array.from({ length: 50 }, () => consumer.consume(input)),
  );
  const accepted = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 49);
  assert.ok(rejected.every((result) => result.reason.code === "HOOK_REPLAYED"));
});

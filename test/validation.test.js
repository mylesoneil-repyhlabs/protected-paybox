import test from "node:test";
import assert from "node:assert/strict";
import { digest } from "../src/canonical.js";
import { buildDemoIntent } from "../src/fixtures.js";
import { createPlan, validatePlan } from "../src/policy.js";
import { validateIntent } from "../src/validation.js";

test("valid closed Solana exact-in intent normalizes", () => {
  const intent = validateIntent(buildDemoIntent());
  assert.equal(intent.action_type, "onchain.swap.exact_in");
  assert.equal(intent.sell_amount_atomic, "5000000");
});

const invalidCases = [
  ["unknown field", { surprise: true }, "UNKNOWN_FIELD"],
  ["wrong action", { action_type: "onchain.bridge.exact_in" }, "PROFILE_UNSUPPORTED"],
  ["wrong chain", { chain_id: "eip155:8453" }, "PROFILE_UNSUPPORTED"],
  ["wrong sell asset", { sell_asset: "USDC" }, "PROFILE_UNSUPPORTED"],
  ["wrong buy asset", { buy_asset: "SOL" }, "PROFILE_UNSUPPORTED"],
  ["zero sell amount", { sell_amount_atomic: "0" }, "AMOUNT_INVALID"],
  ["decimal atomic amount", { sell_amount_atomic: "1.2" }, "UNSIGNED_INTEGER_INVALID"],
  ["negative minimum", { minimum_receive_atomic: "-1" }, "UNSIGNED_INTEGER_INVALID"],
  ["invalid wallet", { wallet_account: "not-a-key" }, "PUBLIC_KEY_INVALID"],
  ["wrong-length base58 wallet", { wallet_account: "111111111111111111111111111111111" }, "PUBLIC_KEY_INVALID"],
  ["invalid bps", { max_slippage_bps: 10001 }, "BPS_INVALID"],
  ["invalid builder", { allowed_builder: "Swaps XYZ" }, "BUILDER_INVALID"],
  ["unsupported builder", { allowed_builder: "attacker.router" }, "PROFILE_UNSUPPORTED"],
  ["short validity", { expires_in_seconds: 29 }, "VALIDITY_INVALID"],
  ["long validity", { expires_in_seconds: 301 }, "VALIDITY_INVALID"],
];

for (const [name, override, code] of invalidCases) {
  test(`intent rejects ${name}`, () => {
    assert.throws(
      () => validateIntent(buildDemoIntent(override)),
      (error) => error.code === code,
    );
  });
}

test("policy compiles atomic and display values without floating point", () => {
  const plan = createPlan(buildDemoIntent(), {
    now: new Date("2026-07-30T12:00:00Z"),
    id: "plan-test",
  });
  assert.equal(plan.policy.economics.exact_sell_amount_display, "5");
  assert.equal(plan.policy.economics.minimum_receive_display, "0.025");
  assert.equal(plan.policy.economics.max_network_fee_display, "0.0002");
  assert.equal(plan.policy.economics.max_priority_fee_display, "0.0001");
  assert.equal(plan.status, "AWAITING_AUTHORIZATION");
  assert.equal(plan.boundary.execution_available, false);
  assert.match(plan.policy_digest, /^[a-f0-9]{64}$/);
  assert.equal(validatePlan(plan), plan);
});

for (const [name, mutate] of [
  ["multi-use authorization", (plan) => { plan.policy.authorization.use_count = 999; }],
  ["changed expiry", (plan) => {
    plan.policy.authorization.expires_at = "2099-01-01T00:00:00.000Z";
  }],
  ["approval allowed", (plan) => {
    plan.policy.prohibitions.token_approvals_or_delegation = false;
  }],
  ["empty program allowlist", (plan) => { plan.policy.route.allowed_program_ids = []; }],
]) {
  test(`loaded plan rejects self-hashed ${name}`, () => {
    const plan = createPlan(buildDemoIntent(), {
      now: NOW_FOR_PLAN,
      id: `forged-${name.replaceAll(" ", "-")}`,
    });
    mutate(plan);
    plan.policy_digest = digest(plan.policy);
    assert.throws(
      () => validatePlan(plan),
      (error) => error.code === "PLAN_POLICY_DIGEST_MISMATCH",
    );
  });
}

const NOW_FOR_PLAN = new Date("2026-07-30T12:00:00Z");

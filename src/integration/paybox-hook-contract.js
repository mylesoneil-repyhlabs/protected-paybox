import { assertExactKeys, digest } from "../canonical.js";
import { SCHEMAS, SOLANA_PROFILE } from "../constants.js";
import { GuardError } from "../errors.js";
import {
  normalizePublicKey,
  requireDigest,
  requireIsoTimestamp,
  requirePositiveIntegerString,
  requireUnsignedIntegerString,
} from "../validation.js";

export const PAYBOX_HOOK_SCHEMA =
  SCHEMAS.PAYBOX_SIGNING_HOOK;
export const PAYBOX_SIGNING_AUDIENCE = "paybox.signing-boundary";
export const PAYBOX_HOOK_KIND =
  "local-interface-hypothesis-not-a-cryptographic-grant";

const CLAIM_KEYS = Object.freeze([
  "schema_version",
  "claim_kind",
  "audience",
  "decision",
  "policy_digest",
  "proposal_digest",
  "message_digest",
  "route_digest",
  "evidence_digest",
  "simulation_digest",
  "tool_contract_digest",
  "paybox_authority_digest",
  "action_type",
  "chain_id",
  "wallet_account",
  "fee_payer",
  "sell_asset",
  "buy_asset",
  "sell_amount_atomic",
  "minimum_receive_atomic",
  "quoted_receive_atomic",
  "recipient",
  "builder",
  "slippage_bps",
  "max_slippage_bps",
  "price_impact_bps",
  "max_price_impact_bps",
  "network_fee_atomic",
  "max_network_fee_atomic",
  "priority_fee_atomic",
  "max_priority_fee_atomic",
  "nonce",
  "issued_at",
  "expires_at",
  "one_use",
]);

const NONCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;
const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/**
 * Validate one local interface-hypothesis claim and return its canonical form.
 *
 * This function verifies shape and binding fields only. It does not verify an
 * issuer, signature, user authorization, PayBox response, or Delta proof.
 */
export function normalizePayBoxHookClaim(input) {
  assertExactKeys(input, CLAIM_KEYS, "paybox_hook_claim");
  requireLiteral(input.schema_version, PAYBOX_HOOK_SCHEMA, "schema_version");
  requireLiteral(input.claim_kind, PAYBOX_HOOK_KIND, "claim_kind");
  if (input.audience !== PAYBOX_SIGNING_AUDIENCE) {
    throw new GuardError(
      "HOOK_AUDIENCE_MISMATCH",
      `audience must be ${JSON.stringify(PAYBOX_SIGNING_AUDIENCE)}.`,
    );
  }
  requireLiteral(input.decision, "PASS", "decision");
  requireDigest(input.policy_digest, "policy_digest");
  requireDigest(input.proposal_digest, "proposal_digest");
  requireDigest(input.message_digest, "message_digest");
  requireDigest(input.route_digest, "route_digest");
  requireDigest(input.evidence_digest, "evidence_digest");
  requireDigest(input.simulation_digest, "simulation_digest");
  requireDigest(input.tool_contract_digest, "tool_contract_digest");
  requireDigest(input.paybox_authority_digest, "paybox_authority_digest");
  requireLiteral(input.action_type, "onchain.swap.exact_in", "action_type");
  requireLiteral(input.chain_id, SOLANA_PROFILE.chain_id, "chain_id");
  normalizePublicKey(input.wallet_account, "wallet_account");
  normalizePublicKey(input.fee_payer, "fee_payer");
  requireLiteral(input.sell_asset, SOLANA_PROFILE.sell_asset, "sell_asset");
  requireLiteral(input.buy_asset, SOLANA_PROFILE.buy_asset, "buy_asset");
  requirePositiveIntegerString(input.sell_amount_atomic, "sell_amount_atomic");
  requirePositiveIntegerString(
    input.minimum_receive_atomic,
    "minimum_receive_atomic",
  );
  requirePositiveIntegerString(
    input.quoted_receive_atomic,
    "quoted_receive_atomic",
  );
  normalizePublicKey(input.recipient, "recipient");
  if (
    typeof input.builder !== "string" ||
    !PROVIDER_PATTERN.test(input.builder)
  ) {
    throw new GuardError(
      "HOOK_BUILDER_INVALID",
      "builder must be a lowercase provider identifier.",
    );
  }
  requireBps(input.slippage_bps, "slippage_bps");
  requireBps(input.max_slippage_bps, "max_slippage_bps");
  requireBps(input.price_impact_bps, "price_impact_bps");
  requireBps(input.max_price_impact_bps, "max_price_impact_bps");
  requireUnsignedIntegerString(
    input.network_fee_atomic,
    "network_fee_atomic",
  );
  requireUnsignedIntegerString(
    input.max_network_fee_atomic,
    "max_network_fee_atomic",
  );
  requireUnsignedIntegerString(
    input.priority_fee_atomic,
    "priority_fee_atomic",
  );
  requireUnsignedIntegerString(
    input.max_priority_fee_atomic,
    "max_priority_fee_atomic",
  );
  if (input.fee_payer !== input.wallet_account) {
    throw new GuardError(
      "HOOK_SEMANTICS_INVALID",
      "fee_payer must equal wallet_account in the current self-funded profile.",
    );
  }
  if (input.recipient !== input.wallet_account) {
    throw new GuardError(
      "HOOK_SEMANTICS_INVALID",
      "recipient must equal wallet_account in the current self-recipient profile.",
    );
  }
  if (
    BigInt(input.quoted_receive_atomic) <
    BigInt(input.minimum_receive_atomic)
  ) {
    throw new GuardError(
      "HOOK_SEMANTICS_INVALID",
      "quoted_receive_atomic must meet minimum_receive_atomic.",
    );
  }
  requireAtMost(
    input.slippage_bps,
    input.max_slippage_bps,
    "slippage_bps",
    "max_slippage_bps",
  );
  requireAtMost(
    input.price_impact_bps,
    input.max_price_impact_bps,
    "price_impact_bps",
    "max_price_impact_bps",
  );
  requireAtomicAtMost(
    input.network_fee_atomic,
    input.max_network_fee_atomic,
    "network_fee_atomic",
    "max_network_fee_atomic",
  );
  requireAtomicAtMost(
    input.priority_fee_atomic,
    input.max_priority_fee_atomic,
    "priority_fee_atomic",
    "max_priority_fee_atomic",
  );
  if (
    typeof input.nonce !== "string" ||
    !NONCE_PATTERN.test(input.nonce)
  ) {
    throw new GuardError(
      "HOOK_NONCE_INVALID",
      "nonce must be 16–128 safe characters.",
    );
  }
  const issuedAt = requireIsoTimestamp(input.issued_at, "issued_at");
  const expiresAt = requireIsoTimestamp(input.expires_at, "expires_at");
  const lifetimeMs = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (lifetimeMs <= 0 || lifetimeMs > 300_000) {
    throw new GuardError(
      "HOOK_VALIDITY_INVALID",
      "expires_at must be after issued_at and no more than five minutes later.",
    );
  }
  if (input.one_use !== true) {
    throw new GuardError(
      "HOOK_ONE_USE_REQUIRED",
      "one_use must be true.",
    );
  }

  return Object.freeze({
    schema_version: PAYBOX_HOOK_SCHEMA,
    claim_kind: PAYBOX_HOOK_KIND,
    audience: PAYBOX_SIGNING_AUDIENCE,
    decision: "PASS",
    policy_digest: input.policy_digest,
    proposal_digest: input.proposal_digest,
    message_digest: input.message_digest,
    route_digest: input.route_digest,
    evidence_digest: input.evidence_digest,
    simulation_digest: input.simulation_digest,
    tool_contract_digest: input.tool_contract_digest,
    paybox_authority_digest: input.paybox_authority_digest,
    action_type: "onchain.swap.exact_in",
    chain_id: SOLANA_PROFILE.chain_id,
    wallet_account: input.wallet_account,
    fee_payer: input.fee_payer,
    sell_asset: SOLANA_PROFILE.sell_asset,
    buy_asset: SOLANA_PROFILE.buy_asset,
    sell_amount_atomic: input.sell_amount_atomic,
    minimum_receive_atomic: input.minimum_receive_atomic,
    quoted_receive_atomic: input.quoted_receive_atomic,
    recipient: input.recipient,
    builder: input.builder,
    slippage_bps: input.slippage_bps,
    max_slippage_bps: input.max_slippage_bps,
    price_impact_bps: input.price_impact_bps,
    max_price_impact_bps: input.max_price_impact_bps,
    network_fee_atomic: input.network_fee_atomic,
    max_network_fee_atomic: input.max_network_fee_atomic,
    priority_fee_atomic: input.priority_fee_atomic,
    max_priority_fee_atomic: input.max_priority_fee_atomic,
    nonce: input.nonce,
    issued_at: issuedAt,
    expires_at: expiresAt,
    one_use: true,
  });
}

/**
 * Compare an untrusted hook claim with an independently reconstructed expected
 * claim. Equality is over every contract field.
 */
export function verifyPayBoxHookClaim({
  claim,
  expectedClaim,
  now = new Date(),
}) {
  const expected = normalizePayBoxHookClaim(expectedClaim);
  const actual = normalizePayBoxHookClaim(claim);
  const nowMs = normalizeNow(now);
  if (nowMs < Date.parse(actual.issued_at)) {
    throw new GuardError(
      "HOOK_NOT_YET_VALID",
      "The local hook claim is not valid yet.",
    );
  }
  if (nowMs >= Date.parse(actual.expires_at)) {
    throw new GuardError(
      "HOOK_EXPIRED",
      "The local hook claim has expired.",
    );
  }

  const expectedDigest = digest(expected);
  const actualDigest = digest(actual);
  if (actualDigest !== expectedDigest) {
    throw new GuardError(
      "HOOK_BINDING_MISMATCH",
      "The hook claim does not match the independently reconstructed signing request.",
      {
        mismatched_fields: CLAIM_KEYS.filter(
          (field) => actual[field] !== expected[field],
        ),
      },
    );
  }

  return Object.freeze({
    accepted: true,
    local_only: true,
    schema_version: PAYBOX_HOOK_SCHEMA,
    nonce: actual.nonce,
    claim_digest: actualDigest,
  });
}

/**
 * In-memory conformance simulator for the proposed one-use contract.
 *
 * This deliberately is not durable or distributed. An actual signing boundary
 * must atomically consume a cryptographically authenticated grant in durable
 * storage.
 */
export function createLocalOneUseConformanceConsumer() {
  const consumed = new Set();

  return Object.freeze({
    async consume({ claim, expectedClaim, now = new Date() }) {
      // No await occurs before check-and-set, so concurrent calls in this one
      // JavaScript process can produce at most one accepted result per nonce.
      const result = verifyPayBoxHookClaim({
        claim,
        expectedClaim,
        now,
      });
      const nonceDigest = digest({
        audience: PAYBOX_SIGNING_AUDIENCE,
        nonce: result.nonce,
      });
      if (consumed.has(nonceDigest)) {
        throw new GuardError(
          "HOOK_REPLAYED",
          "This local conformance nonce has already been consumed.",
        );
      }
      consumed.add(nonceDigest);
      return Object.freeze({
        ...result,
        consumed: true,
        durable: false,
        cryptographic_grant_verified: false,
      });
    },
  });
}

function normalizeNow(now) {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime())) {
    throw new GuardError("HOOK_TIME_INVALID", "now must be a valid timestamp.");
  }
  return value.getTime();
}

function requireLiteral(actual, expected, field) {
  if (actual !== expected) {
    throw new GuardError(
      "HOOK_SCHEMA_INVALID",
      `${field} must be ${JSON.stringify(expected)}.`,
    );
  }
}

function requireBps(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new GuardError(
      "HOOK_BPS_INVALID",
      `${field} must be an integer between 0 and 10000.`,
    );
  }
}

function requireAtMost(actual, maximum, actualField, maximumField) {
  if (actual > maximum) {
    throw new GuardError(
      "HOOK_SEMANTICS_INVALID",
      `${actualField} must not exceed ${maximumField}.`,
    );
  }
}

function requireAtomicAtMost(actual, maximum, actualField, maximumField) {
  if (BigInt(actual) > BigInt(maximum)) {
    throw new GuardError(
      "HOOK_SEMANTICS_INVALID",
      `${actualField} must not exceed ${maximumField}.`,
    );
  }
}

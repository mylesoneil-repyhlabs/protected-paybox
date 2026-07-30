import { SCHEMAS, SOLANA_PROFILE } from "./constants.js";
import { assertExactKeys } from "./canonical.js";
import { GuardError } from "./errors.js";

const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const VENUE_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

const INTENT_KEYS = [
  "schema_version",
  "action_type",
  "chain_id",
  "wallet_account",
  "sell_asset",
  "buy_asset",
  "sell_amount_atomic",
  "minimum_receive_atomic",
  "max_slippage_bps",
  "max_price_impact_bps",
  "max_network_fee_atomic",
  "max_priority_fee_atomic",
  "allowed_builder",
  "expires_in_seconds",
];

export function validateIntent(input) {
  assertExactKeys(input, INTENT_KEYS, "intent");
  requireValue(input.schema_version, SCHEMAS.INTENT, "schema_version");
  requireValue(
    input.action_type,
    "onchain.swap.exact_in",
    "action_type",
  );
  requireValue(input.chain_id, SOLANA_PROFILE.chain_id, "chain_id");
  const wallet = normalizePublicKey(input.wallet_account, "wallet_account");
  requireValue(input.sell_asset, SOLANA_PROFILE.sell_asset, "sell_asset");
  requireValue(input.buy_asset, SOLANA_PROFILE.buy_asset, "buy_asset");
  requirePositiveIntegerString(input.sell_amount_atomic, "sell_amount_atomic");
  requirePositiveIntegerString(
    input.minimum_receive_atomic,
    "minimum_receive_atomic",
  );
  requireBps(input.max_slippage_bps, "max_slippage_bps");
  requireBps(input.max_price_impact_bps, "max_price_impact_bps");
  requirePositiveIntegerString(
    input.max_network_fee_atomic,
    "max_network_fee_atomic",
  );
  requireUnsignedIntegerString(
    input.max_priority_fee_atomic,
    "max_priority_fee_atomic",
  );

  if (
    typeof input.allowed_builder !== "string" ||
    !VENUE_PATTERN.test(input.allowed_builder)
  ) {
    throw new GuardError(
      "BUILDER_INVALID",
      "allowed_builder must be a lowercase provider identifier.",
    );
  }
  if (
    !Number.isInteger(input.expires_in_seconds) ||
    input.expires_in_seconds < 30 ||
    input.expires_in_seconds > 300
  ) {
    throw new GuardError(
      "VALIDITY_INVALID",
      "expires_in_seconds must be an integer between 30 and 300.",
    );
  }

  return {
    schema_version: SCHEMAS.INTENT,
    action_type: "onchain.swap.exact_in",
    chain_id: SOLANA_PROFILE.chain_id,
    wallet_account: wallet,
    sell_asset: SOLANA_PROFILE.sell_asset,
    buy_asset: SOLANA_PROFILE.buy_asset,
    sell_amount_atomic: input.sell_amount_atomic,
    minimum_receive_atomic: input.minimum_receive_atomic,
    max_slippage_bps: input.max_slippage_bps,
    max_price_impact_bps: input.max_price_impact_bps,
    max_network_fee_atomic: input.max_network_fee_atomic,
    max_priority_fee_atomic: input.max_priority_fee_atomic,
    allowed_builder: input.allowed_builder,
    expires_in_seconds: input.expires_in_seconds,
  };
}

export function normalizePublicKey(value, field = "public_key") {
  if (typeof value !== "string" || !BASE58_PATTERN.test(value)) {
    throw new GuardError(
      "PUBLIC_KEY_INVALID",
      `${field} must be a base58-encoded Solana public key.`,
    );
  }
  return value;
}

export function validateHex(value, field, { allowEmpty = false } = {}) {
  if (
    typeof value !== "string" ||
    !/^0x(?:[a-fA-F0-9]{2})*$/.test(value) ||
    (!allowEmpty && value === "0x")
  ) {
    throw new GuardError(
      "HEX_INVALID",
      `${field} must be an even-length 0x-prefixed hex string.`,
    );
  }
  return value.toLowerCase();
}

export function requireUnsignedIntegerString(value, field) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new GuardError(
      "UNSIGNED_INTEGER_INVALID",
      `${field} must be an unsigned integer string.`,
    );
  }
  return value;
}

export function requirePositiveIntegerString(value, field) {
  requireUnsignedIntegerString(value, field);
  if (value === "0") {
    throw new GuardError(
      "AMOUNT_INVALID",
      `${field} must be greater than zero.`,
    );
  }
  return value;
}

export function requireIsoTimestamp(value, field) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new GuardError(
      "TIMESTAMP_INVALID",
      `${field} must be an ISO-8601 timestamp.`,
    );
  }
  return new Date(value).toISOString();
}

export function requireDigest(value, field) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new GuardError(
      "DIGEST_INVALID",
      `${field} must be a lowercase SHA-256 digest.`,
    );
  }
  return value;
}

function requireValue(actual, expected, field) {
  if (actual !== expected) {
    throw new GuardError(
      "PROFILE_UNSUPPORTED",
      `${field} must be ${JSON.stringify(expected)} in this release.`,
    );
  }
}

function requireBps(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new GuardError(
      "BPS_INVALID",
      `${field} must be an integer between 0 and 10000.`,
    );
  }
}

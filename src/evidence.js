import {
  assertExactKeys,
  canonicalize,
  clone,
  digest,
  digestBytes,
} from "./canonical.js";
import {
  DEFAULT_FRESHNESS,
  SCHEMAS,
  SOLANA_PROFILE,
} from "./constants.js";
import { GuardError } from "./errors.js";
import {
  normalizePublicKey,
  requireDigest,
  requireIsoTimestamp,
  requireUnsignedIntegerString,
} from "./validation.js";

const TOP_LEVEL_KEYS = [
  "schema_version",
  "mode",
  "collected_at",
  "provenance",
  "tool_contract",
  "wallet",
  "assets",
  "chain",
  "quote",
  "reference",
  "message",
  "simulation",
];

export function normalizeEvidence(input, plan, { now = new Date() } = {}) {
  assertExactKeys(input, TOP_LEVEL_KEYS, "evidence");
  if (input.schema_version !== SCHEMAS.EVIDENCE) {
    throw new GuardError(
      "EVIDENCE_SCHEMA_UNSUPPORTED",
      `evidence.schema_version must be ${SCHEMAS.EVIDENCE}.`,
    );
  }
  if (input.mode !== "simulated_fixture") {
    throw new GuardError(
      "LIVE_EVIDENCE_UNAVAILABLE",
      "This release accepts labeled simulated fixtures only.",
    );
  }
  validateProvenance(input.provenance);
  validateToolContract(input.tool_contract);
  validateWallet(input.wallet);
  validateAssets(input.assets);
  validateChain(input.chain);
  validateQuote(input.quote);
  validateReference(input.reference);
  const decodedBytes = validateMessage(input.message);
  validateSimulation(input.simulation);

  const issues = freshnessIssues(input, now);
  const normalized = clone(input);
  normalized.message.message_sha256 = digestBytes(decodedBytes);
  normalized.evidence_digest = digest({
    schema_version: normalized.schema_version,
    mode: normalized.mode,
    collected_at: normalized.collected_at,
    provenance: normalized.provenance,
    tool_contract: normalized.tool_contract,
    wallet: normalized.wallet,
    assets: normalized.assets,
    chain: normalized.chain,
    quote: normalized.quote,
    reference: normalized.reference,
    message: normalized.message,
    simulation: normalized.simulation,
  });
  normalized.freshness_issues = issues;
  normalized.subject_policy_digest = plan.policy_digest;
  return normalized;
}

function validateProvenance(value) {
  assertExactKeys(
    value,
    [
      "authenticity",
      "paybox_contacted",
      "network_contacted",
      "statement",
    ],
    "evidence.provenance",
  );
  if (
    value.authenticity !== "SELF_REPORTED_FIXTURE" ||
    value.paybox_contacted !== false ||
    value.network_contacted !== false
  ) {
    throw new GuardError(
      "PROVENANCE_INVALID",
      "Fixture provenance must state that PayBox and network sources were not contacted.",
    );
  }
}

function validateToolContract(value) {
  assertExactKeys(
    value,
    [
      "provider",
      "tool_name",
      "schema_digest",
      "authenticated_schema_observed",
    ],
    "evidence.tool_contract",
  );
  requireDigest(value.schema_digest, "evidence.tool_contract.schema_digest");
  if (value.authenticated_schema_observed !== false) {
    throw new GuardError(
      "PAYBOX_SCHEMA_UNVERIFIED",
      "Authenticated PayBox tool schemas have not been observed in this release.",
    );
  }
}

function validateWallet(value) {
  assertExactKeys(
    value,
    [
      "account",
      "chain_id",
      "sell_balance_atomic",
      "native_fee_balance_atomic",
      "observed_at",
    ],
    "evidence.wallet",
  );
  normalizePublicKey(value.account, "evidence.wallet.account");
  requireUnsignedIntegerString(
    value.sell_balance_atomic,
    "evidence.wallet.sell_balance_atomic",
  );
  requireUnsignedIntegerString(
    value.native_fee_balance_atomic,
    "evidence.wallet.native_fee_balance_atomic",
  );
  requireIsoTimestamp(value.observed_at, "evidence.wallet.observed_at");
}

function validateAssets(value) {
  assertExactKeys(value, ["sell", "buy", "observed_at"], "evidence.assets");
  assertExactKeys(
    value.sell,
    ["caip19", "mint", "decimals", "token_program", "token_extensions"],
    "evidence.assets.sell",
  );
  assertExactKeys(
    value.buy,
    ["caip19", "decimals"],
    "evidence.assets.buy",
  );
  normalizePublicKey(value.sell.mint, "evidence.assets.sell.mint");
  normalizePublicKey(
    value.sell.token_program,
    "evidence.assets.sell.token_program",
  );
  if (!Array.isArray(value.sell.token_extensions)) {
    throw new GuardError(
      "TOKEN_EXTENSIONS_INVALID",
      "evidence.assets.sell.token_extensions must be an array.",
    );
  }
  requireIsoTimestamp(value.observed_at, "evidence.assets.observed_at");
}

function validateChain(value) {
  assertExactKeys(
    value,
    [
      "chain_id",
      "current_slot",
      "current_block_height",
      "blockhash_valid",
      "observed_at",
    ],
    "evidence.chain",
  );
  requireUnsignedIntegerString(value.current_slot, "evidence.chain.current_slot");
  requireUnsignedIntegerString(
    value.current_block_height,
    "evidence.chain.current_block_height",
  );
  if (typeof value.blockhash_valid !== "boolean") {
    throw new GuardError(
      "BLOCKHASH_STATUS_INVALID",
      "evidence.chain.blockhash_valid must be a boolean.",
    );
  }
  requireIsoTimestamp(value.observed_at, "evidence.chain.observed_at");
}

function validateQuote(value) {
  assertExactKeys(
    value,
    [
      "builder",
      "request_digest",
      "raw_response_digest",
      "expected_receive_atomic",
      "minimum_receive_atomic",
      "price_impact_bps",
      "observed_at",
      "expires_at",
    ],
    "evidence.quote",
  );
  requireDigest(value.request_digest, "evidence.quote.request_digest");
  requireDigest(
    value.raw_response_digest,
    "evidence.quote.raw_response_digest",
  );
  requireUnsignedIntegerString(
    value.expected_receive_atomic,
    "evidence.quote.expected_receive_atomic",
  );
  requireUnsignedIntegerString(
    value.minimum_receive_atomic,
    "evidence.quote.minimum_receive_atomic",
  );
  if (!Number.isInteger(value.price_impact_bps) || value.price_impact_bps < 0) {
    throw new GuardError(
      "PRICE_IMPACT_INVALID",
      "evidence.quote.price_impact_bps must be a non-negative integer.",
    );
  }
  requireIsoTimestamp(value.observed_at, "evidence.quote.observed_at");
  requireIsoTimestamp(value.expires_at, "evidence.quote.expires_at");
}

function validateReference(value) {
  assertExactKeys(
    value,
    ["source", "expected_receive_atomic", "observed_at"],
    "evidence.reference",
  );
  requireUnsignedIntegerString(
    value.expected_receive_atomic,
    "evidence.reference.expected_receive_atomic",
  );
  requireIsoTimestamp(value.observed_at, "evidence.reference.observed_at");
}

function validateMessage(value) {
  assertExactKeys(
    value,
    ["format", "message_base64", "message_sha256", "decoded"],
    "evidence.message",
  );
  if (value.format !== "fixture_json_base64") {
    throw new GuardError(
      "MESSAGE_FORMAT_UNSUPPORTED",
      "Only the explicitly labeled fixture message format is supported.",
    );
  }
  requireDigest(value.message_sha256, "evidence.message.message_sha256");
  let bytes;
  let parsed;
  try {
    bytes = Buffer.from(value.message_base64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== value.message_base64) {
      throw new Error("not canonical base64");
    }
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new GuardError(
      "MESSAGE_BYTES_INVALID",
      "The fixture message bytes are not canonical base64 JSON.",
    );
  }
  if (digestBytes(bytes) !== value.message_sha256) {
    throw new GuardError(
      "MESSAGE_DIGEST_MISMATCH",
      "The message byte digest does not match the supplied bytes.",
    );
  }
  if (canonicalize(parsed) !== canonicalize(value.decoded)) {
    throw new GuardError(
      "MESSAGE_DECODE_MISMATCH",
      "Decoded message semantics do not match the bound message bytes.",
    );
  }
  return bytes;
}

function validateSimulation(value) {
  assertExactKeys(
    value,
    [
      "message_sha256",
      "context_slot",
      "successful",
      "error_code",
      "sell_debit_atomic",
      "buy_credit_atomic",
      "recipient_account",
      "network_fee_atomic",
      "priority_fee_atomic",
      "unexpected_asset_deltas",
      "undecoded_instructions",
      "observed_at",
    ],
    "evidence.simulation",
  );
  requireDigest(value.message_sha256, "evidence.simulation.message_sha256");
  requireUnsignedIntegerString(
    value.context_slot,
    "evidence.simulation.context_slot",
  );
  requireUnsignedIntegerString(
    value.sell_debit_atomic,
    "evidence.simulation.sell_debit_atomic",
  );
  requireUnsignedIntegerString(
    value.buy_credit_atomic,
    "evidence.simulation.buy_credit_atomic",
  );
  normalizePublicKey(
    value.recipient_account,
    "evidence.simulation.recipient_account",
  );
  requireUnsignedIntegerString(
    value.network_fee_atomic,
    "evidence.simulation.network_fee_atomic",
  );
  requireUnsignedIntegerString(
    value.priority_fee_atomic,
    "evidence.simulation.priority_fee_atomic",
  );
  if (
    !Array.isArray(value.unexpected_asset_deltas) ||
    !Array.isArray(value.undecoded_instructions)
  ) {
    throw new GuardError(
      "SIMULATION_ARRAY_INVALID",
      "Simulation unexpected and undecoded fields must be arrays.",
    );
  }
  requireIsoTimestamp(value.observed_at, "evidence.simulation.observed_at");
}

function freshnessIssues(input, now) {
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new GuardError("CLOCK_INVALID", "Evaluation clock is invalid.");
  }
  const checks = [
    ["QUOTE_STALE", input.quote.observed_at, DEFAULT_FRESHNESS.quote_max_age_ms],
    ["CHAIN_STALE", input.chain.observed_at, DEFAULT_FRESHNESS.chain_max_age_ms],
    [
      "SIMULATION_STALE",
      input.simulation.observed_at,
      DEFAULT_FRESHNESS.simulation_max_age_ms,
    ],
    [
      "REFERENCE_STALE",
      input.reference.observed_at,
      DEFAULT_FRESHNESS.quote_max_age_ms,
    ],
  ];
  const issues = [];
  for (const [code, value, maximum] of checks) {
    const observed = Date.parse(value);
    const age = timestamp - observed;
    if (age < -2_000) issues.push({ code: `${code}_FUTURE`, age_ms: age });
    else if (age > maximum) issues.push({ code, age_ms: age });
  }
  if (timestamp >= Date.parse(input.quote.expires_at)) {
    issues.push({ code: "QUOTE_EXPIRED" });
  }
  const blockLag =
    BigInt(input.chain.current_slot) - BigInt(input.simulation.context_slot);
  if (
    blockLag < 0n ||
    blockLag > BigInt(DEFAULT_FRESHNESS.max_block_lag)
  ) {
    issues.push({ code: "SIMULATION_BLOCK_LAG", block_lag: blockLag.toString() });
  }
  const safetyMargin =
    BigInt(input.message.decoded.last_valid_block_height) -
    BigInt(input.chain.current_block_height);
  if (input.chain.blockhash_valid !== true || safetyMargin < 20n) {
    issues.push({
      code: "BLOCKHASH_UNSAFE",
      safety_margin: safetyMargin.toString(),
    });
  }
  return issues;
}

export function allowedFixturePrograms() {
  return new Set(Object.values(SOLANA_PROFILE.fixture_program_registry));
}

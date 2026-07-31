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
  validateFixtureBindings(input, plan);

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
  requireBoundedString(value.statement, "evidence.provenance.statement");
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
  const expectedSchemaDigest = digest({
    note: "Synthetic placeholder until authenticated PayBox tools/list is captured.",
  });
  if (
    value.provider !== "unverified-paybox-contract" ||
    value.tool_name !== "paybox.wallet.sign_and_broadcast" ||
    value.schema_digest !== expectedSchemaDigest ||
    value.authenticated_schema_observed !== false
  ) {
    throw new GuardError(
      "PAYBOX_SCHEMA_UNVERIFIED",
      "The fixture tool contract must remain the exact unverified, non-live placeholder.",
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
  requireBoundedString(value.chain_id, "evidence.wallet.chain_id");
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
  requireBoundedString(value.sell.caip19, "evidence.assets.sell.caip19");
  requireBoundedString(value.buy.caip19, "evidence.assets.buy.caip19");
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
  if (
    !Number.isInteger(value.sell.decimals) ||
    value.sell.decimals < 0 ||
    value.sell.decimals > 18 ||
    !Number.isInteger(value.buy.decimals) ||
    value.buy.decimals < 0 ||
    value.buy.decimals > 18
  ) {
    throw new GuardError(
      "ASSET_DECIMALS_INVALID",
      "Asset decimals must be integers between 0 and 18.",
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
      "recent_blockhash",
      "blockhash_valid",
      "observed_at",
    ],
    "evidence.chain",
  );
  requireBoundedString(value.chain_id, "evidence.chain.chain_id");
  requireUnsignedIntegerString(value.current_slot, "evidence.chain.current_slot");
  requireUnsignedIntegerString(
    value.current_block_height,
    "evidence.chain.current_block_height",
  );
  requireBoundedString(value.recent_blockhash, "evidence.chain.recent_blockhash");
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
  requireBoundedString(value.builder, "evidence.quote.builder");
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
  if (
    !Number.isInteger(value.price_impact_bps) ||
    value.price_impact_bps < 0 ||
    value.price_impact_bps > 10_000
  ) {
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
  if (value.source !== "local-reference-fixture") {
    throw new GuardError(
      "REFERENCE_SOURCE_INVALID",
      "Reference evidence must be the labeled local fixture source.",
    );
  }
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
  validateDecodedMessage(parsed);
  return bytes;
}

function validateDecodedMessage(value) {
  assertExactKeys(
    value,
    [
      "schema_version",
      "version",
      "fee_payer",
      "recent_blockhash",
      "last_valid_block_height",
      "required_signers",
      "address_lookup_tables",
      "instructions",
      "inner_program_ids",
    ],
    "evidence.message.decoded",
  );
  if (
    value.schema_version !== "protected-paybox.fixture-solana-message.v1" ||
    value.version !== "v0"
  ) {
    throw new GuardError(
      "DECODED_MESSAGE_PROFILE_UNSUPPORTED",
      "The decoded fixture message profile is unsupported.",
    );
  }
  normalizePublicKey(value.fee_payer, "evidence.message.decoded.fee_payer");
  requireBoundedString(
    value.recent_blockhash,
    "evidence.message.decoded.recent_blockhash",
  );
  requireUnsignedIntegerString(
    value.last_valid_block_height,
    "evidence.message.decoded.last_valid_block_height",
  );
  requireStringArray(
    value.required_signers,
    "evidence.message.decoded.required_signers",
    { minimum: 1, maximum: 4, publicKeys: true },
  );
  if (
    !Array.isArray(value.address_lookup_tables) ||
    value.address_lookup_tables.length > 8
  ) {
    throw new GuardError(
      "LOOKUP_TABLES_INVALID",
      "Decoded address lookup tables must be a bounded array.",
    );
  }
  for (const [index, table] of value.address_lookup_tables.entries()) {
    assertExactKeys(
      table,
      ["table_account", "resolved", "resolved_at_slot", "table_data_sha256"],
      `evidence.message.decoded.address_lookup_tables[${index}]`,
    );
    requireBoundedString(
      table.table_account,
      `evidence.message.decoded.address_lookup_tables[${index}].table_account`,
    );
    if (typeof table.resolved !== "boolean") {
      throw new GuardError(
        "LOOKUP_TABLE_STATUS_INVALID",
        "Address lookup-table resolution status must be boolean.",
      );
    }
    requireUnsignedIntegerString(
      table.resolved_at_slot,
      `evidence.message.decoded.address_lookup_tables[${index}].resolved_at_slot`,
    );
    requireDigest(
      table.table_data_sha256,
      `evidence.message.decoded.address_lookup_tables[${index}].table_data_sha256`,
    );
  }
  if (!Array.isArray(value.instructions) || value.instructions.length !== 2) {
    throw new GuardError(
      "INSTRUCTION_SET_INVALID",
      "This profile requires exactly one compute-budget instruction and one exact-input swap instruction.",
    );
  }
  validateComputeInstruction(value.instructions[0]);
  validateSwapInstruction(value.instructions[1]);
  requireStringArray(
    value.inner_program_ids,
    "evidence.message.decoded.inner_program_ids",
    { minimum: 1, maximum: 16 },
  );
}

function validateComputeInstruction(instruction) {
  assertExactKeys(
    instruction,
    ["index", "program_id", "decoder_id", "decoded_operation"],
    "evidence.message.decoded.instructions[0]",
  );
  if (
    instruction.index !== 0 ||
    instruction.decoder_id !== "solana-compute-budget.v1"
  ) {
    throw new GuardError(
      "COMPUTE_INSTRUCTION_INVALID",
      "The first instruction must be the decoded compute-budget fixture instruction.",
    );
  }
  requireBoundedString(
    instruction.program_id,
    "evidence.message.decoded.instructions[0].program_id",
  );
  assertExactKeys(
    instruction.decoded_operation,
    ["type", "priority_fee_atomic"],
    "evidence.message.decoded.instructions[0].decoded_operation",
  );
  if (instruction.decoded_operation.type !== "set_compute_unit_price") {
    throw new GuardError(
      "COMPUTE_OPERATION_UNSUPPORTED",
      "The compute-budget fixture operation is unsupported.",
    );
  }
  requireUnsignedIntegerString(
    instruction.decoded_operation.priority_fee_atomic,
    "evidence.message.decoded.instructions[0].decoded_operation.priority_fee_atomic",
  );
}

function validateSwapInstruction(instruction) {
  assertExactKeys(
    instruction,
    ["index", "program_id", "decoder_id", "decoded_operation"],
    "evidence.message.decoded.instructions[1]",
  );
  if (
    instruction.index !== 1 ||
    instruction.decoder_id !== "fixture-exact-in-swap.v1"
  ) {
    throw new GuardError(
      "SWAP_INSTRUCTION_INVALID",
      "The second instruction must be the decoded exact-input swap fixture instruction.",
    );
  }
  requireBoundedString(
    instruction.program_id,
    "evidence.message.decoded.instructions[1].program_id",
  );
  const operation = instruction.decoded_operation;
  assertExactKeys(
    operation,
    [
      "type",
      "builder",
      "sell_asset",
      "buy_asset",
      "sell_amount_atomic",
      "minimum_receive_atomic",
      "recipient_account",
    ],
    "evidence.message.decoded.instructions[1].decoded_operation",
  );
  if (operation.type !== "swap_exact_in") {
    throw new GuardError(
      "SWAP_OPERATION_UNSUPPORTED",
      "The decoded fixture contains an unsupported operation.",
    );
  }
  for (const [field, value] of [
    ["builder", operation.builder],
    ["sell_asset", operation.sell_asset],
    ["buy_asset", operation.buy_asset],
  ]) {
    requireBoundedString(
      value,
      `evidence.message.decoded.instructions[1].decoded_operation.${field}`,
    );
  }
  requireUnsignedIntegerString(
    operation.sell_amount_atomic,
    "evidence.message.decoded.instructions[1].decoded_operation.sell_amount_atomic",
  );
  requireUnsignedIntegerString(
    operation.minimum_receive_atomic,
    "evidence.message.decoded.instructions[1].decoded_operation.minimum_receive_atomic",
  );
  normalizePublicKey(
    operation.recipient_account,
    "evidence.message.decoded.instructions[1].decoded_operation.recipient_account",
  );
}

function requireStringArray(
  value,
  field,
  { minimum = 0, maximum, publicKeys = false } = {},
) {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new GuardError(
      "STRING_ARRAY_INVALID",
      `${field} must contain ${minimum}–${maximum} entries.`,
    );
  }
  for (let index = 0; index < value.length; index += 1) {
    if (publicKeys) normalizePublicKey(value[index], `${field}[${index}]`);
    else requireBoundedString(value[index], `${field}[${index}]`);
  }
}

function requireBoundedString(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) {
    throw new GuardError(
      "STRING_INVALID",
      `${field} must be a non-empty string of at most 256 characters.`,
    );
  }
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
  if (typeof value.successful !== "boolean") {
    throw new GuardError(
      "SIMULATION_STATUS_INVALID",
      "Simulation successful status must be boolean.",
    );
  }
  if (
    (value.successful && value.error_code !== null) ||
    (!value.successful &&
      (typeof value.error_code !== "string" ||
        value.error_code.length < 1 ||
        value.error_code.length > 128))
  ) {
    throw new GuardError(
      "SIMULATION_ERROR_INVALID",
      "Simulation error state does not match its success status.",
    );
  }
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
    !Array.isArray(value.undecoded_instructions) ||
    value.unexpected_asset_deltas.length > 128 ||
    value.undecoded_instructions.length > 128
  ) {
    throw new GuardError(
      "SIMULATION_ARRAY_INVALID",
      "Simulation unexpected and undecoded fields must be arrays.",
    );
  }
  requireIsoTimestamp(value.observed_at, "evidence.simulation.observed_at");
}

function validateFixtureBindings(input, plan) {
  const expectedRequestDigest = digest({
    chain_id: plan.policy.network.chain_id,
    sell_asset: plan.policy.assets.sell.caip19,
    buy_asset: plan.policy.assets.buy.caip19,
    sell_amount_atomic: plan.policy.economics.exact_sell_amount_atomic,
    recipient: plan.policy.authority.wallet_account,
  });
  if (input.quote.request_digest !== expectedRequestDigest) {
    throw new GuardError(
      "QUOTE_REQUEST_DIGEST_MISMATCH",
      "The quote request digest does not bind the authorized request.",
    );
  }
  const expectedResponseDigest = digest({
    builder: input.quote.builder,
    expected_receive_atomic: input.quote.expected_receive_atomic,
    minimum_receive_atomic: input.quote.minimum_receive_atomic,
    price_impact_bps: input.quote.price_impact_bps,
    expires_at: input.quote.expires_at,
  });
  if (input.quote.raw_response_digest !== expectedResponseDigest) {
    throw new GuardError(
      "QUOTE_RESPONSE_DIGEST_MISMATCH",
      "The quote response fields do not match their bound fixture digest.",
    );
  }
  if (
    input.chain.recent_blockhash !==
    input.message.decoded.recent_blockhash
  ) {
    throw new GuardError(
      "BLOCKHASH_BINDING_MISMATCH",
      "The chain evidence does not bind the message recent blockhash.",
    );
  }
}

function freshnessIssues(input, now) {
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new GuardError("CLOCK_INVALID", "Evaluation clock is invalid.");
  }
  const checks = [
    ["QUOTE_STALE", input.quote.observed_at, DEFAULT_FRESHNESS.quote_max_age_ms],
    [
      "WALLET_STALE",
      input.wallet.observed_at,
      DEFAULT_FRESHNESS.chain_max_age_ms,
    ],
    [
      "ASSET_STALE",
      input.assets.observed_at,
      DEFAULT_FRESHNESS.chain_max_age_ms,
    ],
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

import { digest } from "./canonical.js";
import { DECISIONS } from "./constants.js";
import { normalizeEvidence, allowedFixturePrograms } from "./evidence.js";
import { asGuardError } from "./errors.js";

export function evaluateProposal({
  plan,
  confirmationDigest,
  evidence,
  nonce,
  now = new Date(),
}) {
  const base = {
    plan,
    confirmation: {
      supplied_digest:
        typeof confirmationDigest === "string"
          ? confirmationDigest
          : digest("missing-confirmation"),
      matched: confirmationDigest === plan.policy_digest,
    },
    nonce,
    normalizedEvidence: null,
    checks: [],
  };
  if (confirmationDigest !== plan.policy_digest) {
    return {
      ...base,
      decision: decision(
        DECISIONS.BLOCK,
        "POLICY_CONFIRMATION_MISMATCH",
        "The authorization does not match the displayed mandate.",
        "Review and authorize the unchanged mandate again.",
      ),
    };
  }
  if (new Date(now).getTime() >= Date.parse(plan.policy.authorization.expires_at)) {
    return {
      ...base,
      decision: decision(
        DECISIONS.BLOCK,
        "MANDATE_EXPIRED",
        "The authorized mandate has expired.",
        "Create and authorize a fresh mandate.",
      ),
    };
  }

  let normalized;
  try {
    normalized = normalizeEvidence(evidence, plan, { now });
  } catch (error) {
    const typed = asGuardError(error, "EVIDENCE_INVALID");
    return {
      ...base,
      decision: decision(
        DECISIONS.REVIEW,
        typed.code,
        safeEvidenceReason(typed.code),
        "Refresh a complete, schema-valid proposal and evidence bundle.",
      ),
    };
  }
  const result = { ...base, normalizedEvidence: normalized };
  if (normalized.freshness_issues.length > 0) {
    return {
      ...result,
      decision: decision(
        DECISIONS.REVIEW,
        normalized.freshness_issues[0].code,
        "Fresh, matching chain, quote, reference, and simulation evidence was not available.",
        "Rebuild and re-simulate the exact message against a fresh blockhash.",
      ),
    };
  }
  const policy = plan.policy;
  const failures = [];
  const reviews = [];
  const checked = [];

  checkEqual(
    normalized.wallet.chain_id,
    policy.network.chain_id,
    "CHAIN_MISMATCH",
    "The evidence is for a different chain.",
    failures,
  );
  checkEqual(
    normalized.chain.chain_id,
    policy.network.chain_id,
    "CHAIN_MISMATCH",
    "The chain head is for a different network.",
    failures,
  );
  checkEqual(
    normalized.wallet.account,
    policy.authority.wallet_account,
    "WALLET_MISMATCH",
    "The proposal uses a different wallet.",
    failures,
  );
  checkEqual(
    normalized.assets.sell.caip19,
    policy.assets.sell.caip19,
    "SELL_ASSET_MISMATCH",
    "The sell asset identity does not match the mandate.",
    failures,
  );
  checkEqual(
    normalized.assets.buy.caip19,
    policy.assets.buy.caip19,
    "BUY_ASSET_MISMATCH",
    "The buy asset identity does not match the mandate.",
    failures,
  );
  if (normalized.assets.sell.token_extensions.length > 0) {
    reviews.push({
      code: "TOKEN_EXTENSION_UNSUPPORTED",
      reason: "The sell token has unreviewed Token-2022 extensions.",
    });
  }
  checkEqual(
    normalized.quote.builder,
    policy.route.allowed_builder,
    "BUILDER_MISMATCH",
    "The quote came from a builder outside the mandate.",
    failures,
  );
  checked.push(
    "wallet",
    "chain",
    "asset identity",
    "quote",
    "reference",
    "message bytes",
    "simulation",
  );

  const referenceMinimum = computeReferenceMinimum(
    normalized.reference.expected_receive_atomic,
    policy.economics.max_slippage_bps,
  );
  const authorizedMinimum =
    BigInt(referenceMinimum) >
    BigInt(policy.economics.minimum_receive_atomic)
      ? referenceMinimum
      : policy.economics.minimum_receive_atomic;
  if (
    BigInt(normalized.quote.minimum_receive_atomic) <
    BigInt(authorizedMinimum)
  ) {
    failures.push({
      code: "MINIMUM_RECEIVE_VIOLATED",
      reason:
        "The proposed minimum receive is below the user limit recomputed from independent reference evidence.",
    });
  }
  if (
    normalized.quote.price_impact_bps >
    policy.economics.max_price_impact_bps
  ) {
    failures.push({
      code: "PRICE_IMPACT_EXCEEDED",
      reason: "The quote exceeds the authorized price-impact limit.",
    });
  }
  if (
    BigInt(normalized.wallet.sell_balance_atomic) <
    BigInt(policy.economics.exact_sell_amount_atomic)
  ) {
    failures.push({
      code: "INSUFFICIENT_SELL_BALANCE",
      reason: "The wallet does not hold enough of the exact sell asset.",
    });
  }
  if (
    BigInt(normalized.wallet.native_fee_balance_atomic) <
    BigInt(normalized.simulation.network_fee_atomic)
  ) {
    failures.push({
      code: "INSUFFICIENT_FEE_BALANCE",
      reason: "The wallet does not hold enough SOL for the simulated fee.",
    });
  }
  if (
    BigInt(normalized.simulation.network_fee_atomic) >
    BigInt(policy.economics.max_network_fee_atomic)
  ) {
    failures.push({
      code: "NETWORK_FEE_EXCEEDED",
      reason: "The simulated network fee exceeds the authorized cap.",
    });
  }
  if (
    BigInt(normalized.simulation.priority_fee_atomic) >
    BigInt(policy.economics.max_priority_fee_atomic)
  ) {
    failures.push({
      code: "PRIORITY_FEE_EXCEEDED",
      reason: "The simulated priority fee exceeds the authorized cap.",
    });
  }
  if (!normalized.simulation.successful) {
    reviews.push({
      code: "SIMULATION_FAILED",
      reason: "The exact message did not complete successfully in simulation.",
    });
  }
  if (
    normalized.message.message_sha256 !==
    normalized.simulation.message_sha256
  ) {
    reviews.push({
      code: "SIMULATION_MESSAGE_MISMATCH",
      reason: "The simulation is not bound to the exact proposed message.",
    });
  }
  checkEqual(
    normalized.simulation.sell_debit_atomic,
    policy.economics.exact_sell_amount_atomic,
    "SELL_AMOUNT_MISMATCH",
    "The simulated sell debit differs from the exact authorized amount.",
    failures,
  );
  if (
    BigInt(normalized.simulation.buy_credit_atomic) <
    BigInt(authorizedMinimum)
  ) {
    failures.push({
      code: "SIMULATED_RECEIVE_VIOLATED",
      reason: "The simulated receive amount is below the authorized minimum.",
    });
  }
  checkEqual(
    normalized.simulation.recipient_account,
    policy.authority.wallet_account,
    "RECIPIENT_MISMATCH",
    "The simulated output is not returned to the authorized wallet.",
    failures,
  );
  if (normalized.simulation.unexpected_asset_deltas.length > 0) {
    failures.push({
      code: "UNEXPECTED_ASSET_DELTA",
      reason: "Simulation found an additional asset movement.",
    });
  }
  if (normalized.simulation.undecoded_instructions.length > 0) {
    reviews.push({
      code: "UNDECODED_SIMULATION_INSTRUCTION",
      reason: "Simulation contains an instruction that was not decoded.",
    });
  }
  inspectDecodedMessage(normalized.message.decoded, policy, failures, reviews);

  result.checks = checked;
  result.authorized_minimum_receive_atomic = authorizedMinimum;
  if (reviews.length > 0) {
    result.decision = decision(
      DECISIONS.REVIEW,
      reviews[0].code,
      reviews[0].reason,
      "Obtain a fully decoded, successfully simulated exact message and evaluate again.",
    );
  } else if (failures.length > 0) {
    result.decision = decision(
      DECISIONS.BLOCK,
      failures[0].code,
      failures[0].reason,
      "Change the proposal or authorize a new mandate. This proposal cannot be released.",
    );
  } else {
    result.decision = decision(
      DECISIONS.PASS,
      "SIMULATED_EXACT_PROPOSAL_PASS",
      "The exact fixture proposal satisfies every authorized constraint.",
      null,
    );
  }
  return result;
}

export function computeReferenceMinimum(referenceAtomic, maxSlippageBps) {
  const reference = BigInt(referenceAtomic);
  return (
    (reference * BigInt(10_000 - maxSlippageBps)) /
    10_000n
  ).toString();
}

function inspectDecodedMessage(message, policy, failures, reviews) {
  checkEqual(
    message.fee_payer,
    policy.authority.wallet_account,
    "FEE_PAYER_MISMATCH",
    "The message uses a different fee payer.",
    failures,
  );
  if (
    message.required_signers.length !== 1 ||
    message.required_signers[0] !== policy.authority.wallet_account
  ) {
    failures.push({
      code: "SIGNER_SET_MISMATCH",
      reason: "The message requires an unauthorized signer set.",
    });
  }
  if (
    message.address_lookup_tables.some((entry) => entry.resolved !== true)
  ) {
    reviews.push({
      code: "LOOKUP_TABLE_UNRESOLVED",
      reason: "An address lookup table was not fully resolved.",
    });
  }
  const allowed = allowedFixturePrograms();
  for (const instruction of message.instructions) {
    if (!allowed.has(instruction.program_id)) {
      reviews.push({
        code: "PROGRAM_NOT_ALLOWLISTED",
        reason: "The message calls a program outside the reviewed registry.",
      });
    }
    if (!instruction.decoder_id || !instruction.decoded_operation) {
      reviews.push({
        code: "INSTRUCTION_UNDECODED",
        reason: "A top-level instruction lacks a versioned decoder.",
      });
    }
    const operation = instruction.decoded_operation;
    if (
      ["approve", "delegate", "transfer", "bridge", "sign_message"].includes(
        operation.type,
      )
    ) {
      failures.push({
        code: "PROHIBITED_SIDE_EFFECT",
        reason: `The message contains a prohibited ${operation.type} operation.`,
      });
    }
    if (operation.type === "swap_exact_in") {
      checkEqual(
        operation.sell_amount_atomic,
        policy.economics.exact_sell_amount_atomic,
        "MESSAGE_SELL_AMOUNT_MISMATCH",
        "The message sell amount differs from the mandate.",
        failures,
      );
      checkEqual(
        operation.recipient_account,
        policy.authority.wallet_account,
        "MESSAGE_RECIPIENT_MISMATCH",
        "The message sends output to another recipient.",
        failures,
      );
    }
  }
  for (const program of message.inner_program_ids) {
    if (!allowed.has(program)) {
      reviews.push({
        code: "INNER_PROGRAM_NOT_ALLOWLISTED",
        reason: "Simulation contains an unreviewed inner program call.",
      });
    }
  }
}

function checkEqual(actual, expected, code, reason, collection) {
  if (actual !== expected) collection.push({ code, reason });
}

function decision(outcome, code, reason, recovery) {
  return { outcome, code, reason, recovery };
}

function safeEvidenceReason(code) {
  const known = {
    MESSAGE_DIGEST_MISMATCH:
      "The proposed message bytes do not match their supplied digest.",
    MESSAGE_DECODE_MISMATCH:
      "The decoded proposal does not match the bound message bytes.",
    UNKNOWN_FIELD:
      "The evidence contains a field outside the supported closed schema.",
    LIVE_EVIDENCE_UNAVAILABLE:
      "Live evidence is not enabled in this public release.",
  };
  return (
    known[code] ??
    "The Guard could not verify a complete, schema-valid evidence bundle."
  );
}

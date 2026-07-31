import { randomUUID } from "node:crypto";
import { assertExactKeys, digest } from "./canonical.js";
import { PUBLIC_BOUNDARY, SCHEMAS, SOLANA_PROFILE } from "./constants.js";
import { atomicToDecimal } from "./decimal.js";
import { GuardError } from "./errors.js";
import { validateIntent } from "./validation.js";

const PLAN_KEYS = [
  "schema_version",
  "plan_id",
  "created_at",
  "source_intent_digest",
  "intent",
  "policy",
  "policy_digest",
  "status",
  "boundary",
];

export function createPlan(
  input,
  {
    now = new Date(),
    id = randomUUID(),
  } = {},
) {
  const intent = validateIntent(input);
  const createdAt = new Date(now);
  if (!Number.isFinite(createdAt.getTime())) {
    throw new Error("now must be a valid date");
  }
  const expiresAt = new Date(
    createdAt.getTime() + intent.expires_in_seconds * 1000,
  );
  const policy = {
    schema_version: SCHEMAS.POLICY,
    action_type: "onchain.swap.exact_in",
    network: {
      chain_id: SOLANA_PROFILE.chain_id,
      chain_name: SOLANA_PROFILE.chain_name,
    },
    authority: {
      wallet_account: intent.wallet_account,
      recipient_must_equal_wallet: true,
    },
    assets: {
      sell: {
        caip19: SOLANA_PROFILE.sell_asset,
        symbol: SOLANA_PROFILE.sell_symbol,
        mint: SOLANA_PROFILE.sell_mint,
        decimals: SOLANA_PROFILE.sell_decimals,
      },
      buy: {
        caip19: SOLANA_PROFILE.buy_asset,
        symbol: SOLANA_PROFILE.buy_symbol,
        decimals: SOLANA_PROFILE.buy_decimals,
      },
    },
    economics: {
      exact_sell_amount_atomic: intent.sell_amount_atomic,
      exact_sell_amount_display: atomicToDecimal(
        intent.sell_amount_atomic,
        SOLANA_PROFILE.sell_decimals,
      ),
      minimum_receive_atomic: intent.minimum_receive_atomic,
      minimum_receive_display: atomicToDecimal(
        intent.minimum_receive_atomic,
        SOLANA_PROFILE.buy_decimals,
      ),
      max_slippage_bps: intent.max_slippage_bps,
      max_price_impact_bps: intent.max_price_impact_bps,
      max_network_fee_atomic: intent.max_network_fee_atomic,
      max_network_fee_display: atomicToDecimal(
        intent.max_network_fee_atomic,
        SOLANA_PROFILE.buy_decimals,
      ),
      max_priority_fee_atomic: intent.max_priority_fee_atomic,
      max_priority_fee_display: atomicToDecimal(
        intent.max_priority_fee_atomic,
        SOLANA_PROFILE.buy_decimals,
      ),
      held_funds_only: true,
    },
    route: {
      allowed_builder: intent.allowed_builder,
      allowed_program_ids: Object.values(
        SOLANA_PROFILE.fixture_program_registry,
      ),
      all_instructions_decoded: true,
      all_inner_instructions_decoded: true,
      address_lookup_tables_resolved: true,
    },
    prohibitions: {
      token_approvals_or_delegation: true,
      bridges: true,
      transfers: true,
      arbitrary_contract_calls: true,
      message_signing: true,
      scheduling: true,
      multi_action: true,
    },
    authorization: {
      use_count: 1,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
  };
  const policyDigest = digest(policy);
  return {
    schema_version: SCHEMAS.PLAN,
    plan_id: id,
    created_at: createdAt.toISOString(),
    source_intent_digest: digest(intent),
    intent,
    policy,
    policy_digest: policyDigest,
    status: "AWAITING_AUTHORIZATION",
    boundary: { ...PUBLIC_BOUNDARY },
  };
}

export function formatMandate(plan) {
  const policy = plan.policy;
  return [
    "MANDATE CAPTURED · AWAITING YOUR AUTHORIZATION",
    "",
    `Swap: exactly ${policy.economics.exact_sell_amount_display} ${policy.assets.sell.symbol} for at least ${policy.economics.minimum_receive_display} ${policy.assets.buy.symbol}`,
    `Network: ${policy.network.chain_name} (${policy.network.chain_id})`,
    `Wallet: ${shortAddress(policy.authority.wallet_account)}; output must return to the same wallet`,
    `Builder: ${policy.route.allowed_builder}; every Solana instruction and inner call must be decoded and allowlisted`,
    `Limits: ≤${policy.economics.max_slippage_bps} bps slippage; ≤${policy.economics.max_price_impact_bps} bps price impact; ≤${policy.economics.max_network_fee_display} SOL network fee; ≤${policy.economics.max_priority_fee_display} SOL priority fee`,
    "Forbidden: approvals/delegation, bridges, transfers, arbitrary programs, message signing, scheduling, or additional actions",
    `Validity: one use; expires ${policy.authorization.expires_at}`,
    "",
    'In an agent chat, send "Authorize this mandate" as a separate message.',
    "This CLI is non-interactive; authorization lets the agent submit one exact fixture to the separate simulate command.",
    "No PayBox call, signature, transaction, or money movement is available.",
  ].join("\n");
}

export function validatePlan(plan) {
  assertExactKeys(plan, PLAN_KEYS, "plan");
  if (plan.schema_version !== SCHEMAS.PLAN) {
    throw new GuardError("PLAN_SCHEMA_INVALID", "Plan schema is unsupported.");
  }
  if (
    typeof plan.plan_id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(plan.plan_id)
  ) {
    throw new GuardError("PLAN_ID_INVALID", "Plan identifier is invalid.");
  }
  const createdAt = new Date(plan.created_at);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    createdAt.toISOString() !== plan.created_at
  ) {
    throw new GuardError(
      "PLAN_CREATED_AT_INVALID",
      "Plan creation time must be a canonical ISO-8601 timestamp.",
    );
  }
  if (plan.status !== "AWAITING_AUTHORIZATION") {
    throw new GuardError(
      "PLAN_STATUS_INVALID",
      "Plan status must remain AWAITING_AUTHORIZATION before evaluation.",
    );
  }
  const intent = validateIntent(plan.intent);
  if (digest(intent) !== plan.source_intent_digest) {
    throw new GuardError(
      "PLAN_INTENT_DIGEST_MISMATCH",
      "The plan intent no longer matches its source digest.",
    );
  }
  const expected = createPlan(intent, {
    now: createdAt,
    id: plan.plan_id,
  });
  if (
    digest(plan.policy) !== plan.policy_digest ||
    plan.policy_digest !== expected.policy_digest
  ) {
    throw new GuardError(
      "PLAN_POLICY_DIGEST_MISMATCH",
      "The plan policy is not the closed policy derived from its intent.",
    );
  }
  if (digest(plan.boundary) !== digest(PUBLIC_BOUNDARY)) {
    throw new GuardError(
      "PLAN_BOUNDARY_MISMATCH",
      "The plan execution boundary was changed.",
    );
  }
  return plan;
}

function shortAddress(value) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

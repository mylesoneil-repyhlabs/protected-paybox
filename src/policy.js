import { randomUUID } from "node:crypto";
import { digest } from "./canonical.js";
import { PUBLIC_BOUNDARY, SCHEMAS, SOLANA_PROFILE } from "./constants.js";
import { atomicToDecimal } from "./decimal.js";
import { validateIntent } from "./validation.js";

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
    `Limits: ≤${policy.economics.max_slippage_bps} bps slippage; ≤${policy.economics.max_price_impact_bps} bps price impact; ≤${policy.economics.max_network_fee_display} SOL network fee`,
    "Forbidden: approvals/delegation, bridges, transfers, arbitrary programs, message signing, scheduling, or additional actions",
    `Validity: one use; expires ${policy.authorization.expires_at}`,
    "",
    'Reply "Authorize this mandate" to evaluate one exact simulated proposal.',
    "No PayBox call, signature, transaction, or money movement is available.",
  ].join("\n");
}

function shortAddress(value) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

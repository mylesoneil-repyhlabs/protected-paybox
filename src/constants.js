export const PRODUCT_NAME = "Protected PayBox";
export const VERSION = "0.5.0";

export const SCHEMAS = Object.freeze({
  INTENT: "protected-paybox.intent.v1",
  POLICY: "protected-paybox.policy.solana-exact-input-swap.v1",
  PLAN: "protected-paybox.plan.v1",
  EVIDENCE: "protected-paybox.evidence.solana-swap.v1",
  PROPOSAL: "protected-paybox.proposal.solana-message.v1",
  RECORD: "protected-paybox.record.v1",
  RECEIPT: "protected-paybox.local-checksum-receipt.v1",
  PAYBOX_SIGNING_HOOK: "protected-paybox.paybox-signing-hook.v1",
  CARD_INTENT: "protected-paybox.intent.card-purchase.v1",
  CARD_POLICY: "protected-paybox.policy.card-purchase.v1",
  CARD_EVIDENCE: "protected-paybox.evidence.card-purchase.v1",
  CARD_CHECKOUT: "protected-paybox.checkout.card-purchase.v1",
  CARD_PROVIDER_HOOK: "protected-paybox.paybox-card-hook.v1",
});

export const DECISIONS = Object.freeze({
  PASS: "PASS",
  BLOCK: "BLOCK",
  REVIEW: "REVIEW",
});

export const SOLANA_PROFILE = Object.freeze({
  chain_namespace: "solana",
  chain_reference: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  chain_id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  chain_name: "Solana Mainnet",
  sell_symbol: "USDC",
  sell_decimals: 6,
  sell_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  sell_asset:
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  buy_symbol: "SOL",
  buy_decimals: 9,
  buy_asset: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501",
  fixture_builder: "swaps.xyz",
  fixture_recent_blockhash:
    "4vJ9JU1bJJE96FWSJKvHsmmF94UyA4Q4xT7m7vYfCjBB",
  fixture_lookup_table:
    "7YttLkHDoNj9wyDur5NSVUtWcVwL7W7WvkkufBvZJf1",
  fixture_program_registry: {
    compute_budget: "ComputeBudget111111111111111111111111111111",
    system: "11111111111111111111111111111111",
    associated_token: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    spl_token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    jupiter_v6: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  },
});

export const PUBLIC_BOUNDARY = Object.freeze({
  paybox_oauth_used: false,
  paybox_contacted: false,
  paybox_oauth_available: true,
  authenticated_tool_discovery_available: true,
  remote_paybox_tool_calls_available: false,
  private_delta_used: false,
  signature_requested: false,
  transaction_broadcast: false,
  funds_moved: false,
  execution_available: false,
  payment_credential_requested: false,
  card_authorization_requested: false,
  statement:
    "FIXTURE EVALUATION ONLY · OPTIONAL PAYBOX OAUTH IS DISCOVERY-ONLY · NO PAYBOX TOOL CALL · NO CREDENTIAL OR AUTHORIZATION · NO SIGNATURE OR BROADCAST · NO ORDER · NO MONEY MOVED",
});

export const DEFAULT_FRESHNESS = Object.freeze({
  quote_max_age_ms: 10_000,
  chain_max_age_ms: 15_000,
  simulation_max_age_ms: 15_000,
  max_block_lag: 2,
});

export const PAYBOX_MCP_URL = "https://api.paybox.sh/mcp";

import { canonicalize, digest, digestBytes } from "./canonical.js";
import { SCHEMAS, SOLANA_PROFILE } from "./constants.js";

export const DEMO_WALLET =
  "8xQeWvG816bUx9EPjHmaT23yvVMQV4MfMjcnW8nx2Wn";

export function buildDemoIntent(overrides = {}) {
  return {
    schema_version: SCHEMAS.INTENT,
    action_type: "onchain.swap.exact_in",
    chain_id: SOLANA_PROFILE.chain_id,
    wallet_account: DEMO_WALLET,
    sell_asset: SOLANA_PROFILE.sell_asset,
    buy_asset: SOLANA_PROFILE.buy_asset,
    sell_amount_atomic: "5000000",
    minimum_receive_atomic: "25000000",
    max_slippage_bps: 50,
    max_price_impact_bps: 60,
    max_network_fee_atomic: "200000",
    max_priority_fee_atomic: "100000",
    allowed_builder: SOLANA_PROFILE.fixture_builder,
    expires_in_seconds: 120,
    ...overrides,
  };
}

export function buildDemoEvidence(
  plan,
  {
    scenario = "pass",
    now = new Date(),
  } = {},
) {
  const observedAt = new Date(now);
  if (scenario === "review-stale") {
    observedAt.setSeconds(observedAt.getSeconds() - 60);
  }
  const quoteExpiresAt = new Date(observedAt.getTime() + 10_000);
  const policy = plan.policy;
  const receiveAtomic =
    scenario === "block-minimum-receive" ? "24000000" : "26000000";
  const networkFee =
    scenario === "block-network-fee" ? "250000" : "120000";
  const priceImpact =
    scenario === "block-price-impact" ? 90 : 35;
  const recipient =
    scenario === "block-recipient"
      ? "7YttLkHDoNj9wyDur5NSVUtWcVwL7W7WvkkufBvZJf1"
      : policy.authority.wallet_account;

  const swapProgram =
    scenario === "review-unknown-program"
      ? "UnknownProgram11111111111111111111111111111"
      : SOLANA_PROFILE.fixture_program_registry.jupiter_v6;
  const innerPrograms =
    scenario === "review-hidden-inner-call"
      ? [
          SOLANA_PROFILE.fixture_program_registry.spl_token,
          "UnknownInner1111111111111111111111111111111",
        ]
      : [SOLANA_PROFILE.fixture_program_registry.spl_token];

  const decodedMessage = {
    schema_version: "protected-paybox.fixture-solana-message.v1",
    version: "v0",
    fee_payer: policy.authority.wallet_account,
    recent_blockhash: "FixtureBlockhash111111111111111111111111111",
    last_valid_block_height: "29000150",
    required_signers: [policy.authority.wallet_account],
    address_lookup_tables: [
      {
        table_account: "AddressTable111111111111111111111111111111",
        resolved: true,
        resolved_at_slot: "290000000",
        table_data_sha256: digest("fixture-address-table"),
      },
    ],
    instructions: [
      {
        index: 0,
        program_id:
          SOLANA_PROFILE.fixture_program_registry.compute_budget,
        decoder_id: "solana-compute-budget.v1",
        decoded_operation: {
          type: "set_compute_unit_price",
          maximum_priority_fee_atomic:
            policy.economics.max_priority_fee_atomic,
        },
      },
      {
        index: 1,
        program_id: swapProgram,
        decoder_id: "fixture-exact-in-swap.v1",
        decoded_operation: {
          type: "swap_exact_in",
          builder: policy.route.allowed_builder,
          sell_asset: policy.assets.sell.caip19,
          buy_asset: policy.assets.buy.caip19,
          sell_amount_atomic:
            policy.economics.exact_sell_amount_atomic,
          minimum_receive_atomic: receiveAtomic,
          recipient_account: recipient,
        },
      },
    ],
    inner_program_ids: innerPrograms,
  };
  const messageBytes = Buffer.from(canonicalize(decodedMessage), "utf8");
  const messageBase64 = messageBytes.toString("base64");
  const toolContract = {
    provider: "unverified-paybox-contract",
    tool_name: "paybox.wallet.sign_and_broadcast",
    schema_digest: digest({
      note: "Synthetic placeholder until authenticated PayBox tools/list is captured.",
    }),
    authenticated_schema_observed: false,
  };
  const quoteRequest = {
    chain_id: policy.network.chain_id,
    sell_asset: policy.assets.sell.caip19,
    buy_asset: policy.assets.buy.caip19,
    sell_amount_atomic: policy.economics.exact_sell_amount_atomic,
    recipient: policy.authority.wallet_account,
  };
  const quoteResponse = {
    builder: policy.route.allowed_builder,
    expected_receive_atomic: receiveAtomic,
    minimum_receive_atomic: receiveAtomic,
    price_impact_bps: priceImpact,
    expires_at: quoteExpiresAt.toISOString(),
  };

  return {
    schema_version: SCHEMAS.EVIDENCE,
    mode: "simulated_fixture",
    collected_at: observedAt.toISOString(),
    provenance: {
      authenticity: "SELF_REPORTED_FIXTURE",
      paybox_contacted: false,
      network_contacted: false,
      statement:
        "Locally generated fixture; not a PayBox, Swaps.xyz, or Solana response.",
    },
    tool_contract: toolContract,
    wallet: {
      account: policy.authority.wallet_account,
      chain_id: policy.network.chain_id,
      sell_balance_atomic: "25000000",
      native_fee_balance_atomic: "5000000",
      observed_at: observedAt.toISOString(),
    },
    assets: {
      sell: {
        caip19: policy.assets.sell.caip19,
        mint: policy.assets.sell.mint,
        decimals: policy.assets.sell.decimals,
        token_program:
          SOLANA_PROFILE.fixture_program_registry.spl_token,
        token_extensions: [],
      },
      buy: {
        caip19: policy.assets.buy.caip19,
        decimals: policy.assets.buy.decimals,
      },
      observed_at: observedAt.toISOString(),
    },
    chain: {
      chain_id: policy.network.chain_id,
      current_slot: "290000006",
      current_block_height: "29000100",
      blockhash_valid: true,
      observed_at: observedAt.toISOString(),
    },
    quote: {
      builder: policy.route.allowed_builder,
      request_digest: digest(quoteRequest),
      raw_response_digest: digest(quoteResponse),
      expected_receive_atomic: receiveAtomic,
      minimum_receive_atomic: receiveAtomic,
      price_impact_bps: priceImpact,
      observed_at: observedAt.toISOString(),
      expires_at: quoteExpiresAt.toISOString(),
    },
    reference: {
      source: "independent-reference-fixture",
      expected_receive_atomic: "26100000",
      observed_at: observedAt.toISOString(),
    },
    message: {
      format: "fixture_json_base64",
      message_base64: messageBase64,
      message_sha256: digestBytes(messageBytes),
      decoded: decodedMessage,
    },
    simulation: {
      message_sha256: digestBytes(messageBytes),
      context_slot: "290000006",
      successful: scenario !== "review-simulation-failed",
      error_code:
        scenario === "review-simulation-failed"
          ? "SIMULATED_PROGRAM_ERROR"
          : null,
      sell_debit_atomic: policy.economics.exact_sell_amount_atomic,
      buy_credit_atomic: receiveAtomic,
      recipient_account: recipient,
      network_fee_atomic: networkFee,
      priority_fee_atomic: "80000",
      unexpected_asset_deltas: [],
      undecoded_instructions: [],
      observed_at: observedAt.toISOString(),
    },
  };
}

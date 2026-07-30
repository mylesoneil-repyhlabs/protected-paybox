# Supported action surface

## Implemented

- Action: `onchain.swap.exact_in`
- Chain: Solana Mainnet only
- Sell: native Solana USDC mint, exact atomic amount
- Buy: native SOL asset
- Recipient: the same wallet only
- Builder: `swaps.xyz` fixture profile
- Validity: one use, 30–300 seconds
- Decisions: `PASS`, `BLOCK`, `REVIEW`
- Data: labeled local fixtures only

The Swaps.xyz builder is a fixture hypothesis derived from MoonPay's public
CLI skill. Authenticated PayBox routing has not been observed.

## Mandatory limits

Bind chain, wallet, exact assets, exact sell amount, minimum receive,
slippage, price impact, network fee, priority fee, builder, instruction
allowlist, nonce, and expiry.

Recompute the authorized minimum receive from independent reference evidence:

```text
floor(reference_receive × (10,000 − max_slippage_bps) / 10,000)
```

Use the stricter of that value and the user's explicit minimum.

## Unsupported

Reject approvals/delegation, bridges, transfers, arbitrary programs, hidden
inner instructions, unresolved lookup tables, token extensions, other asset
pairs, exact-output swaps, recurring actions, DeFi positions, x402, and
ecommerce.

# Supported action surface

## Card purchase — default demo

- Action: `commerce.card.purchase`
- Data: labeled local fixtures only
- Merchant model: exact key, domain, account reference, MCC fixture, and country
- Basket: 1–20 exact items; exact quantities; unit-price caps; scalar item
  attributes compatible with the generalized `/extract` contract
- Money: ISO currency and integer minor units; subtotal arithmetic; tax, tip,
  delivery, service, and all-in caps
- Fulfillment: delivery only; postal code plus an unsalted fixture address
  digest. Production requires an opaque saved-address reference or keyed digest
- Credential request: one-time virtual card fixture bound to merchant, exact
  total, currency, expiry, and use count
- Prohibitions: recurring/MIT/card-on-file/incremental/partial authorization,
  subscriptions, gift cards, cash equivalents, alcohol, and age-restricted
  items
- Decisions: `PASS`, `BLOCK`, `REVIEW`

Representative fixtures exist for DoorDash, Amazon, Uber, Instacart,
Walmart, and Target. They demonstrate schema portability only. They do not
prove a PayBox integration, ordering path, card acceptance, regional
eligibility, or merchant coverage.

## Swap — preserved narrow demo

- Action: `onchain.swap.exact_in`
- Chain/pair: Solana Mainnet fixture, native USDC to SOL only
- Recipient: same wallet only
- Builder profile: Swaps.xyz fixture hypothesis
- Validity: one use, 30–300 seconds

Authenticated PayBox routing has not been observed. Other assets, chains,
exact-output swaps, bridges, transfers, approvals, DeFi positions, x402, and
live execution remain unsupported.

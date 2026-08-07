# Supported action surface

## PayBox account connection — live discovery only

- OAuth: authorization code with PKCE S256 against the pinned PayBox issuer and
  MCP resource
- Scope: `mcp` only; no `offline_access` or refresh token
- Storage: access token and MCP session ID remain in process memory only
- Network actions: unauthenticated metadata discovery, dynamic public-client
  registration, token exchange, MCP `initialize`, `notifications/initialized`,
  paginated `tools/list`, and optional session close
- Registration precedes consent; every attempt may leave its reported named
  client and requires manual cleanup in PayBox Clients
- Output: bounded redacted snapshot; MCP callers receive stable aliases,
  provider-name digests, classifications, risk flags, and input/output schema
  digests, not raw remote names, descriptions, or schemas
- Disabled: every remote `tools/call`, including reads, credential listing,
  payments, claims, secrets, signing, swaps, x402, plugins, and account changes

OAuth proves account connectivity and authenticates the observed tool catalog.
`tools/list` reads the account-specific catalog and enabled-plugin configuration,
but no credential, balance, card-detail, or request-history resource. Name and
schema digests isolate raw provider text but are not confidential or
dictionary-resistant. `observed_at` is outside the deterministic snapshot
digest. Every discovered tool is unreviewed and mandate-gated; none is a safe
read. Discovery does not prove production Delta enforcement or authorize a
transaction because the runtime structurally omits upstream `tools/call`.

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

PayBox publicly documents arbitrary `request_swap`, but Protected PayBox does
not call it. Other assets, chains, exact-output swaps, bridges, transfers,
approvals, DeFi positions, x402, and live execution remain unsupported here.

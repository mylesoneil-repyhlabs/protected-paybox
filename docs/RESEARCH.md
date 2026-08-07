# Research

Observation date: 2026-08-07. Public documentation can change. Authenticated
discovery and an executed sandbox contract take precedence over this snapshot.

## Current PayBox MCP and OAuth contract

PayBox's current developer documentation identifies
`https://api.paybox.sh/mcp` as a streamable HTTP MCP endpoint using protocol
`2025-06-18`. It documents OAuth 2.1 authorization code with dynamic public-
client registration, PKCE S256, exact redirect matching, bearer tokens bound to
the MCP resource, and two scopes:

- `mcp` for MCP access; and
- optional `offline_access` for a refresh token.

Protected PayBox intentionally requests only `mcp`. It does not persist a token
or use PayBox's API key, SDK/CLI configuration, or `pbxk1.` signing key.

The official connector documentation lists core tools and says account/plugin
availability is discovered through `tools/list`. Protected PayBox can now
perform that authenticated discovery, but no live account discovery result is
committed to this repository. Tool presence for a particular user therefore
remains a runtime fact, not a repository claim. `tools/list` reads the
account-specific catalog and enabled-plugin configuration; it does not by
itself retrieve credentials, balances, card details, or request history.

Sources:

- [OAuth 2.1](https://docs.paybox.sh/connect/oauth)
- [MCP connector](https://docs.paybox.sh/connect/mcp)
- [MCP tools](https://docs.paybox.sh/reference/mcp-tools)
- [SDK and CLI](https://docs.paybox.sh/sdk-cli)

## PayBox card contract

The current developer reference publicly documents a card flow:

1. `list_credentials` returns credentials granted to the client. Card metadata
   may include brand, last four, and a `basis_theory_token_id`; PayBox warns the
   brand/last-four display values are client-attested and must not authorize an
   action.
2. `request_payment` accepts a granted card `credential_id`, merchant label,
   real HTTPS `merchant_url`, integer `amount_cents`, and ISO currency. The
   reference currently says USD only and that Basis Theory binds the one-time
   card to the merchant origin.
3. The request may complete or require passkey approval. The client submits
   once and polls `get_request`; it must not reissue the write request.
4. For approved/cardholder-verified payments,
   `claim_payment_credentials(request_id)` returns usable one-time virtual-card
   details once. A second claim fails.
5. The agent separately enters the card at the merchant checkout. PayBox's
   `request_payment` does not place the order, charge the merchant, or prove a
   purchase completed.

The documented autonomous mode may also return usable card authority directly
from `request_payment`. Any future adapter must route both that immediate output
and later `claim_payment_credentials` output directly to an isolated credential
broker or merchant executor, never through model context.

This is materially stronger public evidence than the older Help Center pages,
which still describe payment cards as Phase 2 or future. The two public surfaces
conflict. Protected PayBox treats the current developer reference as the current
API description while requiring authenticated `tools/list` and sandbox
execution before claiming that these tools are enabled for a particular
account.

The public developer reference still does not establish:

- the issuer, processor, card network contract, or all of Basis Theory's role;
- merchant, MCC, geography, cardholder, 3DS, or transaction-type coverage;
- successful DoorDash or other named-merchant checkout;
- an idempotency-key field for `request_payment`;
- authenticated merchant authorization/capture/refund events; or
- a mandatory third-party policy hook before issuance or one-time claim.

Sources:

- [MCP tools: request_payment and claim_payment_credentials](https://docs.paybox.sh/reference/mcp-tools#request_payment)
- [Request lifecycle](https://docs.paybox.sh/concepts/requests)
- [Older credential model](https://support.moonpay.com/en/articles/669779-paybox-store-credentials-once-let-ai-agents-pay-securely)
- [Older PayBox FAQ](https://support.moonpay.com/en/articles/669843-paybox-faqs)

Product conclusion: the card contract is publicly described, not unobserved.
Account availability and merchant execution remain unverified. Protected PayBox
therefore connects only to discover schemas and continues to use synthetic
card-decision fixtures.

## MoonAgents Card

MoonAgents Card is a separate crypto-funded virtual Mastercard debit product.
MoonPay's product page identifies Baanx as the card-service provider, Monavate
as issuer, and Mastercard as the network. Its Help Center identifies Veriff
identity checks, Solana USDC/XO funding, and no current US availability. The
Help Center describes online use wherever Mastercard is accepted while warning
that a merchant or transaction type may be unsupported.

Sources:

- [MoonAgents Card product page](https://www.moonpay.com/agents/card)
- [MoonAgents Card Help Center](https://support.moonpay.com/en/articles/629708/moonagents-card-crypto-funded-virtual-payment-cards)

Do not infer that PayBox `request_payment` uses the MoonAgents Card stack. Do
not use a reusable MoonAgents PAN in this demo or infer DoorDash coverage from
nominal Mastercard acceptance.

## DoorDash and merchant coverage

DoorDash remains the reference journey because restaurant, item, quantity,
modifier, destination, tax, delivery fee, service fee, tip, total, ETA, and
substitution constraints expose Delta's value beyond merchant and amount.

No reviewed primary evidence establishes a completed PayBox DoorDash payment.
The demo therefore uses a synthetic DoorDash-shaped checkout.

“Merchant coverage” requires five independently verified layers:

1. payment-rail acceptance in the user's region;
2. an agent-operable ordering path;
3. authoritative pre-release checkout evidence;
4. a mandatory Delta credential-release control point; and
5. authorization, capture, reversal, and refund evidence for reconciliation.

Basis Theory origin binding is relevant to layer one and the credential scope;
it does not by itself prove all five layers.

## Generalized evidence extractor

The Repyh evidence service accepts a `solution` plus requested scalar
attributes and returns a sparse evidence map. Its backend seam is suitable for
a future `paybox-card://request/<opaque-id>` resolver.

The existing product-page scraper is not binding payment truth: price is a
floating value and semantic extraction can be model-assisted. Protected PayBox
therefore limits this service to item semantics and requires authenticated
provider/merchant JSON for money and identity.

The current Delta HTTP evidence bridge consumes scalar boolean, integer, and
string values. Initial policies should use scalar aggregates; line-item list
support requires a deliberately versioned API change.

## Swaps

The developer reference now documents `request_swap` for exact-amount-in or
exact-amount-out swaps and bridges using CAIP-2 source/destination chains,
token addresses, smallest-unit decimal strings, slippage, recipient, and an
optional policy value. It says PayBox quotes through MoonX, the signing window
signs, PayBox broadcasts, and `get_request` progresses through signing,
confirmation, and possible cross-chain settlement.

This is public evidence of a generalized PayBox swap request surface, not proof
that every asset pair or chain is supported. Unsupported quotes fail at
request time, and enabled tools/plugins remain account/deployment specific.
Protected PayBox currently discovers the schema but cannot call it; its only
executable swap demonstration remains the offline USDC-to-SOL fixture.

Source:

- [MCP tools: request_swap](https://docs.paybox.sh/reference/mcp-tools#request_swap)

## Request lifecycle and enforcement implications

PayBox documents `pending_approval`, `pending_signature`,
`pending_settlement`, `pending_confirmation`, `success`, `denied`, and `error`.
Its central integration rule is submit once, then poll `get_request` with the
original `request_id`; reissuing a write call starts a second operation.

The documented grant/passkey policy is PayBox policy, not Delta policy. A Delta
integration must bind the exact PayBox request to authenticated external
evidence and require a fresh Delta decision before every irreversible release.
The official connector, SDK/CLI, and any other token-bearing client are bypass
paths unless PayBox enforces that check server-side.

Source:

- [Request lifecycle](https://docs.paybox.sh/concepts/requests)

## Partner questions

1. Which documented core and plugin tools appear for the pilot account?
2. Can Delta run mandatorily before both `request_payment` success and
   `claim_payment_credentials`?
3. Can PayBox bind a Delta proposal/proof digest to the exact credential ID,
   merchant origin, cents, currency, and request ID?
4. What alternate connector, REST, SDK, CLI, or internal paths could bypass the
   check?
5. Who tokenizes, issues, processes, and enforces merchant-origin/amount scope?
6. Is scope checked again at merchant authorization?
7. What are card, region, MCC, merchant, 3DS, and transaction restrictions?
8. Which authorization, capture, reversal, refund, dispute, and merchant-order
   facts are available and authenticated?
9. What are hook latency, availability, request identity, timeout, and
   uncertain-outcome semantics?
10. Can one sandbox journey prove request, approval, one-time claim, merchant
    authorization, reversal/refund, and exact Delta binding end to end?

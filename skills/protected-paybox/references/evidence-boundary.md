# Evidence and trust boundary

## Current build

The connector can authenticate to PayBox for session-only MCP capability
discovery. It cannot call any remote PayBox tool and receives no credential,
account balance, card, signature, transaction, or payment result. Authenticated
`tools/list` establishes only which schemas PayBox exposed to this client at one
time and which plugin configuration is enabled. That account-specific catalog
read does not retrieve credentials, balances, card details, or request history;
tool text and annotations remain untrusted. Name/schema digests are not
confidential or dictionary-resistant, and every discovered tool remains
unreviewed and mandate-gated.

The mandate harness still uses deterministic local fixtures. It does not
authenticate to a merchant, issuer, card network, generalized evidence
extractor, Swaps.xyz, chain RPC, or production Delta service. Fixture `PASS`
means only that one local proposal satisfied one local policy.

The local receipt binds the policy, confirmation, proposal, evidence,
checkout/message digest, decision, nonce, boundary, and expiry. It is an
unkeyed SHA-256 self-consistency checksum: an active editor can change the
record and recompute it. It is not a Delta signature or proof and does not
authenticate the source of facts.

## Card evidence classes

Use the generalized evidence extractor only for non-financial item semantics
such as category, dietary status, or product condition. Its current response
is a sparse scalar map. Missing or ambiguous required attributes produce
`REVIEW`. The fixture runtime recomputes the solution/request/response bindings
but has no source artifact, so it cannot authenticate semantic provenance.

Never authorize financial facts from an LLM/product-page extraction. A real
`PASS` needs provider- or merchant-authenticated merchant identity, exact
basket, subtotal, tax, fees, tip, total, currency, fulfillment, checkout
expiry, and staged credential-request bytes. It also needs a digest binding
that exact object to the eventual release.

PayBox's developer docs now describe Basis Theory tokenization,
`request_payment`, and one-time `claim_payment_credentials`; an older MoonPay
Help Center article still labels cards as a later phase. Neither source proves
availability for this account, supported merchants/regions, acceptance, or a
Delta hook. `request_payment` authorizes credential issuance; it does not
submit or confirm a merchant checkout. Authenticated account discovery must
resolve the rollout conflict.

## Required enforcement point

The mandatory hook belongs after PayBox authenticates the agent and forms the
exact payment credential request, but before it returns a scoped payment token
or one-time virtual card. PayBox must verify a fresh Delta decision bound to
the exact merchant, amount, currency, expiry, use count, checkout digest, and
credential-request digest. `BLOCK`, `REVIEW`, timeout, mismatch, reuse, or
expiry must prevent release.

Usable card authority returned immediately by an autonomous `request_payment`
and usable details returned later by `claim_payment_credentials` must both flow
directly to an isolated credential broker or merchant executor, never through
model context.

PayBox, its issuer/processor, or a merchant adapter must expose the available
post-authorization events needed to reconcile credential, authorization,
capture, reversal, refund, and merchant order IDs. The pilot must discover that
contract rather than assume PayBox owns every event. Events can detect
nonconformance and trigger recourse; they cannot retroactively block settled
money.

Without the mandatory hook and exclusive credentialed path, a skill or local
MCP is bypassable. This release therefore keeps every PayBox remote tool call
structurally unavailable and remains a partner-evaluation connector plus local
simulation.

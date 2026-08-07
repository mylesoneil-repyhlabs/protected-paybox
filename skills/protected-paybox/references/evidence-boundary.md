# Evidence and trust boundary

## Current build

The harness uses deterministic local fixtures. It does not authenticate to
PayBox, a merchant, an issuer, a card network, the generalized evidence
extractor, Swaps.xyz, or a chain RPC. Fixture `PASS` means only that one local
proposal satisfied one local policy.

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

PayBox public Help Center documentation says payment-card support is Phase 2.
No authenticated card MCP schema, provider, supported merchant list,
pre-authorization hook, or authorization/capture event schema was available
for this build.

## Required enforcement point

The mandatory hook belongs after PayBox authenticates the agent and forms the
exact payment credential request, but before it returns a scoped payment token
or one-time virtual card. PayBox must verify a fresh Delta decision bound to
the exact merchant, amount, currency, expiry, use count, checkout digest, and
credential-request digest. `BLOCK`, `REVIEW`, timeout, mismatch, reuse, or
expiry must prevent release.

PayBox, its issuer/processor, or a merchant adapter must expose the available
post-authorization events needed to reconcile credential, authorization,
capture, reversal, refund, and merchant order IDs. The pilot must discover that
contract rather than assume PayBox owns every event. Events can detect
nonconformance and trigger recourse; they cannot retroactively block settled
money.

Without the mandatory hook and exclusive credentialed path, a skill or local
MCP is bypassable and must remain a partner-evaluation simulation.

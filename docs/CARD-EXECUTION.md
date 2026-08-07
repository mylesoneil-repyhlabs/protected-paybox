# Card Execution Contract

## Current release

Card execution is intentionally absent. Protected PayBox may authenticate a
session and discover the account-specific PayBox tool catalog, but it has no
upstream `tools/call`. It does not call `list_credentials`, `request_payment`,
`claim_payment_credentials`, `get_request`, or `list_requests`.

The public financial composition root throws `PUBLIC_EXECUTION_LOCKED` before
reading options, credentials, or execution clients. No card is requested,
claimed, returned, entered at a merchant, authorized, captured, or refunded.

## Publicly documented PayBox card flow

The current PayBox developer reference documents this request sequence:

```text
list_credentials
  -> request_payment(credential_id, merchant, merchant_url, amount_cents, currency)
      -> success | pending_approval | denied | error
      -> if pending: surface approval_url and poll get_request(request_id)
      -> approved/cardholder-verified request
  -> claim_payment_credentials(request_id) once when ready to check out
  -> agent separately submits the one-time card to the merchant
  -> merchant, not request_payment, determines whether checkout succeeds
```

Documented `request_payment` fields:

| Field | Contract |
| --- | --- |
| `credential_id` | A granted card credential returned by `list_credentials` |
| `merchant` | Display/audit merchant label |
| `merchant_url` | Real HTTPS origin Basis Theory binds to the one-time card; it must not be synthesized from the label |
| `amount_cents` | Integer cents |
| `currency` | ISO 4217; currently USD |

`claim_payment_credentials` accepts the approved `request_id`, returns usable
one-time virtual-card details, and is consumed after one successful claim.
An autonomous `request_payment` may also return usable card authority
immediately. Both outputs cross a credential/PCI boundary and are deliberately
excluded from this release.

Public documentation is a contract baseline, not proof that these tools are
enabled for a particular account or that a named merchant accepts the card.
Authenticated `tools/list` must confirm availability, and a sandbox transaction
must establish behavior.

## Required Delta control point

Delta must be mandatory before the first path that can release usable payment
authority. Because PayBox says an autonomous `request_payment` may return a card
immediately, gating only `claim_payment_credentials` is insufficient. The
strong integration is provider-side:

```text
PayBox receives exact request_payment intent
  -> protected gate loads authorized mandate and canonical checkout proposal
  -> authenticated financial evidence + source-bound semantic evidence
  -> Delta returns fresh signed PASS | BLOCK | REVIEW
  -> PayBox verifies exact binding and atomically consumes PASS
  -> only then may request_payment succeed or become approvable
  -> any later claim is bound to the same request_id and one-use decision
```

Human passkey approval is an additional PayBox control, not a substitute for
Delta's mandate evaluation. `BLOCK` or `REVIEW` cannot be upgraded to Delta
`PASS` merely because the user follows an approval URL.

The official PayBox connector, SDK/CLI, REST path, and any other client are
bypass routes unless the same provider-side check is mandatory. A downloadable
skill or local MCP cannot enforce exclusivity.

## Canonical action binding

Basket semantics need not pass through PayBox. A merchant/evidence component
supplies them to the protected gate and produces an evidence digest. The
provider-facing action must at minimum bind the exact documented PayBox fields
plus internal ownership and evidence references:

```json
{
  "intent_id": "opaque",
  "proposal_id": "opaque",
  "proposal_digest": "sha256",
  "checkout_snapshot_sha256": "sha256",
  "evidence_bundle_digest": "sha256",
  "paybox_request": {
    "credential_id": "opaque-internal-reference",
    "merchant": "Acme",
    "merchant_url": "https://merchant.example",
    "amount_cents": 2650,
    "currency": "USD"
  }
}
```

This wrapper is a proposed Protected PayBox canonical record, not the current
PayBox request schema. Additional merchant/MCC/country, delivery, recurring,
card-on-file, incremental, partial, and line-item fields require authenticated
evidence and a versioned partner contract rather than invented PayBox fields.

The commit operation should accept only an internal proposal/action ID. The
gate loads the stored proposal and constructs `request_payment`; it must not
accept a second caller-supplied amount, merchant, URL, currency, destination,
or basket.

The compact Delta release token binds the same intent, proposal, checkout,
evidence, merchant origin, cents, currency, decision ID, expiry, reason codes,
proof, and signature. PayBox verifies signature, audience, freshness, exact
field equality, and one-use state without receiving the underlying basket.

## Submit once, poll, and uncertain outcomes

PayBox's documented rule is: call a write tool once, retain its `request_id`,
and poll `get_request`. Recalling `request_payment` starts another operation and
can create a second payment request.

Before the first submission, an enforceable gate must atomically:

1. verify ownership, mandate freshness, unused state, and fresh Delta `PASS`;
2. persist the exact request digest and local attempt identity;
3. journal `prepared -> submitted`; and
4. submit exactly once.

After any response that might have created a request, recovery must locate and
poll that original request. The public `request_payment` schema does not expose
an idempotency-key field, so provider request-identity and lookup semantics are
an explicit partner dependency. Until they are proven, a timeout is `REVIEW`
and never permission to submit again.

Required properties:

- same PayBox `request_id` is polled to terminal state;
- changed canonical request requires a new mandate evaluation;
- concurrent release permits exactly one local lease;
- crash after journaling resumes lookup/reconciliation, not submission;
- expired or revoked mandate cannot consume a historical `PASS`; and
- unknown provider state remains `REVIEW`.

## Approval, claim, and secret handling

For `pending_approval`, surface only PayBox's approval URL and wait for a
terminal request state. Approvals are operation-bound; do not treat an approval
for one request as authority for changed parameters.

Usable card authority returned immediately by an autonomous `request_payment`
must be intercepted before it can enter model context. A later one-time claim
must occur only when the merchant checkout is ready. A production design must
route both outputs directly to an isolated credential broker or merchant
executor, keep PAN/CVV/expiry outside model context and logs, minimize lifetime,
prevent a second claim, and bind the claim to the same Delta-authorized request.
Protected PayBox v0.5 deliberately does not implement this PCI-scoped component.

## Lifecycle evidence

The public PayBox request lifecycle establishes request-level statuses:

```text
pending_approval -> success | denied | error
```

It does not by itself prove merchant authorization, capture, reversal, void,
refund, dispute, delivery, or order status. PayBox, its card/provider stack, or
a merchant adapter must supply whichever authenticated events the pilot can
actually support. Each event ID should be unique and append-only; out-of-order
events must reconcile against provider timestamps and the original proposal.

Post-authorization mismatch cannot retroactively block money that moved. It
produces nonconformance evidence and triggers the available cancellation,
refund, freeze, dispute, or guarantee workflow.

## Release gate

Protected PayBox may claim bypass-resistant card protection only after:

- authenticated discovery confirms the card tools for the pilot account;
- the Delta hook is mandatory before every immediate or approved credential
  release, including one-time claim;
- official connector, REST, SDK/CLI, plugin, and internal mutation paths cannot
  bypass it;
- provider-authenticated request fields and checkout evidence are bound to the
  exact proposal;
- real Delta proof verification passes with pinned released dependencies;
- one-use, concurrent request, timeout, crash, polling, and one-time claim tests
  pass against durable storage;
- card material remains outside model/log context;
- request and merchant lifecycle evidence reconcile deterministically; and
- at least one end-to-end sandbox merchant authorization and reversal/refund is
  independently verified.

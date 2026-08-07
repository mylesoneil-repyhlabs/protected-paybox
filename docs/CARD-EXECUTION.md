# Card Execution Contract

## Current release

Card execution is intentionally absent. The public composition root throws
`PUBLIC_EXECUTION_LOCKED` before reading options, credentials, or network
clients. The runtime never requests a payment credential or card authorization.

## Required PayBox control point

Real enforcement belongs after PayBox authenticates the client and builds the
exact credential request, but before PayBox releases a scoped token or virtual
card.

Basket semantics do not need to pass through PayBox. A merchant/evidence
component supplies them to the protected gate and produces a checkout/evidence
digest. PayBox supplies only its authenticated, PAN-free credential envelope
and opaque bindings. The proposed PayBox request is:

```json
{
  "operation_id": "opaque",
  "agent_client_id": "opaque",
  "grant_id": "opaque",
  "intent_id": "opaque",
  "proposal_id": "opaque",
  "proposal_digest": "sha256",
  "checkout_snapshot_sha256": "opaque-sha256-binding",
  "merchant": {
    "canonical_id": "opaque",
    "domain": "merchant.example",
    "mcc": "5812",
    "country": "US"
  },
  "payment": {
    "amount_minor": "2650",
    "currency": "USD",
    "recurring": false,
    "merchant_initiated": false,
    "card_on_file": false,
    "incremental": false,
    "partial": false
  },
  "requested_scope": {
    "merchant_ids": ["opaque"],
    "max_amount_minor": "2650",
    "currency": "USD",
    "expires_at": "RFC3339",
    "use_count": 1
  },
  "evidence_bundle_digest": "opaque-sha256-binding"
}
```

The compact Delta release token binds the same intent, proposal, checkout,
evidence, merchant, and payment envelope, plus decision ID, expiry, reason
codes, proof, and signature. PayBox verifies this token without receiving the
underlying basket or source artifacts.

PayBox must verify signature, audience, freshness, exact field equality, and
one-use state. Only an exact unconsumed `PASS` permits credential release.

## Canonical-action rule

The commit operation accepts only an internal action or intent ID. The gate
loads the stored proposal and constructs the PayBox request itself. It must not
accept a second caller-supplied amount, merchant, currency, or destination.

The PayBox operation ID, if its authenticated contract exposes one, plus the
checkout digest become the canonical solution. The commit semantic payload must
exactly equal the evaluated proposal.

## Idempotency and uncertain outcomes

Before contacting PayBox, the gate atomically:

1. verifies ownership, mandate freshness, unused state, and fresh Delta success;
2. allocates a provider idempotency key;
3. persists the exact request digest; and
4. journals `submitted -> releasing`.

If PayBox times out or returns an ambiguous error, the gate queries by the same
idempotency key. It never submits a new credential request until the original
outcome is reconciled.

Rules:

- same key + same request returns the stored result;
- same key + changed request is blocked;
- concurrent release permits exactly one lease;
- crash after journaling resumes reconciliation;
- expired or revoked mandate cannot consume a historical `PASS`; and
- unknown provider state is `REVIEW`, not retry permission.

Pilot latency targets, subject to PayBox validation, are p95 at or below 500 ms,
p99 at or below 1,000 ms, and a 1,500 ms hard hook deadline when evidence is
precomputed. Timeout or `REVIEW` blocks autonomous release. PayBox may route the
user to a separately authenticated passkey approval path; any credential issued
there is recorded as direct human approval, not upgraded into a Delta `PASS`.

## Lifecycle events

PayBox, its processor, issuer, or merchant adapter must provide whichever
authenticated events its actual contract supports for credential
issued/expired, authorization, capture, reversal, void, refund, and merchant
order status. The pilot must discover this contract rather than assume PayBox
owns every event. Each available event ID is unique and append-only.
Out-of-order events are reconciled deterministically against provider timestamps
and the original proposal.

Post-authorization mismatch cannot retroactively block money that moved. It
produces nonconformance evidence and triggers the supported cancellation,
refund, freeze, dispute, or guarantee workflow.

## Release gate

The demo may claim bypass-resistant card protection only after:

- the PayBox hook is mandatory for every relevant credential path;
- raw credential mutation tools are unavailable to the agent;
- provider-authenticated pre-release facts are bound to the exact proposal;
- real Delta proof verification passes with pinned released dependencies;
- one-use and concurrency tests pass against durable storage;
- timeout and crash reconciliation tests pass; and
- at least one end-to-end merchant authorization is independently verified.

# PayBox Enforcement-Hook Conformance

## Purpose

This document defines the common properties a future PayBox enforcement hook
must satisfy. Card credential release is the current priority; swap signing and
broadcast retain the same exact-binding rule.

No hook is connected in the current release.

## Common decision envelope

A release decision must bind:

- schema version and audience;
- decision, intent, policy, proposal, and evidence IDs/digests;
- exact provider action digest;
- authorized merchant/asset/payment envelope;
- evidence observation time and authority;
- decision issue and expiry time;
- one-use nonce or lease ID;
- decision outcome and stable reason codes;
- Delta proof; and
- Delta signature/key identity.

Unknown top-level fields are rejected. Exact integers, canonical identifiers,
and normalized timestamps are required.

## Card hook

Placement:

```text
PayBox authenticates client
  -> PayBox forms exact merchant/amount/currency credential request
  -> mandatory Delta hook
  -> exact fresh PASS consumed once
  -> scoped credential released
```

The hook must fail closed for `BLOCK`, `REVIEW`, missing proof, invalid
signature, stale decision, audience mismatch, proposal mismatch, checkout
mismatch, merchant/amount/currency mismatch, already-consumed lease, timeout,
or unknown provider state.

The released credential must be no broader than the authorized envelope. A
provider should ideally recheck merchant and amount at network authorization,
not only at credential issuance.

## Swap hook

Placement:

```text
PayBox builds exact unsigned transaction
  -> mandatory Delta hook
  -> exact fresh PASS consumed once
  -> PayBox signs and broadcasts those exact bytes
```

The preserved JSON schema and verifier bind reference, message, quote, chain,
simulation, amounts, assets, fees, and timestamps. They are local conformance
fixtures only.

## Required provider behavior

- No alternate raw credential/sign/broadcast path for the agent.
- Stable idempotency key per canonical action.
- Journal release intent before provider mutation.
- Query by idempotency key after timeout or ambiguous error.
- Exact replay returns stored result; changed replay is rejected.
- Concurrent requests consume at most one lease.
- Authenticated append-only lifecycle events.
- Provider request/response digests recorded without secrets.
- Explicit latency, availability, retry, and expiry contract.

## Card conformance cases

- exact merchant/amount/currency/use-count/expiry succeeds once;
- changed merchant, amount, currency, checkout, or proposal fails;
- recurring, MIT, card-on-file, incremental, or partial scope fails unless
  explicitly authorized;
- stale or missing evidence fails;
- `REVIEW` never releases;
- sequential and concurrent replay fail after one consumption;
- timeout reconciles without a second request;
- crash after journaling resumes reconciliation;
- authorization/capture/refund events bind back to the original proposal; and
- raw PAN/CVV never enters hook request, logs, or proof.

## Swap conformance cases

- exact claim verifies and consumes once;
- mutation of reference, message, quote, assets, amounts, fee, simulation, or
  timestamps fails;
- wrong audience or expired decision fails;
- signing/broadcast bytes differ from evaluated bytes fails; and
- timeout never produces a second broadcast.

## Claim gate

Protected PayBox may claim real enforcement only after a partner implementation
passes these cases against the actual PayBox path and the agent has no bypass.
Until then it remains a simulation-only pitch asset.

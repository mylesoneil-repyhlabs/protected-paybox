# PayBox Enforcement-Hook Conformance

## Purpose

This document defines the common properties a PayBox-side Delta enforcement
hook must satisfy. Card credential release is the current priority; swap
signing and broadcast retain the same exact-binding rule.

No hook is connected in the current release. Session-only OAuth and
authenticated `tools/list` discovery do not enforce these properties.

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
PayBox authenticates client and receives exact request_payment fields
  -> mandatory Delta hook
  -> exact fresh PASS consumed once
  -> request may become approvable or succeed
  -> any claim_payment_credentials is bound to the same request_id and PASS
  -> scoped one-time credential released once
```

The hook must fail closed for `BLOCK`, `REVIEW`, missing proof, invalid
signature, stale decision, audience mismatch, proposal mismatch, checkout
mismatch, merchant/amount/currency mismatch, already-consumed lease, timeout,
or unknown provider state.

The public PayBox fields are credential ID, merchant label, real HTTPS merchant
origin, integer cents, and currency. The hook must bind all of them. Because an
autonomous `request_payment` can return a credential immediately, checking only
the later claim is insufficient. The released credential must be no broader
than the authorized envelope. A provider should ideally recheck origin and
amount at merchant authorization, not only at credential issuance.
Usable card authority returned by that immediate success and usable details
returned later by `claim_payment_credentials` must both be routed directly to an
isolated credential broker or merchant executor, never through model context.

## Swap hook

Placement:

```text
PayBox receives exact request_swap intent and builds quote/transaction
  -> mandatory Delta hook
  -> exact fresh PASS consumed once
  -> signing window signs the exact approved action
  -> PayBox broadcasts and confirms that action
```

The preserved JSON schema and verifier bind reference, message, quote, chain,
simulation, amounts, assets, fees, and timestamps. They are local conformance
fixtures only.

## Required provider behavior

- No alternate official connector, REST, SDK/CLI, plugin, or internal
  credential/sign/broadcast path that can skip Delta.
- Stable provider request identity per canonical action. The public
  `request_payment` schema does not expose an idempotency key, so this requires
  partner confirmation.
- Journal release intent before provider mutation.
- Query by idempotency key after timeout or ambiguous error.
- Exact replay returns stored result; changed replay is rejected.
- Concurrent requests consume at most one lease.
- Authenticated append-only lifecycle events.
- Provider request/response digests recorded without secrets.
- Explicit latency, availability, retry, and expiry contract.

## Card conformance cases

- exact merchant/amount/currency/use-count/expiry succeeds once;
- exact merchant HTTPS origin and credential reference bind to the same
  request/proposal;
- changed merchant, amount, currency, checkout, or proposal fails;
- recurring, MIT, card-on-file, incremental, or partial scope fails unless
  explicitly authorized;
- stale or missing evidence fails;
- `REVIEW` never releases;
- sequential and concurrent replay fail after one consumption;
- timeout reconciles without a second request;
- crash after journaling resumes reconciliation;
- authorization/capture/refund events bind back to the original proposal; and
- one-time claim is consumed only after the bound `PASS`;
- immediate `request_payment` and later claim outputs bypass model context and
  reach only the isolated credential broker or merchant executor; and
- raw PAN/CVV never enters model context, hook request, logs, or proof.

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
Until then it provides authenticated contract discovery plus local simulation,
not protected execution.

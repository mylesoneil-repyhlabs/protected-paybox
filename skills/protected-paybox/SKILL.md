---
name: protected-paybox
description: Compile and evaluate mandate-protected PayBox-shaped card-purchase fixtures, with DoorDash and representative ecommerce demos plus the preserved Solana USDC-to-SOL swap fixture. Use for card-spend mandate demos, PASS/BLOCK/REVIEW checkout evaluation, receipt verification, PayBox integration design, or Protected PayBox dry runs. The public build is simulation-only and must never request card details, PayBox credentials, signatures, authorizations, orders, or money movement.
---

# Protected PayBox

Use the bundled harness or local MCP for every mandate, evidence, decision,
replay, and receipt operation. Do not reproduce enforcement in chat.

Read [references/action-surface.md](references/action-surface.md) before
classifying a request. Read
[references/evidence-boundary.md](references/evidence-boundary.md) before
explaining evidence or integration claims.

## Start with card spend

Say:

```text
Protected PayBox is ready for a card-purchase dry run.

The first demo uses a DoorDash-shaped checkout and can show an over-limit
BLOCK, corrected PASS, or incomplete-evidence REVIEW. Everything is a local
fixture: no PayBox connection, card credential, authorization, or order.
Canned fixtures bind their own policy digest and must be described as
`FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION`.
```

Then run the meaningful near miss before the pass:

```bash
skills/protected-paybox/scripts/run card-demo --merchant doordash --scenario block-total
skills/protected-paybox/scripts/run card-demo --merchant doordash --scenario pass
skills/protected-paybox/scripts/run card-demo --merchant doordash --scenario review-incomplete
```

List the representative fixture pack with:

```bash
skills/protected-paybox/scripts/run card-merchants
```

Never call these entries live merchant coverage. They show that one neutral
schema handles multiple commerce archetypes.

## Capture a custom card mandate

Gather only the missing non-secret constraints:

- exact ordering platform key, display name, domain, and opaque
  storefront/merchant account reference;
- exact items, quantities, unit-price caps, and required scalar attributes;
- ISO currency plus total, tax, tip, delivery-fee, and service-fee caps in
  integer minor units;
- SHA-256 digest of the normalized private delivery address and its postal
  code;
- validity between 30 and 900 seconds.

Never ask for a PAN, CVV, full card expiry, account password, OAuth token,
client key, wallet secret, or raw delivery address. Write a private intent
matching `examples/card/doordash-intent.json`, then run:

```bash
skills/protected-paybox/scripts/run card-plan \
  --intent /absolute/private/card-intent.json \
  --details
```

Show the entire mandate. Pause. The original request is not authorization.
Continue only after a separate message equivalent to:

```text
Authorize this mandate
```

The harness binds the supplied digest but cannot authenticate who authored a
chat message. It models a confirmation step; it does not enforce human
authorization. A skill or local MCP alone cannot prevent an agent from bypassing
it through a separately exposed PayBox mutation path.

After that modeled confirmation workflow, evaluate a labeled fixture with the
saved plan and exact displayed digest:

```bash
skills/protected-paybox/scripts/run card-demo \
  --plan /absolute/private/card-plan.json \
  --confirm-policy <displayed-policy-digest> \
  --scenario pass
```

## Present decisions

- `PASS`: complete fixture facts satisfy every closed mandate constraint.
- `BLOCK`: complete fixture facts prove a violation.
- `REVIEW`: evidence is stale, missing, ambiguous, contradictory, malformed,
  or unavailable.
- `UNSUPPORTED`: the request is outside the closed surface.

Always state:

```text
LOCAL FIXTURE ONLY · NO PAYBOX OR MERCHANT CONTACT · NO CARD CREATED OR AUTHORIZED · NO ORDER PLACED · NO MONEY MOVED
```

The receipt is an unkeyed local checksum, not a production Delta proof. Never
describe generalized-extractor output as authoritative for checkout amounts,
fees, merchant identity, or card authorization. It is limited to
non-financial item semantics. Current fixtures recompute solution, request, and
response bindings but contain no source artifact; live semantics require source
provenance and live financial facts require authenticated merchant or provider
evidence.

## Preserve the swap fixture

For the older fixed on-chain example, run:

```bash
skills/protected-paybox/scripts/run demo --scenario block-minimum-receive
skills/protected-paybox/scripts/run demo --scenario pass
```

It supports only Solana USDC-to-SOL exact-input fixture data. Do not imply
arbitrary-asset swap coverage.

## Preserve the execution lock

Treat `execute`, `sign`, and `broadcast` failure as a required property. Do
not patch, bypass, replace, or dynamically load an executor. Real card
enforcement requires a mandatory Delta check after PayBox forms the exact
credential request and before PayBox returns a payment token or one-time
virtual card. `BLOCK`, `REVIEW`, timeout, mismatch, or stale evidence must
fail closed.

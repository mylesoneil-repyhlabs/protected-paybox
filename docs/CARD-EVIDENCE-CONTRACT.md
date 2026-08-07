# Card Evidence Contract

## Scope

The card evidence contract normalizes a checkout and a proposed one-time
credential request before policy evaluation. The current accepted mode is only
`simulated_fixture`.

Schema identity:

```text
protected-paybox.evidence.card-purchase.v1
```

The machine-readable source of truth is
[`schemas/card-purchase-taxonomy.json`](../schemas/card-purchase-taxonomy.json).

## Required top-level sections

| Section | Purpose |
| --- | --- |
| `provenance` | Authority class and explicit network-contact flags |
| `provider_contract` | Exact local-fixture descriptor for the published PayBox card contract; no remote call |
| `merchant` | Canonical merchant key, domain, MCC, country, account reference |
| `checkout` | Snapshot ID, SHA-256, observation time, expiry |
| `items` | Exact lines plus extraction trace and scalar attributes |
| `pricing` | Currency and reconciled minor-unit components |
| `fulfillment` | Delivery type, address digest, postal code, estimate |
| `payment_request` | Credential type, scope, amount, currency, use count, expiry, flags |
| `risk` | Gift card, cash equivalent, alcohol, age restriction, subscription |

Unknown fields fail the closed schema. Monetary fields are non-negative integer
strings. Line totals, subtotal, and all-in total must reconcile exactly.

## Authority classes

The production design separates evidence into:

1. `USER_SIGNED`
2. `PROVIDER_AUTHENTICATED`
3. `MERCHANT_AUTHENTICATED`
4. `TRUSTED_CAPTURE`
5. `OBSERVED_UI`
6. `AGENT_ASSERTED`
7. `DERIVED`

Merchant identity, amount, currency, fees, tip, destination, and credential
scope require provider- or merchant-authenticated facts for a live `PASS`.
Agent assertions and model output can never upgrade themselves into financial
authority.

The current fixture contract deliberately requires
`SELF_REPORTED_FIXTURE` and `paybox_contacted`, `merchant_contacted`, and
`network_contacted` all set to false. It also binds an exact provider-contract
fixture descriptor. PayBox now publicly documents `request_payment` and
`claim_payment_credentials`; this evidence schema does not call them, ingest an
account-discovered schema, read credentials, or claim a card. Public
documentation and authenticated tool discovery do not upgrade fixture evidence
to provider-authenticated financial truth.

## Generalized evidence extractor

The compatible request is:

```json
{
  "solution": "https://merchant.example/product/opaque-id",
  "attributes": {
    "category": { "type": "string" },
    "contains_alcohol": { "type": "boolean" }
  }
}
```

The response is a sparse map of requested scalar attributes. Protected PayBox
reconstructs and verifies the request digest from the solution and requested
attribute types, recomputes the response digest from returned values, and binds
authority, confidence, missing attributes, warnings, and normalized values.

Permitted use: product category, dietary property, condition, seller, or other
non-financial semantics. Prohibited use: merchant identity, price, fees,
currency, authorization amount, provider status, or funds movement.

The current fixtures do not carry a source artifact and therefore do not prove
where a semantic value came from. A live adapter must add an authenticated or
reviewed source-artifact digest and field-level provenance before the evidence
can support an enforcement claim.

Missing requested attributes, warnings, or confidence below the release
threshold produce `REVIEW`.

## Snapshot binding

`checkout.snapshot_sha256` covers:

```text
merchant
items and extraction results
pricing
fulfillment
payment request
risk flags
```

Evaluation reconstructs this object and recomputes the digest. Any change after
snapshot formation returns `REVIEW/CHECKOUT_SNAPSHOT_DIGEST_MISMATCH` before
policy checks.

The resulting proposal additionally binds the checkout digest and normalized
evidence digest. The receipt binds both.

## Freshness

Checkout observation, checkout expiry, credential-request expiry, and top-level
collection time are validated. Future-dated, expired, or stale evidence returns
`REVIEW`. A refreshed checkout requires a new evaluation and new one-use
decision.

## Data minimization

- No PAN, CVV/CVC, full expiry, OAuth token, password, wallet key, or seed.
- Delivery address is represented in the fixture by an unsalted normalized
  SHA-256 digest plus postal code; the raw address is not stored. Production
  must use an opaque saved-address reference or keyed digest because an
  unsalted address digest can be guessable.
- Only policy-referenced item attributes should be requested.
- Logs and receipts use closed redacted objects.
- A production evidence service must add authentication, retention controls,
  service isolation, and field-level provenance.

## Decision classification

- `PASS`: complete, fresh, internally consistent evidence satisfies every
  mandate constraint.
- `BLOCK`: complete evidence establishes a concrete violation.
- `REVIEW`: evidence quality, authority, freshness, consistency, or provider
  state is insufficient to release safely.

# Security Boundary

## Current boundary

The release is an offline simulation. It has no PayBox OAuth flow, merchant
client, card credential, issuer client, wallet client, private Delta client,
signer, broadcaster, or execution adapter.

Every record fixes these claims to false:

```text
paybox_oauth_used
paybox_contacted
private_delta_used
signature_requested
transaction_broadcast
funds_moved
execution_available
payment_credential_requested
card_authorization_requested
```

Production composition throws `PUBLIC_EXECUTION_LOCKED` before reading options
or constructing a client. `execute`, `sign`, and `broadcast` commands must fail.

## What is protected locally

- Closed input shapes reject unknown fields.
- Policy and source-intent digests detect plan mutation.
- Checkout snapshot and evidence digests detect fact mutation.
- Receipt bindings detect record mutation.
- Exact replay converges on the stored result.
- A different successful nonce for the same one-use plan is blocked.
- Owner-only files and directories are used for managed install and state.
- Installer rejects unsafe relative roots, ancestor escapes, and symlinked
  source/managed directories.
- The MCP rejects credential-key aliases, private-key/JWT/bearer/token patterns,
  and Luhn-valid PAN-like values recursively without echoing them.
- Release scans reject common secret and live-integration patterns.

These controls protect the integrity of the local demonstration. They do not
authenticate the user, agent, provider, merchant, or publisher.

## Why a skill or MCP alone is not enforcement

Skills are instructions and an MCP is another callable tool. If the agent can
also call a raw PayBox credential, payment, signing, or broadcast tool, it can
bypass Protected PayBox. A local process also cannot force PayBox to consume its
decision.

Real bypass resistance therefore requires:

- one exclusive credentialed release path;
- a mandatory PayBox-side Delta check;
- exact binding from stored proposal to released credential;
- fresh signed proof verification;
- atomic one-use consumption; and
- fail-closed timeout and mismatch behavior.

## Threat model

| Threat | Current control | Partner requirement |
| --- | --- | --- |
| Prompt-injected agent skips the skill | Explicitly not prevented | Remove/gate alternate PayBox mutation paths |
| Agent changes merchant/amount after `PASS` | Snapshot/proposal/receipt digests | Commit derives provider request from stored proposal |
| Model invents price or merchant | Financial fixture authority is explicit; uncertainty is `REVIEW` | Authenticated merchant/provider artifact |
| Model misclassifies an item | Confidence/missing/warning checks | Source-bound extractor corpus and deterministic validation |
| Stale checkout reused | Expiry/freshness checks | Provider quote/authorization expiry and fresh Delta proof |
| Duplicate credential or charge | Local one-use history | Durable lease, provider idempotency, journal, reconciliation |
| Timeout causes blind retry | No live adapter | Query original operation by idempotency key |
| Wrong user supplies a matching digest in chat | Current limitation disclosed; called modeled confirmation, not authorization | Authenticated identity and signed mandate |
| Record checksum treated as proof | Explicit unkeyed-checksum wording | Signed, independently verified Delta proof |
| Raw card data leaks to model/logs | Prohibited schema and recursive MCP key check | PCI-scoped credential handling outside model context |
| Raw delivery address leaks | Fixture uses an unsalted digest plus postal code and discloses the limitation | Opaque saved-address reference or keyed digest, trusted client-side normalization, scoped retention |
| Provider webhook is forged/replayed | Not present | Authenticated unique event IDs and append-only journal |
| Dependency or CI drift | Zero runtime deps; immutable Action SHAs | Immutable Repyh pins and generated-contract drift checks |
| Release archive is altered | Checksum and cold validation | Publisher-authenticated signing/attestation if claimed |

## Evidence policy

Complete facts that violate the mandate are `BLOCK`. Missing, malformed,
stale, conflicting, low-confidence, or unauthenticated critical facts are
`REVIEW`. Neither `BLOCK` nor `REVIEW` releases a credential.

Critical financial evidence:

- canonical merchant and domain;
- amount and ISO currency;
- subtotal, tax, fees, discounts, and tip;
- destination digest;
- credential scope, expiry, and use count; and
- recurring/MIT/card-on-file/incremental/partial flags.

These fields must come from authenticated merchant, PayBox, processor, or
issuer artifacts in production. Generalized extraction is not sufficient.

## Credential handling

Never request, accept, store, log, or return:

- PAN or card number;
- CVV/CVC;
- full card expiry;
- account password;
- OAuth access or refresh token;
- provider client secret;
- wallet private key, seed phrase, or mnemonic; or
- reusable payment credential.

The intended PayBox integration uses opaque credential references and scoped
one-time outputs. The current model/MCP context includes exact fixture basket
data, scalar item attributes, merchant/storefront reference, amount components,
postal code, and an address digest. It does not include a raw address. Local
plans, records, and one-use history persist until the evaluator deletes its
private runtime state; there is no automated retention job in this release.
Production should minimize fields, use an opaque saved-address reference or
keyed digest, define retention/deletion, and keep payment credentials outside
model context.

## Receipt limitations

The local checksum verifies that a supplied record is internally consistent. It
does not prove:

- who authored or approved the mandate;
- that the evidence came from PayBox or a merchant;
- that Delta evaluated the action;
- that PayBox consumed the decision;
- that funds did or did not move outside this process; or
- that a release archive came from a particular publisher.

Production proof requires authenticated intent, authenticated evidence, a
signed Delta decision, independent signature/proof verification, exact PayBox
consumption, and lifecycle evidence.

## Release security gates

- full tests on supported Node versions;
- skill and plugin validation;
- metadata, local-link, and release-content checks;
- no dependency or action-tag drift;
- deterministic archive comparison;
- safe-path and symlink checks;
- restricted-`PATH` cold install;
- source deletion before installed doctor/card/MCP checks;
- checksum verification; and
- independent review of claim boundary and execution lock.

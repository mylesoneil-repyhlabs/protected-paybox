# Design

## Objective

Protected PayBox demonstrates how an agent purchase can be evaluated against a
human-authorized Delta mandate before a payment credential is released. The
current release is an offline partner-evaluation system; its production target
is a mandatory PayBox control point.

## Design principles

1. **The evaluated action is canonical.** A release path must load the stored
   action by ID and derive the provider request from it. It must not accept
   mutable merchant or amount fields at commit time.
2. **Evidence authority is explicit.** Model extraction can propose product
   semantics, but it cannot author financial truth.
3. **Uncertainty is not a policy violation.** Complete facts that violate a
   mandate produce `BLOCK`; stale, missing, conflicting, or untrusted facts
   produce `REVIEW`.
4. **Money is exact.** Every monetary value is an integer minor-unit string and
   checked with integer arithmetic.
5. **Release is one use.** A successful mandate can be consumed once. Exact
   replay returns the stored result; a different nonce is blocked.
6. **The local boundary is immutable.** The public composition root exposes no
   credential, signing, broadcast, network, or execution adapter.
7. **Claims follow evidence.** Merchant fixtures demonstrate schema coverage,
   not merchant integration or acceptance.

## Current flow

```text
natural-language task
  -> closed card intent
  -> canonical mandate + policy digest
  -> modeled matching confirmation digest (authorship unauthenticated)
  -> labeled checkout fixture
  -> schema, provenance, freshness, arithmetic, and snapshot validation
  -> deterministic policy checks
  -> PASS | BLOCK | REVIEW
  -> one-use local record + unkeyed checksum
  -> execution lock
```

The local MCP and CLI call the same policy, evidence, preflight, replay, and
receipt modules. Tool descriptions are not the control plane; runtime code is.

## Production target

```text
agent request
  -> PayBox authentication and grant check
  -> merchant checkout or staged authorization
  -> canonical action persisted by protected gate
  -> authenticated financial evidence + semantic evidence
  -> pinned Delta evaluation and signed proof
  -> atomic one-use release lease
  -> PayBox credential issuance
  -> network authorization/capture events
  -> deterministic reconciliation
```

The mandatory control point is after PayBox forms the exact credential request
and before it returns a token or virtual card. PayBox must have no other
credentialed path that can skip the decision.

## System actors

| Actor | Current release | Partner release |
| --- | --- | --- |
| User | Confirms a displayed digest in chat | Authenticates and signs/authorizes a reusable mandate |
| Agent | Calls local simulation tools | Proposes a purchase but cannot release credentials directly |
| Protected PayBox | Evaluates local fixtures | Owns canonical action, state, idempotency, and release lease |
| Delta | Not contacted | Evaluates signed intent/evidence and returns verifiable proof |
| Evidence layer | Interface-compatible fixture only | Resolves non-financial semantics with provenance |
| PayBox | Not contacted | Authenticates, stages the credential request, enforces decision |
| Merchant/processor | Not contacted | Supplies authoritative checkout and lifecycle facts |

## State model

The current runtime models `AWAITING_AUTHORIZATION`, evaluated decisions, and a
one-use history record. The partner design expands this to:

```text
DRAFT -> AWAITING_AUTHORIZATION -> OPEN -> PROPOSED -> EVIDENCE_READY
  -> EVALUATING -> PASS_RESERVED | BLOCKED | REVIEW_REQUIRED
  -> CREDENTIAL_ISSUING -> AUTH_PENDING
  -> AUTHORIZED | DECLINED | AUTH_UNKNOWN
  -> CAPTURED | VOIDED | REFUNDED
  -> RECONCILED | POST_AUTH_NONCONFORMANT | REVIEW_REQUIRED
```

`REVOKED` and `EXPIRED` are terminal before credential release. Unknown provider
outcomes require reconciliation by idempotency key; they are never blindly
retried.

## Trust boundaries

- Chat confirmation is not authenticated authorship.
- The MCP is local process code, not a tamper-resistant trusted execution
  environment.
- Fixture provenance is self-reported and cannot produce a live claim.
- The receipt checksum detects mutation only when the expected record is
  independently available.
- A skill cannot remove or gate another PayBox tool.
- Production enforcement requires the provider to consume a fresh signed Delta
  result at the exclusive release point.

See [Security boundary](SECURITY-BOUNDARY.md), [Card evidence
contract](CARD-EVIDENCE-CONTRACT.md), and [Card execution
contract](CARD-EXECUTION.md).

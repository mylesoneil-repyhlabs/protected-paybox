# Design

## Objective

Protected PayBox has two deliberately separate surfaces:

1. a connected, discovery-only PayBox client that lets a user authorize a
   session and inspect which MCP tools their account exposes; and
2. local card and swap fixtures that demonstrate the decisions a mandatory
   Delta gate could enforce.

The current release does not connect those surfaces. PayBox authentication is
not Delta enforcement, and a discovered PayBox financial tool is never called.

## Design principles

1. **Connectivity is not execution.** The only authenticated upstream MCP
   methods implemented are `initialize`, `notifications/initialized`, and
   paginated `tools/list`.
2. **The token is session-only.** Protected PayBox requests only `mcp`, rejects
   refresh tokens or broader returned scopes, and keeps the access token in
   process memory.
3. **Discovery is redacted.** Model-facing results contain stable aliases,
   provider-name digests, conservative classifications, risk flags, and
   input/output schema digests, not raw names, tokens, session IDs,
   descriptions, or full schemas. Digests isolate provider-controlled text but
   are not confidential or dictionary-resistant. Every discovered tool remains
   unreviewed and mandate-gated; no classification makes it a safe read.
4. **The evaluated action is canonical.** A future release path must load the
   stored action by ID and derive the provider request from it. It must not
   accept mutable merchant or amount fields at commit time.
5. **Evidence authority is explicit.** Model extraction can propose product
   semantics, but it cannot author financial truth.
6. **Uncertainty is not a policy violation.** Complete facts that violate a
   mandate produce `BLOCK`; stale, missing, conflicting, or untrusted facts
   produce `REVIEW`.
7. **Money is exact.** Every monetary value is an integer minor-unit string and
   checked with integer arithmetic.
8. **Release is one use.** A successful fixture mandate can be consumed once.
   Exact replay returns the stored result; a different nonce is blocked.
9. **Claims follow evidence.** Merchant fixtures demonstrate schema coverage,
   not merchant integration or acceptance.

## Current PayBox connection flow

```text
user asks to connect
  -> validate the PayBox OAuth challenge and pinned metadata
  -> register a public client with an exact 127.0.0.1 callback
  -> authorization-code flow with PKCE S256 and state
  -> user signs in, selects the grant, and approves only on PayBox
  -> exchange for an mcp-only access token
  -> retain token in memory; request no offline_access or refresh token
  -> MCP initialize + notifications/initialized + paginated tools/list
  -> conservative tool classification + deterministic input/output schema digests
  -> return a redacted summary with observed_at outside the snapshot digest
  -> discard the local token on disconnect, expiry, command exit, or process exit
```

The CLI command performs discovery and disconnects before it exits. The local
MCP server can retain the session only for that server process, until explicit
disconnect or token expiry. Dynamic registration happens before consent. Every
connect attempt may therefore leave its uniquely named PayBox client, including
when authorization or discovery fails; discarding the local token does not
revoke it. The user must revoke every reported name in PayBox Clients.

## Current fixture flow

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

The local MCP and CLI share policy, evidence, preflight, replay, receipt, OAuth,
and discovery modules. Tool descriptions are not the control plane; runtime
code omits every upstream `tools/call` implementation.

## Production target

```text
agent request
  -> PayBox authentication and grant check
  -> exact request_payment or request_swap intent
  -> canonical action persisted by protected gate
  -> authenticated financial evidence + source-bound semantic evidence
  -> pinned Delta evaluation and signed proof
  -> atomic one-use release lease
  -> mandatory PayBox-side proof verification
  -> credential release or signing only for the exact PASS action
  -> provider and merchant lifecycle evidence
  -> deterministic reconciliation
```

For cards, the public PayBox reference documents `request_payment` followed by
`get_request` and, for approved payments, one-use
`claim_payment_credentials`. Delta must be mandatory before the credential can
be issued or claimed. For swaps, it must be mandatory before signing and
broadcast. A raw PayBox connector available beside Protected PayBox remains a
bypass.

## System actors

| Actor | Current release | Enforceable partner release |
| --- | --- | --- |
| User | Authorizes a scoped PayBox client and/or confirms a displayed fixture digest | Authenticates and signs a reusable mandate |
| Agent | Calls connection/discovery and local simulation tools | Proposes an action but cannot reach an alternate mutation path |
| Protected PayBox | Holds one session token in memory, classifies tools, evaluates fixtures | Owns canonical action, state, idempotency, and release lease |
| Delta | Not contacted | Evaluates signed intent/evidence and returns verifiable proof |
| Evidence layer | Interface-compatible fixture only | Resolves non-financial semantics with source provenance |
| PayBox | Contacted for OAuth, client registration, MCP initialization, tool discovery, and optional session cleanup only | Enforces the Delta decision at every credential/signing boundary |
| Merchant/processor | Not contacted | Supplies authoritative checkout and lifecycle facts |

## State models

Connection state is intentionally small:

```text
DISCONNECTED -> AUTHORIZATION_PENDING -> CONNECTED -> DISCONNECTED
```

Expiry, denial, metadata mismatch, callback mismatch, or discovery failure
fails closed. The fixture runtime separately models `AWAITING_AUTHORIZATION`,
evaluated decisions, and one-use history. The partner design expands that to:

```text
DRAFT -> AWAITING_AUTHORIZATION -> OPEN -> PROPOSED -> EVIDENCE_READY
  -> EVALUATING -> PASS_RESERVED | BLOCKED | REVIEW_REQUIRED
  -> CREDENTIAL_ISSUING -> AUTH_PENDING
  -> AUTHORIZED | DECLINED | AUTH_UNKNOWN
  -> CAPTURED | VOIDED | REFUNDED
  -> RECONCILED | POST_AUTH_NONCONFORMANT | REVIEW_REQUIRED
```

`REVOKED` and `EXPIRED` are terminal before credential release. Unknown provider
outcomes require lookup of the original request; they are never resolved by
reissuing a write call.

## Trust boundaries

- A valid PayBox token authenticates the granted client; it does not prove that
  a proposed purchase or swap satisfies a Delta mandate.
- `tools/list` proves what PayBox described to this client at discovery time.
  It reads an account-specific catalog and enabled-plugin configuration, not
  credentials, balances, card details, or request history. Static classification
  does not prove runtime behavior or safety.
- Chat confirmation is not authenticated mandate authorship.
- The MCP is local process code, not a tamper-resistant execution environment.
- Fixture provenance is self-reported and cannot produce a live claim.
- The receipt checksum detects mutation only when the expected record is
  independently available.
- A skill cannot remove or gate the official PayBox connector or another client.
- Production enforcement requires PayBox to consume a fresh signed Delta result
  at an exclusive mutation point.

See [Security boundary](SECURITY-BOUNDARY.md), [Card evidence
contract](CARD-EVIDENCE-CONTRACT.md), and [Card execution
contract](CARD-EXECUTION.md).

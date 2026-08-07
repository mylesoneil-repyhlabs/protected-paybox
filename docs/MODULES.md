# Modules

## Composition

The project has no runtime dependencies. The CLI and local MCP share the same
policy and PayBox connection modules rather than duplicating logic.

| Path | Responsibility |
| --- | --- |
| `src/cli.js` | Thin command parsing, browser-authorization handoff, and private file handling |
| `src/mcp-server.js` | Local MCP protocol, closed tool schemas, connection lifecycle, sensitive-input rejection |
| `src/paybox-oauth.js` | Pinned OAuth metadata validation, public-client registration, PKCE S256, state, and mcp-only token exchange |
| `src/paybox-connection.js` | Loopback callback, memory-only token/session lifecycle, redacted status and summary |
| `src/paybox-mcp-client.js` | Authenticated upstream `initialize` and paginated `tools/list`; intentionally no `tools/call` |
| `src/paybox-discovery.js` | Bounded tool parsing, conservative risk classification, secret redaction, deterministic snapshot digest |
| `src/preflight.js` | Confirmation, replay, one-use fixture history, receipt assembly |
| `src/receipt.js` | Exact record bindings and local checksum verification |
| `src/card/catalog.js` | Load and validate the machine-readable taxonomy |
| `src/card/validation.js` | Closed intent, plan, attribute, merchant, currency validation |
| `src/card/policy.js` | Canonical card plan and display text |
| `src/card/evidence.js` | Provenance, arithmetic, freshness, snapshot normalization |
| `src/card/evaluator.js` | Deterministic `PASS/BLOCK/REVIEW` checks |
| `src/card/fixtures.js` | Labeled merchant/scenario fixtures |
| `src/card/report.js` | Card-specific text and HTML reporting |
| `src/integration/production-composition.js` | Fail-closed public financial-execution lock |
| `src/integration/paybox-hook-contract.js` | Preserved swap signing-hook claim verifier |
| `schemas/card-purchase-taxonomy.json` | Card evidence vocabulary and fixture catalog |

## Dependency direction

```text
CLI / local MCP
  -> PayBox connection
      -> OAuth discovery + PKCE public-client flow
      -> upstream MCP initialize + tools/list only
      -> redacted tool classifier
  -> card policy + fixtures
      -> preflight
          -> card evaluator
              -> card evidence + validation + taxonomy
          -> durable fixture history
          -> receipt
      -> report

production composition
  -> financial execution lock only
```

No policy or fixture module receives the PayBox access token. No module maps a
discovered tool to an upstream `tools/call`. This structural omission is the
current financial-execution boundary.

## OAuth and MCP invariants

- The issuer, resource, metadata, authorization, token, and registration URLs
  are pinned to `api.paybox.sh` and validated before authorization.
- Dynamic registration is public-client only and rejects returned client
  secrets or registration access tokens.
- The callback binds an ephemeral port on `127.0.0.1`, checks the exact Host,
  loopback peer, path, and constant-time state match.
- Only `mcp` is requested. A refresh token, identity token, or broader returned
  scope fails closed.
- Redirects, oversized responses, malformed metadata, unsupported protocol
  negotiation, repeated cursors, and excessive pagination fail closed.
- The upstream client accepts JSON or SSE responses and matches the exact
  JSON-RPC request ID.
- The model-facing authenticated tool summary exposes only aliases, name and
  input/output schema digests, classifications, and risk flags; it excludes raw
  names, descriptions, schemas, access tokens, authorization codes, PKCE
  verifier, and MCP session ID. The
  preceding authorization-start result includes the browser URL and therefore
  its public client ID, PKCE challenge, state, and loopback redirect.
- Aliases are derived from the provider-name digest, not discovery order. Name
  and schema digests isolate provider text but are not confidential or
  dictionary-resistant. `observed_at` is outside the deterministic snapshot
  digest, and every discovered tool remains unreviewed and mandate-gated.

## Card taxonomy boot behavior

`card/catalog.js` reads the taxonomy once at module load and fails closed if its
identity, category, action type, attribute table, fixture array, merchant key,
or domain uniqueness is invalid. Runtime code and tests use this single source
for the representative merchant list.

The v1 evidence schema still serializes a compatibility placeholder for the
provider contract. That label is fixture data, not the current PayBox research
conclusion: PayBox now publicly documents `request_payment` and
`claim_payment_credentials`, but this runtime does not consume either schema.

## Extension seams

An enforceable partner build should inject these interfaces at a composition
root that has no alternate mutation path:

- `StateStore`: intents, proposals, evidence, leases, attempts, requests,
  events;
- `Identity`: authenticated user/agent ownership and signatures;
- `DeltaClient`: submit, poll, fetch proof, verify proof;
- `EvidenceClient`: source-bound scalar attribute extraction and provenance;
- `MerchantAdapter`: staged checkout and authoritative merchant artifact;
- `PayBoxClient`: exact request creation, request polling, one-use credential
  claim, wallet signing/swap, and available lifecycle reads; and
- `Clock`: deterministic freshness and recovery tests.

Provider adapters must not own the verdict. Delta/policy evaluation operates on
the common evidence contract. PayBox's public `request_payment` fields are a
starting point, not the complete enforcement contract; exact hook placement,
idempotency, merchant settlement evidence, and proof consumption still require
partner agreement.

## Version pinning

A real Delta build should pin released, immutable Repyh revisions rather than
floating branches. The reference implementation currently uses Delta Mandate
v0.9.2 and Policy Engine v0.7.1 interfaces. Any contract change requires an
explicit Protected PayBox version and regenerated contract tests.

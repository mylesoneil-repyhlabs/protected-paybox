# Modules

## Composition

The project has no runtime dependencies. The CLI and MCP share the same modules
and do not implement duplicate policy logic.

| Path | Responsibility |
| --- | --- |
| `src/cli.js` | Thin command parsing and private file handling |
| `src/mcp-server.js` | MCP protocol, closed tool schemas, sensitive-field rejection |
| `src/preflight.js` | Confirmation, replay, one-use history, receipt assembly |
| `src/receipt.js` | Exact record bindings and local checksum verification |
| `src/card/catalog.js` | Load and validate the machine-readable taxonomy |
| `src/card/validation.js` | Closed intent, plan, attribute, merchant, currency validation |
| `src/card/policy.js` | Canonical card plan and display text |
| `src/card/evidence.js` | Provenance, arithmetic, freshness, snapshot normalization |
| `src/card/evaluator.js` | Deterministic `PASS/BLOCK/REVIEW` checks |
| `src/card/fixtures.js` | Labeled merchant/scenario fixtures |
| `src/card/report.js` | Card-specific text and HTML reporting |
| `src/integration/production-composition.js` | Fail-closed public execution lock |
| `src/integration/paybox-hook-contract.js` | Preserved swap signing-hook claim verifier |
| `schemas/card-purchase-taxonomy.json` | Card evidence vocabulary and fixture catalog |

## Dependency direction

```text
CLI / MCP
  -> card policy + fixtures
  -> preflight
      -> card evaluator
          -> card evidence + validation + taxonomy
      -> durable history
      -> receipt
  -> report

production composition
  -> execution lock only
```

Handlers translate input and render output. They do not decide policy.

## Card taxonomy boot behavior

`card/catalog.js` reads the taxonomy once at module load and fails closed if its
identity, category, action type, attribute table, fixture array, merchant key,
or domain uniqueness is invalid. Runtime code and tests use this single source
for the representative merchant list.

## Extension seams

The partner build should inject these interfaces at a composition root:

- `StateStore`: intents, proposals, evidence, leases, attempts, events;
- `Identity`: authenticated user/agent ownership and signatures;
- `DeltaClient`: submit, poll, fetch proof, verify proof;
- `EvidenceClient`: scalar attribute extraction and provenance;
- `MerchantAdapter`: staged checkout and authoritative merchant artifact;
- `PayBoxClient`: stage, commit, fetch by idempotency key, lifecycle events; and
- `Clock`: deterministic freshness and recovery tests.

Provider adapters must not own the verdict. Delta/policy evaluation operates on
the common evidence contract.

## Version pinning

A future real Delta build should pin released, immutable Repyh revisions rather
than floating branches. The reference implementation currently uses Delta
Mandate v0.9.2 and Policy Engine v0.7.1 interfaces. Any contract change requires
an explicit Protected PayBox version and regenerated contract tests.

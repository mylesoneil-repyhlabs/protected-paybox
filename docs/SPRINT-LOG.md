# Sprint Log

Current target: v0.5.0 session-only PayBox connection and authenticated discovery

## Discovery sprint

### PM

- Chose card purchases ahead of swaps.
- Defined DoorDash as the high-information reference journey.
- Defined merchant coverage as payment rail, ordering path, authenticated
  evidence, mandatory enforcement hook, and lifecycle events.
- Reconciled PayBox's current developer card contract with conflicting older
  Help Center Phase 2 wording and kept MoonAgents Card separate.
- Set the current financial-action claim to partner-evaluation simulation.

### Engineering lead

- Audited the Coinbase Gate architecture and exact dependency pins.
- Carried forward canonical-action execution, one-use leases,
  journal-before-release, idempotency, reconciliation, closed taxonomies, and
  explicit simulation/live boundaries.
- Defined the future PayBox hook after exact credential-request formation and
  before credential release.

### Backend/data

- Confirmed the generalized extractor is appropriate for scalar item semantics,
  not financial truth.
- Defined authenticated provider/merchant authority for money and merchant
  identity.
- Identified the scalar evidence limitation in the current Delta HTTP bridge.

### Product evidence

- Current PayBox developer reference: `request_payment` and one-time
  `claim_payment_credentials` are documented; merchant-origin binding names
  Basis Theory and currency is currently USD.
- Older PayBox Help Center: payment cards are described as Phase 2/future. This
  conflicts with the developer reference and is retained only as a source
  discrepancy.
- Authenticated pilot-account tool surface: not yet committed or verified.
- DoorDash/PayBox transaction: not observed.
- Live card integration claim: prohibited.

### Exit

Complete. Product boundary and partner dependencies are explicit.

## Card-core sprint

### PM requirements implemented

- Card is the default first-run surface.
- DoorDash meaningful near miss comes before corrected `PASS`.
- Six merchant profiles are labeled fixtures, never coverage.
- Every fixture decision states that the evaluation made no
  PayBox/card/order/network call. A separate discovery session may exist.
- Custom plans model a matching caller-supplied digest; canned fixtures are
  explicitly auto-bound with no user authorization.

### Designer requirements implemented

- Mandate display includes merchant, basket, component caps, destination digest,
  credential restrictions, prohibitions, validity, and exact next action.
- `BLOCK` explains the violated constraint and asks for checkout change or a new
  mandate.
- `REVIEW` explains the evidence problem and asks for refreshed evidence.
- Boundary wording is present in CLI, MCP, skill, README, and receipt.

### Engineering implemented

- Machine-readable `PAYBOX-CARD-PURCHASE` taxonomy.
- Closed card intent, plan, evidence, checkout, proposal, and record bindings.
- Exact minor-unit arithmetic and checkout snapshot digest.
- Deterministic merchant, basket, semantics, price, fee, tip, destination,
  payment-envelope, and risk evaluation.
- One-use persisted fixture history and exact replay convergence.
- Card-aware receipt and reporting.
- Dependency-free MCP with modern discovery and legacy compatibility.
- Sensitive credential-shaped argument rejection.
- Codex plugin manifest plus portable launcher.
- Managed installer and release payload extended for plugin, taxonomy, and card
  fixtures.

### QA implemented

- Happy-path `PASS` for all six representative merchants.
- Ten DoorDash `BLOCK` scenarios.
- Five DoorDash `REVIEW` scenarios.
- Confirmation mismatch, plan mutation, exact replay, second-use block, and
  credential absence.
- Modern MCP, legacy MCP, and sensitive-input rejection.
- Existing swap, receipt, signing-hook, installer, scanner, and execution-lock
  regression suites retained.

### Packaging bug found and fixed

The first full run exposed an installer regression: the new taxonomy was not in
the managed-copy allowlist, so the offline doctor check failed. The payload,
required-file list, archive allowlist, and downloaded-release test fixture were
updated. The targeted installer/card/MCP suite then passed 26/26.

### Candidate verification status

- initial full source suite: 142/142 passed before review;
- skill and plugin validators: passed before review;
- metadata, link, and content scans: passed before review;
- independent skeptical PayBox-owner, Delta CTO, and target-user reviews:
  completed with release blockers;
- mini-sprint runtime/documentation fixes: implemented; targeted card/MCP/
  replay/receipt/CLI suite passed 46/46;
- first re-gate surfaced temporal one-use, collection freshness, exact-title,
  CLI secret-ingress, MCP-version, and cold-gate issues;
- second mini-sprint added adversarial regression and concurrency coverage;
- a final property-name no-echo probe was fixed and regression tested;
- complete source suite: 155/155 passed;
- metadata, skill, plugin, link, content, shell-syntax, and diff gates: passed;
- final PayBox-owner, Delta CTO, and target-user re-gates: `GO`, with no open
  P0/P1 issues for the simulation-only partner release; and
- committed deterministic bundle, source-deletion cold install, PR and tag CI,
  annotated tag, release assets, checksum, and fresh re-download verification:
  passed for v0.4.0 at merge commit `eede8c8`.

## Account-connection sprint

### PM and design implemented

- The user authorizes only on PayBox; Protected PayBox never asks them to paste
  a password, passkey, token, card, API key, or signing key.
- Consent guidance says the client has already been registered, the `mcp` bearer
  has the full authority of every selected grant, and the user should select no
  credential if allowed; otherwise one least-sensitive non-secret evaluation
  credential with human approval for every operation and no raw secrets.
- Connection copy says exactly what is contacted and repeats that no PayBox
  financial tool can be called.
- Local disconnect is distinguished from manual server-side client revocation
  in PayBox Clients. Every attempt may leave its named registered client.
- Tool discovery is presented as an account-specific catalog and enabled-plugin
  configuration read, not a credential/balance/history read, transaction,
  merchant coverage, or Delta protection.

### Engineering implemented

- Pinned PayBox OAuth protected-resource and authorization-server discovery.
- Dynamic public-client registration with no client secret.
- Authorization code with PKCE S256, random state, and an exact ephemeral
  `127.0.0.1` callback.
- `mcp`-only authorization with memory-only access token; refresh token,
  identity token, confidential-client material, and returned scope escalation
  fail closed.
- Upstream streamable HTTP MCP `initialize`, `notifications/initialized`, and
  bounded paginated `tools/list` using protocol `2025-06-18`.
- Strict JSON/SSE media types, exact JSON-RPC ID matching, stable session-header
  handling, 401/403 distinction, streaming response limits, cursor-loop
  defense, and cleanup for replaced or failed upstream sessions.
- Monotonic connection generations and fail-fast connect/sync guards prevent a
  late token exchange or stale discovery result from surviving timeout,
  disconnect, or reconnect.
- Deterministic provider-authenticated tool snapshot with conservative
  read/prepare/sign/broadcast/combined-write/unknown classification.
- Model-facing summary limited to stable aliases, provider-name digests,
  classification, risk flags, input/output schema digests, and aggregate
  counts. No raw names, descriptions, full schemas, tokens, codes, client IDs,
  or MCP session IDs are returned. Name/schema digests are not confidential or
  dictionary-resistant. `observed_at` is outside the deterministic snapshot
  digest. Every discovered tool is unreviewed and mandate-gated; none is a safe
  read.
- No upstream `tools/call`, REST, SDK/CLI, credential/balance/request-history,
  payment, signing, swap, x402, or plugin-execution implementation.

### QA coverage added

- OAuth metadata, registration, URL construction, code exchange, PKCE/state,
  exact callback, timeout/denial, scope escalation, expiry, and redaction.
- Upstream MCP initialization, pagination, JSON/SSE, repeated cursor, page
  limit, protocol mismatch, authentication/permission failures, and cleanup.
- Connection lifecycle, process-only status, output minimization, and local MCP
  proof that no generic remote-call tool exists.
- Concurrent begin, timeout-during-exchange, disconnect-during-sync,
  reconnect-during-old-sync, repeated-sync cleanup, prompt-injection tool names,
  output-schema gaps, strict content types, session drift, and streaming
  oversize cancellation.

### Candidate verification status

Implementation and documentation are present in the v0.5.0 working tree. The
current full local suite passes 199/199 tests. Packaging, deterministic archive,
cold-install, and live PayBox
consent/discovery/disconnect/revoke gates must be recorded before publishing the
release. The live gate is non-financial and must not invoke any discovered
PayBox tool.

## Connection mini-sprint

Security and product reviewers must treat these as release blockers:

- any OAuth/token/session value reaching a model-facing result or saved file;
- any persistent refresh/API/signing credential;
- any upstream `tools/call` or financial-resource-read route;
- copy that calls OAuth connectivity Delta enforcement;
- copy that treats a documented tool as enabled for this account without
  authenticated discovery; or
- copy that equates local disconnect with server-side revocation.

## Card-core release record

Status: v0.4.0 published and independently re-downloaded; live integration
dependencies remain gated.

Review findings and fixes are recorded in
[Stakeholder reviews](STAKEHOLDER-REVIEWS.md). No release is final while a
reviewer identifies an unresolved product-truth or security blocker.

## Next sprint backlog

- Evidence Layer adapter for non-financial semantics.
- Reviewed source-artifact golden corpus and adversarial tests.
- Field-level provenance and source digests.
- Provider event simulator and reconciliation state machine.
- Five-layer merchant capability matrix.
- PayBox hook conformance server.
- Live discovery snapshot for the uniquely named evaluation client, stored only if
  it passes the redaction/content scan.
- Mandatory `request_payment` / one-time-claim Delta hook design based on the
  account-confirmed schema.

Financial resource reads, authenticated PayBox card execution, credential
claiming, and generalized swaps remain gated on an enforceable partner path,
authenticated evidence, and sandbox access. Public schemas and OAuth alone are
insufficient.

# Sprint Log

Current target: card-core release

## Discovery sprint

### PM

- Chose card purchases ahead of swaps.
- Defined DoorDash as the high-information reference journey.
- Defined merchant coverage as payment rail, ordering path, authenticated
  evidence, mandatory enforcement hook, and lifecycle events.
- Separated PayBox's publicly documented Phase 2 card plan from MoonAgents Card.
- Set the current claim to partner-evaluation simulation.

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

- Public PayBox Help Center: payment cards are Phase 2/future release.
- Authenticated PayBox MCP card schema: not observed.
- DoorDash/PayBox transaction: not observed.
- Live card integration claim: prohibited.

### Exit

Complete. Product boundary and partner dependencies are explicit.

## Card-core sprint

### PM requirements implemented

- Card is the default first-run surface.
- DoorDash meaningful near miss comes before corrected `PASS`.
- Six merchant profiles are labeled fixtures, never coverage.
- Every decision states no PayBox/card/order/network contact.
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
- committed deterministic bundle, source-deletion cold install, remote CI, and
  tag/asset verification: required before publication is complete.

## Mini-sprint

Status: reviewer blockers resolved; committed release verification in progress.

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

Authenticated PayBox card integration and generalized swaps remain gated on
partner schemas and access.

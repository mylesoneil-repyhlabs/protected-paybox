# Protected PayBox sprint log

Status: Sprint 1 planning  
Date: 2026-07-30

This log records implemented work and verified gates. Planned work is labeled
as planned and must not be described as shipped.

## Repository baseline

Verified current state:

- local Git repository exists;
- `skills/protected-paybox/SKILL.md` exists as a generic TODO scaffold;
- project, security, claim, and sprint documentation exists after this
  documentation change;
- package metadata, a launcher, canonical hashing, decimal helpers, fixed
  Solana constants, closed intent validation, and policy-plan construction
  exist as a partial Sprint 1 foundation;
- no README exists yet;
- the launcher is not yet usable end to end because its CLI and the remaining
  proposal/evidence/simulation/decision/receipt pipeline do not exist;
- no tests, installer, CI, adapter, release bundle, or GitHub release exists;
- no PayBox OAuth connection or authenticated tool inventory exists in this
  repository;
- no PayBox, chain, venue, RPC, or Delta call has occurred through this
  repository;
- no transaction has been prepared, simulated, signed, broadcast, or moved;
- no proposal has received `PASS`, `BLOCK`, or `REVIEW`.

## Sprint 1 — contract discovery and truthful simulation

State: planned; documentation in progress  
Target release: `v0.1.0`

### PM requirement

Prove one complete, understandable swap-mandate path without implying live
PayBox protection:

- Solana is the primary candidate because it best matches PayBox's launch
  emphasis.
- EVM is the documented fallback if PayBox does not expose enough Solana
  proposal detail before signing.
- The default product is credential-free simulation.
- The public build cannot sign or broadcast.
- A meaningful `BLOCK -> PASS` journey is required.

### Work completed

- Defined product truth, scope, user stories, chain-selection gate, evidence
  contract, architecture, three sprint gates, and stopping point.
- Defined the current and future security boundary.
- Created a claim ledger separating current facts, external PayBox statements,
  design targets, unknowns, and locked capabilities.
- Recorded the planned team loop and release gates.
- Partial concurrent Sprint 1 engineering established package/launcher
  scaffolding and deterministic canonical, decimal, validation, constants, and
  policy-plan modules. These modules are not yet an integrated product.

### Work not completed

- PayBox OAuth and authenticated `tools/list`;
- chain and venue selection;
- completed skill;
- complete schemas or deterministic compiler;
- fixture engine;
- decisions or receipts;
- nonce/history;
- tests or QA results;
- installer, CI, README, release archive, checksum, or GitHub publication.

### Team gate checklist

#### Product manager

- [x] Freeze initial product outcome and non-goals.
- [x] Define target persona and user stories.
- [x] Define Solana-first decision and EVM fallback.
- [ ] Capture authenticated PayBox contract with user authorization.
- [ ] Freeze exact chain, venue, route, and first demo economics.
- [ ] Approve public wording against implemented behavior.

#### Full-stack engineering lead

- [x] Define architecture and public execution lock requirement.
- [ ] Select committed reusable Coinbase Guard patterns.
- [ ] Define versioned schemas and module ownership.
- [ ] Review production-composition lock.
- [ ] Review integrated build against all acceptance criteria.

#### Senior full-stack engineer

- [ ] Implement skill workflow and managed runner.
- [ ] Implement compiler, validator, proposer, fixture pipeline, decision
      engine, receipt, nonce, history, and CLI.
- [ ] Implement compact presentation and details-on-demand.
- [ ] Ensure no sign or broadcast method exists.

#### Back-end data engineer

- [ ] Capture and hash authenticated PayBox `tools/list`.
- [ ] Classify each tool by mutation risk.
- [ ] Determine whether Solana exposes exact pre-sign route and transaction.
- [ ] Build versioned taxonomy and evidence schemas.
- [ ] Build realistic labeled fixtures and provenance.

#### DevOps engineer

- [ ] Add pinned runtime, dependency lock, CI, content scan, deterministic
      archive, checksum, and managed installer.
- [ ] Add restricted-`PATH` and source-deletion validation.
- [ ] Add independent GitHub re-download verification.

#### Designer and front-end engineer

- [ ] Design chat-native mandate, authorization, proposal, decision, impact,
      freshness, recovery, receipt, and boundary hierarchy.
- [ ] Test ordinary experience without hashes or file paths.
- [ ] Make simulation and no-sign state unmistakable.

#### QA specialist

- [ ] Build functional, adversarial, performance, privacy, installer, and
      release test matrices.
- [ ] Test early negative receipts, redaction-before-sealing,
      authorization-before-replay, nonce mismatch, and concurrency.
- [ ] Verify unsupported actions stop without substitution.

#### Target persona

- [ ] Complete fresh install and ordinary journey without coaching.
- [ ] Explain what was authorized, checked, decided, and not executed.
- [ ] Identify confusing approval or autonomy language.

### Sprint 1 release gate

- [ ] Authenticated tool inventory captured with no mutation.
- [ ] Solana selected or EVM fallback justified using the documented gate.
- [ ] Credential-free deterministic `BLOCK -> PASS` journey implemented.
- [ ] Every outcome has a verifiable redacted local receipt.
- [ ] No public sign or broadcast path is reachable.
- [ ] Full tests and validation pass.
- [ ] README describes only current verified behavior.
- [ ] Personal GitHub tag, archive, checksum, and independent re-download pass.

### Mini-sprint 1

State: not started

Required process:

1. QA and persona reproduce findings against the released candidate.
2. PM ranks integrity and safety defects before UX polish.
3. Team fixes false decisions, receipt/replay/privacy defects, incorrect
   boundaries, installer failures, and confusing flow.
4. Entire Sprint 1 gate reruns before Sprint 2.

## Sprint 2 — one live read-only swap preflight

State: planned  
Target release: `v0.2.0`

### PM requirement

Use authenticated PayBox facts, fresh route and chain evidence, and independent
simulation to evaluate one exact unsigned transaction. End before approval,
signature, or broadcast.

### Planned team work

- PM freezes the selected chain/venue profile and freshness limits.
- Engineering lead owns OAuth, network, and adapter boundaries.
- Senior engineer implements PayBox read/prepare, chain, route, decoder, and
  simulator adapters.
- Data engineer normalizes allowlisted facts and source times.
- DevOps adds provider contract, failure, privacy, and performance tests.
- Designer/front-end distinguishes dry run from read-only preflight.
- QA attacks route, transaction, source, schema, fee, replay, and mutation
  boundaries.
- Persona verifies the result is useful without confusing `PASS` with signing.

### Sprint 2 release gate

- [ ] Deterministic adapter owns authenticated PayBox reads.
- [ ] Credentials never enter chat, logs, receipts, history, artifacts, or Git.
- [ ] PayBox exposes exact unsigned bytes before signing.
- [ ] Complete transaction is decoded and simulated.
- [ ] All required economic and instruction constraints are checked.
- [ ] Any semantic mutation invalidates the result.
- [ ] Evidence failure returns `REVIEW`.
- [ ] Healthy-source p95 is at or below 12 seconds.
- [ ] No mutation, signature, broadcast, or money movement occurs.
- [ ] Full prior release gates, current README, and GitHub verification pass.

### Mini-sprint 2

State: not started

Focus on actual PayBox schema mismatches, decoder gaps, flaky sources, false
provenance, performance, redaction, output overload, and any accidental
mutation route. Re-run every Sprint 1 and Sprint 2 gate.

## Sprint 3 — PayBox signing-boundary conformance kit

State: planned  
Target release: `v0.3.0`

### PM requirement

Make the partnership ask executable: demonstrate the proof and one-use-grant
contract PayBox must enforce before signing, while keeping the public package
non-signing.

### Planned team work

- PM owns partner narrative, responsibilities, rollout, and success criteria.
- Engineering lead owns the production-shaped adapter and private-composition
  seam.
- Senior engineer builds conformance server, durable grant contract, and
  recovery state machine.
- Data engineer builds binding and reconciliation schemas.
- DevOps adds restart, concurrency, fault injection, and reproducible partner
  packaging.
- Designer/front-end creates the three-minute `BLOCK -> PASS -> mutation and
  replay rejected` demo.
- QA conducts independent enforcement-boundary and recovery review.
- Persona tests whether useful autonomy remains without approval on every
  in-policy candidate.

### Sprint 3 release gate

- [ ] Wrong wallet/client, changed bytes, expiry, proof mismatch, replay,
      concurrency, restart, and revocation all fail.
- [ ] One-use consumption is durable and atomic.
- [ ] Ambiguous broadcast enters reconciliation-only state.
- [ ] Conformance kit identifies and rejects raw alternate mutation paths.
- [ ] Public package remains unable to sign or broadcast.
- [ ] No production Delta, PayBox-native enforcement, liability, or mainnet
      protection claim appears.
- [ ] Documentation, README, package, tests, and GitHub release agree.

### Mini-sprint 3

State: not started

Incorporate independent security, PayBox-engineer, and persona findings.
Prioritize enforcement boundary, proof binding, replay, recovery, and claim
accuracy. Repeat every applicable gate before declaring the partner package
complete.

## Stopping point

The project stops after a patched `v0.3.0` partner-evaluation release with:

- one complete simulation;
- one real read-only preflight if PayBox exposes the required contract;
- `BLOCK`, valid candidate, mutation rejection, and replay rejection;
- reproducible personal-GitHub release;
- native PayBox signing-hook contract and conformance tests;
- no signing, broadcast, or money movement.

Taxonomy expansion requires new partner or user evidence. It is not an
automatic fourth sprint.

## Documentation rule

Before every feature push or release:

- README must be updated to verified current behavior;
- README must not narrate prior versions;
- historical decisions belong in this sprint log, release notes, tags, or a
  changelog;
- claim ledger and security boundary must be checked against the exact
  committed source and release archive.

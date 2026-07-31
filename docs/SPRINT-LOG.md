# Protected PayBox sprint log

Status: Sprint 1 through Mini-sprint 2 complete; Sprint 3 implementation
complete; committed archive verification and Mini-sprint 3 pending
Date: 2026-07-30

This log records implemented work and verified gates. Planned work is labeled
as planned and must not be described as shipped.

## Repository baseline

Verified current state:

- local Git repository exists;
- committed Sprint 1 baseline is `ff37db6`;
- the completed skill supports one strict simulated Solana Mainnet
  USDC-to-SOL action;
- the runner and CLI support `doctor`, `plan`, `demo`, `simulate`, and
  `verify`, plus offline `inspect-tools`;
- closed schemas, canonical hashing, integer atomic-unit arithmetic, policy,
  fixture evidence, evaluator, receipt, report, private file handling, nonce
  history, and execution lock are implemented;
- the strict custom fixture expresses exactly 25 USDC for at least 0.18 SOL,
  100 bps maximum slippage and price impact, 0.00005 SOL maximum network fee,
  0.00002 SOL maximum priority fee, same-wallet settlement, and 120-second
  validity;
- exact message bytes and decoded operations are bound;
- nonce semantics bind the entire evidence bundle;
- canonical one-use state blocks a second `PASS` for the same policy under a
  different nonce and cannot be redirected with a CLI history option;
- stale evidence and expired mandates are re-evaluated before replay;
- same-process and cross-process nonce once-write are atomic;
- the current full Node suite is 133/133 green, including 17/17 targeted
  managed-installer, 10/10 local signing-hook conformance, and 2/2
  release-content scanner tests;
- a private versioned managed installer implements exact per-file SHA-256
  verification, restricted-`PATH` discovery, idempotency, explicit verified
  upgrade, operation after extracted-source deletion, and separate
  product-level state that survives version changes;
- a closed local signing-hook hypothesis binds exact request and evidence
  digests, self-wallet semantics, market and fee limits, audience, time, and
  same-process one-use behavior;
- the production composition always throws `PUBLIC_EXECUTION_LOCKED` before
  inspecting its argument;
- skill, local-link, release-metadata, and source-content checks pass;
- same-commit/same-toolchain archive-repeatability and cold-install scripts
  exist, but no committed archive or independent Mini-sprint 3 verdict is yet
  recorded;
- README describes the current simulation-only product and no prior-version
  narrative;
- no PayBox OAuth connection or authenticated tool inventory exists in this
  repository;
- no PayBox, chain, venue, RPC, or Delta call has occurred through this
  repository;
- no real transaction has been prepared, simulated, signed, broadcast, or
  moved;
- an offline discovery module is integrated through `inspect-tools`; it reads
  only a saved capture, has no provider I/O or OAuth path, and has not captured
  an authenticated `tools/list`;
- `docs/SOLANA-EVIDENCE-CONTRACT.md` defines the implemented fixture profile
  and the separately proposed live evidence profile without claiming either
  PayBox support or source authenticity.

The local record checksum is unkeyed SHA-256. It detects accidental or
unrehashed mutation, but an active editor can modify the record and recompute
it. It is not a Delta signature, provider-authenticity proof, or adversarial
tamper protection.

## Sprint 1 — truthful simulation

State: complete in the shared tree
Version: `0.1.0`

### PM requirement

Prove one complete, understandable swap-mandate path without implying live
PayBox protection:

- Solana is the primary candidate because it best matches PayBox's launch
  emphasis.
- EVM remains the future fallback if PayBox does not expose enough Solana
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
- Implemented the complete credential-free fixture skill and deterministic
  harness.
- Added meaningful `BLOCK`, corrected `PASS`, and stale/invalid `REVIEW`
  paths.
- Added an unkeyed SHA-256 local self-consistency record for every supported
  outcome.
- Added exact byte, decoded-operation, evidence, decision, nonce, and boundary
  bindings.
- Added private owner-only plan, record, and nonce-history handling.
- Made all execution commands fail closed.
- Added current-only README and skill reference material.
- Verified the then-current Sprint 1 suite; the v0.2 direct pre-installer
  suite is now 104/104 green.

### Work not completed

- PayBox OAuth and authenticated `tools/list`;
- authenticated PayBox wallet, venue, route, quote, or unsigned-transaction
  evidence;
- live Solana RPC or network simulation;
- production Delta integration;
- PayBox signing or broadcast;
- a public GitHub tag, release archive, checksum, or independent re-download
  verified by this shared-tree sprint record.

### Team gate checklist

#### Product manager

- [x] Freeze initial product outcome and non-goals.
- [x] Define target persona and user stories.
- [x] Define Solana-first decision and EVM fallback.
- [x] Freeze exact fixture chain, assets, builder shape, and demo economics.
- [x] Approve public wording against implemented behavior.
- [ ] Capture authenticated PayBox contract with user authorization in
      Sprint 2.

#### Full-stack engineering lead

- [x] Define architecture and public execution lock requirement.
- [x] Select reusable Coinbase Guard patterns without importing its action
      surface.
- [x] Define versioned schemas and module ownership.
- [x] Review integrated simulation build and execution lock.

#### Senior full-stack engineer

- [x] Implement skill workflow and runner.
- [x] Implement compiler, validator, fixture pipeline, decision engine,
      receipt, nonce, history, and CLI.
- [x] Implement compact presentation and details-on-demand.
- [x] Ensure sign and broadcast commands always fail closed.

#### Back-end data engineer

- [x] Build versioned taxonomy and evidence schemas.
- [x] Build strict labeled Solana fixtures and explicit provenance.
- [x] Build the offline, bounded, redacted tool-risk classifier later
      integrated in Sprint 2.
- [ ] Capture and hash authenticated PayBox `tools/list` only in a separately
      authorized future live-integration phase.
- [ ] Determine whether PayBox exposes an exact pre-sign Solana route and
      transaction.

#### DevOps engineer

- [x] Add Node 22 runtime discovery and safe private runtime files.
- [x] Add automated tests and skill validation.
- [ ] Add release archive, checksum, managed installer, and independent GitHub
      re-download verification before public distribution.

#### Designer and front-end engineer

- [x] Design chat-native mandate, authorization, proposal, decision, impact,
      freshness, recovery, receipt, and boundary hierarchy.
- [x] Keep hashes and paths out of ordinary output.
- [x] Make simulation and no-sign state unmistakable.

#### QA specialist

- [x] Build functional, adversarial, privacy, replay, and concurrency tests.
- [x] Test checksum failures, redaction-before-checksum,
      authorization-before-replay, full-evidence nonce mismatch, stale and
      expired replay, and cross-process concurrency.
- [x] Verify closed action and evidence schemas reject substitutions and
      unknown fields.
- [x] Verify the v0.2 direct pre-installer suite is 104/104 green.

#### Target persona

- [x] Implement the approved Alex journey and plain-English boundary.
- [ ] Obtain direct external target-user feedback; no interview is claimed by
      Sprint 1.

### Sprint 1 product gate

- [x] Strict Solana fixture and 25 USDC custom intent are implemented.
- [x] Credential-free deterministic `BLOCK -> PASS` journey works.
- [x] Every supported outcome has a redacted local record with an unkeyed
      SHA-256 self-consistency checksum.
- [x] Exact decoded operation and message bytes are bound.
- [x] Full evidence is nonce-bound.
- [x] Stale and expired replay is prevented.
- [x] Same-process and cross-process once-write is atomic.
- [x] No public sign or broadcast path is reachable.
- [x] PayBox and all external networks remain uncontacted.
- [x] v0.2 direct pre-installer suite passes 104/104.
- [x] README describes only current verified behavior.
- [ ] Authenticated PayBox discovery remains a future live-integration gate.
- [ ] Public GitHub packaging and independent download verification are not
      claimed here.

### Mini-sprint 1

State: complete in the shared tree

Hardening completed:

1. Added the strict custom 25 USDC fixture path.
2. Bound builder, sell asset, buy asset, exact sell amount, minimum receive,
   recipient, compute operation, priority fee, canonical bytes, signer set,
   program set, inner calls, and lookup-table state.
3. Bound nonce semantics to policy, confirmation, and complete evidence,
   including quote, reference, simulation, and timestamps.
4. Re-evaluated mandate expiry and evidence freshness before replay lookup.
5. Added atomic owner-only cross-process once-write and worker-process tests.
6. Added offline PayBox discovery parsing, risk classification, redaction, and
   snapshot tests as the basis for Sprint 2.
7. Re-ran all v0.2 pre-installer gates: 104/104 green.

## Sprint 2 — offline tool-surface inspector and Solana evidence contract

State: complete
Version: `0.2.0`

### PM requirement

Turn the unknown PayBox action surface and the Solana evidence burden into
truthful partner artifacts without requesting credentials or implying a live
integration.

### Work completed

- Integrated `inspect-tools` into the CLI.
- Accepted bounded saved captures in direct-array, `{tools}`, and JSON-RPC
  `result.tools` shapes.
- Added conservative classification for `read`, `prepare`, `sign`,
  `broadcast`, `combined_write`, and `unknown`.
- Made destructive, deceptive, preparatory, schema-mutating, and unknown
  surfaces require a mandate gate.
- Redacted value-bearing examples and secret-shaped values before building a
  deterministic snapshot.
- Wrote optional snapshots as owner-only files with
  `offline_analysis: true` and `provider_authenticated: false`.
- Added a synthetic PayBox-shaped `tools/list` fixture without claiming it
  came from PayBox.
- Added `docs/SOLANA-EVIDENCE-CONTRACT.md`, separating implemented fixture
  profile `F1` from proposed live profile `L1`, including exact field
  bindings, freshness, authenticity tiers, and PayBox integration questions.
- Preserved the runtime execution lock and added no OAuth, MCP, PayBox,
  network, venue, chain, or Delta adapter.
- Kept the strict 25-USDC journey behind a saved `plan --intent` artifact and
  exact displayed policy digest; the direct custom-intent demo shortcut
  remains rejected.
- Removed caller-selected CLI history so canonical one-use state cannot be
  redirected. After one `PASS`, a different nonce for the same policy returns
  `BLOCK/PLAN_ALREADY_USED`.
- Recorded that the CLI cannot authenticate chat authorship and that a skill
  can be bypassed if raw PayBox mutation tools remain available.
- Re-ran the v0.2 direct pre-installer Node suite: 104/104 green.

### Team gate checklist

#### Product manager

- [x] Freeze offline-only Sprint 2 scope and current claim language.
- [x] Separate schema-risk inspection from authenticated provider behavior.
- [x] Keep live read-only preflight behind an explicit future evidence gate.

#### Full-stack engineering lead

- [x] Preserve the no-network and no-execution runtime boundary.
- [x] Review classifier outputs as hints, never enforcement or provider proof.
- [x] Keep the tool inspector disconnected from the evaluator.

#### Senior full-stack engineer

- [x] Add the `inspect-tools` CLI command and private snapshot output.
- [x] Preserve absolute-path, regular-file, symlink, and input-size controls.
- [x] Reject the removed direct custom-intent demo path and caller-selected
      history.

#### Back-end data engineer

- [x] Bound capture structure and tool metadata.
- [x] Redact value-bearing schema fields before snapshot output.
- [x] Produce a deterministic, sorted snapshot and digest.
- [x] Specify Solana `F1` and proposed `L1` evidence fields and source tiers.

#### DevOps engineer

- [x] Add CLI integration and owner-only output tests.
- [x] Add malformed, duplicate, ambiguous, deceptive, destructive, oversized,
      and redaction tests.
- [ ] Complete installer, release archive, checksum, and independent download
      verification in Sprint 3.

#### Designer and front-end engineer

- [x] Label ordinary output `OFFLINE CAPTURE ANALYSIS`.
- [x] State that classification is static analysis, not provider proof.
- [x] Keep OAuth, signature, broadcast, and transaction absence visible.

#### QA specialist

- [x] Run the v0.2 direct pre-installer suite: 104/104 green.
- [x] Complete independent Mini-sprint 2 review and documentation reconciliation.

#### Target persona

- [x] Make a static capture and live provider behavior distinguishable without
      reading the snapshot JSON.
- [x] Complete a target-persona review of the three-minute partner journey.
- [ ] Obtain direct external target-user feedback; none is claimed.

### Sprint 2 implementation gate

- [x] Offline inspector is reachable through the documented CLI.
- [x] Input and output are bounded, redacted, and deterministic.
- [x] A synthetic or caller-supplied capture is never labeled authenticated.
- [x] Unknown or risky tools fail closed as mandate-gated.
- [x] Solana evidence requirements and source-authenticity limits are explicit.
- [x] No credential, provider, network, signing, or broadcast path was added.
- [x] Public execution remains runtime-locked.
- [x] v0.2 direct pre-installer suite passes 104/104.

### Mini-sprint 2

State: complete

The independent review covered misleading names, descriptions, enum actions,
MCP annotations, schema-value leakage, malformed or oversized captures,
duplicate tools, owner-only output, alternate history redirection,
cross-process races, second-nonce rejection, and locked execution. The
target-persona review found no blocker for the local simulation-only partner
scope. Documentation was reconciled to distinguish the unkeyed checksum from
a Delta signature and the offline classifier from authenticated PayBox
behavior.

### Deferred live gate

Authenticated PayBox `tools/list`, OAuth, wallet reads, exact unsigned
transactions, live route/chain evidence, independent simulation, and
production Delta are not present and remain unclaimed. A saved capture cannot
satisfy this gate.

## Sprint 3 — managed partner release and PayBox signing-boundary conformance
kit

State: implementation complete in the source tree; release verification
pending
Target release: `v0.3.0`

### PM requirement

Make installation and verification reproducible, then make the partnership ask
executable: demonstrate the proof and one-use-grant contract PayBox must
enforce before signing, while keeping the public package non-signing.

### Team work completed

- Product manager froze the source-tree/release distinction, the exact
  partner ask, and the prohibition on live or bypass-resistant claims.
- Full-stack engineering lead defined a versioned managed-copy boundary,
  allowlisted release surface, and production composition that always fails
  closed before reading credentials or network clients.
- Senior full-stack engineer implemented idempotent install, verified explicit
  upgrade, exact-manifest reuse checks, closed hook normalization, exact field
  comparison, semantic validation, expiry, product-level replay continuity
  across managed upgrades, and a deliberately in-memory signing-hook one-use
  simulator.
- Back-end data engineer added bindings for policy, proposal, message, route,
  complete evidence, exact-byte simulation, tool contract, PayBox authority,
  chain, wallet, assets, amounts, recipient, builder, slippage, price impact,
  network and priority fees, nonce, and validity.
- DevOps engineer added Node 22/24 CI with immutable action SHAs,
  skill/link/metadata/content checks, allowlisted same-commit archive
  repeatability, checksum creation,
  restricted-`PATH` cold-install validation, and source-deletion checks.
- Designer/front-end kept install state, fixture evidence, local hook
  hypothesis, and locked execution visibly distinct.
- QA specialist verified 133/133 full-suite tests, 17/17 installer tests, 10/10
  signing-hook tests, and 2/2 release-content scanner tests. Independent
  Mini-sprint 3 review remains pending.
- Target persona review is scheduled for Mini-sprint 3; no direct external
  interview is claimed.

### Implemented results

- The installer creates owner-only
  `.../protected-paybox/versions/v0.3.0`, records every allowlisted managed
  file and SHA-256 digest, verifies the complete install before reuse, and
  links the skill to that managed version.
- Mutable plans and evaluator history use the separate owner-only
  `.../protected-paybox/state` directory rather than changing versioned
  payloads; the one-use record remains effective after a verified upgrade.
- Ancestor and payload symlinks, unsafe paths, missing files, changed managed
  bytes, unverified version transitions, and incomplete installs fail closed.
- Restricted-`PATH` runtime discovery checks the managed Node pointer and
  supported Codex/ChatGPT runtime locations.
- The installed skill remains functional after the extracted source is
  deleted.
- The local hook schema is closed and every field is compared with an
  independently supplied expected claim.
- The runtime additionally enforces self-funded/self-recipient semantics,
  quoted output at or above minimum, slippage and price-impact ceilings, fee
  ceilings, audience, validity, and one-use intent.
- Same-process sequential replay and concurrent consumption accept at most one
  local attempt.
- Every local hook result discloses `local_only: true`, `durable: false`, and
  `cryptographic_grant_verified: false`.
- The production composition remains unconditionally locked.
- Release and CI scripts exist; committed-ref archive execution is not yet
  claimed.

### Sprint 3 release gate

- [x] Local field mutation, wrong audience, unsafe semantic bounds, and expiry
      fail.
- [x] Local sequential replay and 50-way same-process concurrency accept at
      most one attempt.
- [x] Conformance documentation identifies raw alternate mutation paths as a
      bypass and requires a mandatory PayBox-side hook.
- [x] Managed-install tests pass under restricted-`PATH` discovery and after
      extracted-source deletion.
- [x] Same-version installation is idempotent and cross-version movement
      requires explicit `--upgrade` from a verified managed version.
- [x] Managed state is outside the version payload and an already-used plan
      remains blocked after a verified upgrade.
- [x] Exact SHA-256 manifests, owner-only storage, path controls, and symlink
      rejection are covered.
- [x] Public package remains unable to sign or broadcast.
- [x] No production Delta, PayBox-native enforcement, liability, or mainnet
      protection claim appears.
- [x] Source-tree tests and skill/link/metadata/content checks pass.
- [ ] Archive checksum, allowlisted manifest, installed behavior, tag, and
      independently downloaded GitHub asset agree.
- [ ] Documentation, README, package, tests, committed archive, and GitHub
      release agree.

Durable or distributed grant consumption, cryptographic issuer verification,
PayBox client binding, restart persistence, revocation, ambiguous-broadcast
recovery, and reorg handling require a production PayBox/Delta integration.
They are not implemented or claimed by the local simulator.

### Mini-sprint 3

State: pending

Remaining gates:

1. Commit the exact candidate and build the archive twice from that commit
   under the same toolchain.
2. Independently audit installer path, permission, manifest, symlink,
   idempotency, upgrade, and source-deletion behavior.
3. Re-run the complete suite and skill/link/metadata/content checks.
4. Cold-install the archive with a restricted `PATH`; remove the extracted
   source; rerun doctor, fixture demo, offline inspection, and execution-lock
   checks through the installed skill.
5. Independently verify that the hook cannot be mistaken for an authenticated
   Delta proof, provider response, durable replay store, or PayBox
   enforcement.
6. Reconcile final public claims and complete persona review.
7. Publish the matching GitHub tag and asset, then independently download,
   checksum, install, and exercise that exact asset.

## Stopping point

The project stops after the `v0.3.0` partner-evaluation release passes the
remaining Mini-sprint 3 gates with:

- one complete simulation;
- an offline tool-surface inspector and explicit Solana evidence contract;
- a live read-only preflight only if a separately verified future PayBox
  contract passes the deferred gate;
- `BLOCK`, valid candidate, mutation rejection, and replay rejection;
- managed install and reproducible personal-GitHub release;
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

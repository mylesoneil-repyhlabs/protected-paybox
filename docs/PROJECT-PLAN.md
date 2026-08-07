# Project Plan

Status: card-first v0.4.0 released; live partner integration gated

## Product decision

Build Protected PayBox as a downloadable BYOA plugin/MCP with no frontend.
Prioritize card purchases over swaps because they expose the largest gap between
PayBox's announced Phase 2 merchant/amount grant design and a human's full
purchase mandate. Use DoorDash as the reference journey and a small set of
representative commerce archetypes to prove the taxonomy is reusable.

Do not wait for PayBox card access to demonstrate the policy surface. Do not
claim enforcement or merchant coverage until the provider exposes an
authenticated, mandatory pre-credential hook and lifecycle events.

## Target user

Primary persona: a non-technical agent user who delegates a common purchase but
cares about the exact merchant, item, quantity, price, fees, tip, destination,
and whether a subscription or recurring payment is created.

The current downloadable build serves a desktop technical evaluator, not that
mobile end user. A hosted connector or PayBox integration is required before the
target persona can use it in a mobile chat.

Reference job:

```text
Order one vegetarian bowl from the authorized DoorDash merchant to my saved
address. Keep the entire charge under $30, tax under $2.50, tip under $4,
delivery under $4, service fee under $2.50, and do not add subscriptions,
alcohol, extra items, substitutions, or reusable payment authority.
```

The compelling near miss is a checkout that PayBox's merchant/amount grant
might permit but Delta should block: wrong item or quantity, excessive tip or
fee, wrong destination, subscription, recurring flag, or changed checkout.

## Product requirements

### Functional

- Compile a closed card-purchase intent to a canonical policy and digest.
- Display every constraint and model a matching confirmation digest; do not
  claim authenticated human authorization.
- Bind merchant, exact basket, item semantics, minor-unit arithmetic,
  destination, risk flags, and proposed credential envelope.
- Return stable `PASS`, `BLOCK`, or `REVIEW` codes.
- Distinguish a proven violation from missing/untrusted evidence.
- Persist one-use fixture history and reject a second successful nonce.
- Produce a self-consistency record with explicit proof limitations.
- Ship one plugin containing the skill and MCP; preserve the swap fixture.
- Keep all credential, provider, network, signature, and fund movement paths
  locked.

### Evidence

- One machine-readable card taxonomy drives merchant fixtures and attribute
  definitions.
- Financial and merchant facts require authenticated provider/merchant sources
  in the production design.
- Current interface-shaped fixtures bind extractor solution and recomputed
  request/response digests. A live generalized extractor remains limited to
  non-financial scalar semantics and requires source provenance.
- Missing, low-confidence, stale, conflicting, malformed, or tampered evidence
  cannot `PASS`.
- No PAN, CVV, OAuth token, wallet key, raw address, or provider secret enters
  plans, fixtures, logs, receipts, or MCP arguments.

### Distribution

- Node 22+; zero runtime dependencies.
- Local Codex plugin manifest and MCP configuration.
- Managed skill installer with private permissions, file-digest marker, safe
  path checks, atomic linking, and source-deletion survival.
- CI on Node 22 and 24.
- Deterministic, content-scanned, cold-validated release ZIP and checksum.
- Personal GitHub repository with independently implemented adapters only; no
  proprietary Repyh source or evaluation binaries are vendored.

## Non-goals for the card-core release

- PayBox OAuth or authenticated tool discovery.
- Live card tokenization, credential issuance, merchant checkout, network
  authorization, capture, refund, or dispute.
- Live DoorDash or other merchant coverage.
- A production Delta proof or Mandate Guarantee.
- Arbitrary natural-language rules outside the published taxonomy.
- General arbitrary-asset swaps.
- Ecommerce UI or browser automation.

## Team loop

Every sprint uses the same loop:

1. **PM** states the user outcome, exact scope, claim boundary, acceptance
   tests, dependencies, and release decision.
2. **Designer** writes the conversational flow, mandate display, decision
   wording, recovery action, and trust disclosures.
3. **Engineering lead** owns architecture, interfaces, sequencing, and threat
   model.
4. **Senior full-stack engineer** implements CLI/MCP orchestration, canonical
   plans, evaluator, receipt, and local state.
5. **Backend data engineer** owns taxonomy, evidence schemas, provenance,
   extraction adapters, golden corpus, and reconciliation data model.
6. **DevOps engineer** owns pinned CI, packaging, scans, deterministic builds,
   cold install, and release evidence.
7. **Frontend engineer** has no visual UI backlog; they own MCP tool ergonomics,
   structured output, command parity, and host compatibility.
8. **QA specialist** builds positive, boundary, mutation, replay, concurrency,
   installer, and failure-mode tests.
9. **Target user persona** runs the three-command first experience and explains
   what they believe happened and what they would do next.
10. Ship a candidate, run independent skeptical PayBox-owner and CTO reviews,
    complete a mini-sprint for every release blocker, rerun the full gate, and
    only then advance the roadmap.

## Sprint 0 — discovery and boundary

Goal: determine what can truthfully be built without partner access.

PM deliverables:

- separate PayBox Phase 2 card claims from the live MoonAgents Card product;
- define “merchant coverage” as rail + ordering + evidence + mandatory hook +
  lifecycle reconciliation;
- choose DoorDash as the reference journey; and
- keep implementation in the personal repository and preserve clean interface
  boundaries around restricted reference code.

Engineering deliverables:

- audit Coinbase Gate, Delta Mandate, Policy Engine, and Evidence Layer
  interfaces at immutable revisions;
- carry forward canonical-action, one-use lease, journal-before-release,
  idempotency, reconciliation, taxonomy, and fail-closed patterns; and
- identify the scalar evidence bridge and licensing constraints.

Exit gate: no live PayBox/card/merchant claim in scope; exact partner seam and
evidence authority model documented.

## Sprint 1 — card core

Goal: make the value of Delta visible on a DoorDash-shaped purchase without
touching credentials or a network.

PM/Design:

- define the reference mandate and the meaningful near-miss sequence;
- make simulation status visible in every result;
- display recovery guidance for `BLOCK` and `REVIEW`; and
- label canned fixtures as auto-bound and model, but do not authenticate, a
  separate confirmation step for custom plans.

Engineering:

- add card intent, policy, evidence, proposal, decision, and receipt schemas;
- implement exact integer arithmetic and checkout snapshot binding;
- implement merchant, basket, attribute, fee, tip, destination, payment flag,
  and risk checks;
- add representative DoorDash, Amazon, Uber, Instacart, Walmart, and Target
  fixtures;
- add the modern/legacy local MCP, sensitive-field rejection, and plugin
  manifest; and
- extend installer and release payloads to the card taxonomy and plugin.

QA:

- DoorDash `PASS`;
- ten deterministic `BLOCK` scenarios;
- five deterministic `REVIEW` scenarios;
- confirmation and plan mutation;
- exact replay and second-use block;
- raw-credential absence;
- modern and legacy MCP behavior;
- installer, source deletion, restricted `PATH`, and full regression suite.

Release gates:

- all source tests pass on Node 22 and 24;
- skill and plugin validators pass;
- local links, metadata, and content scan pass;
- cold-installed card demo and MCP work after extracted source deletion;
- README describes only current behavior; and
- skeptical PayBox-owner and CTO reviews have no unresolved blocker.

## Mini-sprint 1 — review and hardening

Inputs:

- skeptical PayBox product owner;
- Delta CTO;
- QA failure evidence; and
- target-user interpretation of the first-run flow.

Expected focus:

- remove any phrase that converts fixtures into merchant coverage;
- prove the near miss catches semantics beyond merchant/amount;
- ensure critical money and identity fields cannot be model-authored;
- clarify that chat confirmation and local checksum are not authentication;
- verify the MCP cannot accept secret-shaped inputs;
- eliminate process-local replay ambiguity; and
- strengthen packaging for a one-download experience.

The sprint log records actual findings and fixes.

## Sprint 2 — authenticated evidence pack

Goal: replace hand-built product semantics with reviewed source artifacts while
remaining offline from PayBox execution.

Scope:

- implement the Evidence Layer `/extract` adapter for non-financial semantics;
- add `paybox-card://authorization/<opaque-id>` as a clean future backend seam;
- create a reviewed golden corpus from saved raw source artifacts;
- store field-level source, digest, extraction version, confidence, missing
  state, and warnings;
- add adversarial pages, prompt injection, hidden totals, conflicts, and schema
  drift tests;
- add post-authorization event simulator and deterministic reconciliation; and
- publish a merchant capability matrix with separate rail, ordering, evidence,
  hook, and lifecycle statuses.

Release gate: 100% exact critical-field behavior on the committed corpus;
unrecognized or ambiguous input always becomes `REVIEW`. This release still
does not claim live merchant coverage.

## Mini-sprint 2 — extraction and lifecycle review

PayBox-owner questions:

- Is the partner value distinct from PayBox grants?
- What data and latency does the hook add?
- Can this coexist with provider privacy and PCI boundaries?
- What exact work must PayBox perform?

CTO questions:

- Are financial fields cryptographically tied to an authenticated source?
- Is the corpus representative and mutation-tested?
- Are missing fields and upstream failures fail-closed?
- Are unknown authorizations reconciled without duplicate release?

## Sprint 3 — PayBox partner adapter

Start only after authenticated PayBox schema and sandbox access.

Scope:

- authenticate without exposing OAuth material to model context;
- stage or inspect the exact credential request;
- persist a canonical action and provider idempotency key;
- submit signed intent/evidence through pinned Delta components;
- independently verify the Delta proof;
- atomically consume a one-use release decision;
- call the exclusive PayBox credential-release hook;
- reconcile credential, authorization, capture, reversal, and refund events;
  and
- test at least DoorDash plus one retail archetype end to end.

Exit gate: the agent has no alternate credentialed mutation path, every
credential is bound to a fresh Delta decision, and ambiguous outcomes never
trigger blind retry.

## Sprint 4 — generalized swaps

Start after the card partner seam is validated or a separate swap priority is
approved.

Scope:

- authenticated PayBox/Swaps.xyz tool discovery;
- canonical asset IDs, chains, decimals, and token-program metadata;
- exact-in and exact-out quote/build fixtures for supported assets;
- live quote, chain, simulation, and unsigned-transaction evidence;
- mandatory Delta check before signing/broadcast; and
- token, chain, slippage, fee, price-impact, recipient, program, and transaction
  message binding.

Do not infer arbitrary asset support from the current fixed USDC-to-SOL fixture.

## Success measures

Demo quality:

- a new user can install and see meaningful `BLOCK`, corrected `PASS`, and
  evidence `REVIEW` in three commands;
- the user can explain that no card or order was touched; and
- the user can identify the exact PayBox integration dependency.

Engineering quality:

- stable scenario reason codes;
- no floating-point money;
- no secret material in source, fixtures, logs, records, artifacts, or tool
  arguments;
- exact replay convergence and second-use block;
- deterministic builds and green cold install; and
- no unsupported production claim.

Partner-readiness quality:

- a concrete hook request/response contract;
- a five-layer merchant capability matrix;
- a reviewed evidence corpus; and
- a small, testable PayBox implementation ask.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| PayBox card timing or schema changes | Treat public docs as research, use adapter boundary, require authenticated discovery |
| Card acceptance mistaken for merchant coverage | Report five independent capability layers |
| Extractor hallucinates or misprices | Restrict it to semantics; authenticated financial facts; fail to `REVIEW` |
| Skill bypass | Exclusive PayBox credential-release hook; no raw mutation alternative |
| Duplicate credential or charge | Durable one-use lease, provider idempotency, journal before release, reconciliation |
| Chat confirmation spoofing | Explicit current limitation; production identity/signature requirement |
| Checksum overclaimed as proof | Label unkeyed self-consistency only; require real verified Delta proof later |
| Private-source licensing | Keep repo private; clean adapters; record internal authorization before reuse/distribution |

## Current stopping point

The first useful stopping point is a verified card-core release: one-download
plugin/skill, full DoorDash decision matrix, representative merchant-neutral
fixtures, explicit evidence authority boundary, locked execution, independent
synthetic stakeholder reviews, and a reproducible release artifact. Live
PayBox/card work is intentionally deferred until partner access exists.

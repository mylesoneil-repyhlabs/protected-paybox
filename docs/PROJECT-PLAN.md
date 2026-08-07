# Project Plan

Status: v0.5.0 connection/discovery candidate; financial execution remains gated

## Product decision

Build Protected PayBox as a downloadable BYOA plugin/MCP with no frontend.
Prioritize card purchases over swaps because they expose the largest gap between
PayBox's documented merchant-origin/amount one-time-card request and a human's
full purchase mandate. Use DoorDash as the reference journey and a small set of
representative commerce archetypes to prove the taxonomy is reusable.

Let the user connect through session-only OAuth and discover their authenticated
tool catalog and enabled-plugin configuration, but do not call any remote PayBox
tool. Do not claim financial-resource access or
capability from public documentation alone. Do not claim enforcement or
merchant coverage until PayBox exposes a mandatory Delta check at credential
release/signing plus the evidence and lifecycle facts needed to prove it.

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

- Connect a PayBox account with OAuth authorization code, dynamic public-client
  registration, PKCE S256, exact loopback callback, and `mcp` scope only.
- Run authenticated upstream MCP `initialize` and paginated `tools/list`.
- Return a redacted tool summary and deterministic input/output schema digests without
  exposing tokens, codes, session IDs, descriptions, or schemas to the model.
- Keep the token in memory and expose explicit local disconnect; provide clear
  PayBox Clients manual-revocation guidance for every named registration.
- Structurally omit every upstream `tools/call`, REST, SDK, and CLI execution
  path.
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
- Keep all credential/balance/request-history reads, credential claims, payment
  requests, signing, swaps, x402, provider mutation, and fund-movement paths
  locked. `tools/list` alone reads the account-specific catalog and enabled
  plugin configuration.

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
  plans, fixtures, logs, receipts, model-facing results, or MCP arguments. The
  connection module's own access token remains transient internal state.

### Distribution

- Node 22+; zero runtime dependencies.
- Local Codex plugin manifest and MCP configuration.
- Managed skill installer with private permissions, file-digest marker, safe
  path checks, atomic linking, and source-deletion survival.
- CI on Node 22 and 24.
- Deterministic, content-scanned, cold-validated release ZIP and checksum.
- Personal GitHub repository with independently implemented adapters only; no
  proprietary Repyh source or evaluation binaries are vendored.

## Non-goals for the current release

- Calling `list_credentials`, `request_payment`,
  `claim_payment_credentials`, `get_request`, `request_swap`, or any other
  upstream PayBox tool.
- Live card tokenization, credential issuance, merchant checkout, network
  authorization, capture, refund, or dispute.
- Live DoorDash or other merchant coverage.
- A production Delta proof or Mandate Guarantee.
- Arbitrary natural-language rules outside the published taxonomy.
- General arbitrary-asset swaps.
- Ecommerce UI or browser automation.
- Persistent PayBox login, `offline_access`, refresh tokens, API keys, or
  signing keys.

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

- reconcile the current PayBox developer contract with conflicting older Help
  Center Phase 2 wording and keep MoonAgents Card separate;
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

Exit gate: public PayBox contracts are distinguished from authenticated account
availability and executed merchant evidence; the exact partner seam and
evidence-authority model are documented.

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

## Sprint 2 — session-only account connection and contract discovery

Goal: let the evaluator connect their PayBox account and establish the exact
authenticated tool surface without creating any financial execution path.

PM/Design:

- explain that the user signs in, selects grants, and approves only on PayBox;
- explain that the uniquely named client is already registered before consent,
  the `mcp` bearer has the full authority of selected grants, and every attempt
  may leave a client requiring manual revocation;
- recommend no credential if PayBox permits; otherwise one least-sensitive
  non-secret evaluation credential, human approval for every operation, and no
  raw-secret grant;
- distinguish the account-specific catalog/enabled-plugin read from a tool call,
  financial-resource read, or “Delta protected” action; and
- explain both local disconnect and server-side client revocation.

Engineering:

- validate the OAuth challenge and pinned authorization/resource metadata;
- dynamically register a public client with an exact `127.0.0.1` callback;
- implement authorization code with PKCE S256 and state;
- request only `mcp`, reject refresh/identity tokens or scope escalation, and
  store the access token only in memory;
- implement upstream MCP `initialize`, `notifications/initialized`, and bounded
  paginated `tools/list` for protocol `2025-06-18`;
- classify tool/schema risk conservatively and return a redacted deterministic
  summary with `observed_at` outside its digest; keep every discovered tool
  unreviewed and mandate-gated with no safe-read classification; and
- provide explicit disconnect/session cleanup with PayBox revocation guidance.

QA:

- metadata, registration, callback, state, PKCE, timeout, denial, token expiry,
  scope-escalation, and token-redaction cases;
- MCP JSON/SSE, request-ID matching, session headers, pagination, repeated
  cursor, size limits, 401/403, and disconnect cases;
- proof that local MCP discovery results contain no descriptions, schemas,
  token, code, client ID, or MCP session ID; and
- proof that no upstream `tools/call`, financial-resource read, or financial
  adapter is exposed.

Exit gate: mocked tests and a deliberately non-financial live smoke test show
that account authorization, authenticated tool discovery, redacted output,
local token destruction, and manual PayBox Clients revocation of every reported
client name all behave as documented.
The live smoke test must not call any discovered PayBox tool.

## Mini-sprint 2 — connection security review

PayBox-owner questions:

- Is dynamic registration/consent presented honestly as an account-side effect?
- Does the user understand the grant still exists after local disconnect?
- Is the discovery summary sufficient to plan an adapter while disclosing only
  the account-specific catalog/configuration and no credential, balance, card,
  or request-history data?
- Does any code path proxy or invoke a discovered tool?

CTO questions:

- Can tokens, authorization codes, PKCE verifiers, or MCP session IDs reach
  model context or disk? Is the authorization URL limited to the active flow?
- Do metadata drift, callback mismatch, scope escalation, oversized responses,
  pagination loops, expiry, and process restart fail closed?
- Is the upstream `tools/call` omission structural and regression-tested?
- Is OAuth connectivity clearly separated from Delta enforcement?

## Sprint 3 — authenticated evidence pack

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

## Mini-sprint 3 — extraction and lifecycle review

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

## Sprint 4 — PayBox partner adapter

Start only after account discovery confirms the relevant tools and PayBox
provides a sandbox plus a mandatory Delta integration point.

Scope:

- reuse the isolated OAuth connection without exposing token material to model
  context;
- map the documented `request_payment` fields and account-discovered schema to
  the canonical proposal;
- persist a canonical action and provider idempotency key;
- submit signed intent/evidence through pinned Delta components;
- independently verify the Delta proof;
- atomically consume a one-use release decision;
- submit `request_payment` only through the protected path, poll the original
  `request_id`, and permit one-time `claim_payment_credentials` only after a
  fresh exact-bound Delta `PASS`;
- route usable card authority from both an immediate autonomous
  `request_payment` success and `claim_payment_credentials` directly to an
  isolated credential broker or merchant executor, never through model context;
- reconcile credential, authorization, capture, reversal, and refund events;
  and
- test at least DoorDash plus one retail archetype end to end.

Exit gate: the agent has no alternate credentialed mutation path, every
credential is bound to a fresh Delta decision, and ambiguous outcomes never
trigger blind retry.

## Sprint 5 — generalized swaps

Start after the card partner seam is validated or a separate swap priority is
approved.

Scope:

- account-confirmed `request_swap` schema and enabled chain/tool discovery;
- canonical asset IDs, chains, decimals, and token-program metadata;
- exact-in and exact-out quote/build fixtures for supported assets;
- live quote, chain, simulation, and unsigned-transaction evidence;
- mandatory PayBox-side Delta check before signing/broadcast; and
- token, chain, slippage, fee, price-impact, recipient, program, and transaction
  message binding.

Do not infer arbitrary asset support from the current fixed USDC-to-SOL fixture.

## Success measures

Demo quality:

- a user can authorize a uniquely named PayBox client, see a redacted authenticated
  tool inventory, disconnect, and explain that no remote tool was called;
- a new user can install and see meaningful `BLOCK`, corrected `PASS`, and
  evidence `REVIEW` in three commands;
- the user can explain that no card or order was touched; and
- the user can identify the exact PayBox integration dependency.

Engineering quality:

- stable scenario reason codes;
- no floating-point money;
- no secret material in source, fixtures, logs, records, model-facing output,
  saved discovery snapshots, or tool arguments; transient OAuth state remains
  memory-only;
- no upstream `tools/call` or financial-resource-read adapter;
- exact replay convergence and second-use block;
- deterministic builds and green cold install; and
- no unsupported production claim.

Partner-readiness quality:

- an authenticated, redacted account tool snapshot;
- a concrete hook request/response contract;
- a five-layer merchant capability matrix;
- a reviewed evidence corpus; and
- a small, testable PayBox implementation ask.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Public docs differ from account/deployment tools | Treat docs as a baseline; use authenticated discovery and sandbox contract tests |
| OAuth grant is broader than discovery code needs | State that the `mcp` bearer has the full authority of selected grants; choose no credential if allowed, otherwise one least-sensitive non-secret evaluation credential with human approval for every operation and no raw secrets |
| Dynamic registration accumulates clients | Track every attempted client name and direct the user to revoke every one manually in PayBox Clients |
| Local disconnect is mistaken for server revocation | Explicitly direct the user to PayBox Clients and verify manual revocation during smoke testing |
| Token leaks from local process | Memory-only mcp token, no refresh, redacted outputs, bounded lifetime, isolated module |
| Card acceptance mistaken for merchant coverage | Report five independent capability layers |
| Extractor hallucinates or misprices | Restrict it to semantics; authenticated financial facts; fail to `REVIEW` |
| Skill bypass | Exclusive PayBox credential-release hook; no raw mutation alternative |
| Duplicate credential or charge | Durable one-use lease, provider idempotency, journal before release, reconciliation |
| Chat confirmation spoofing | Explicit current limitation; production identity/signature requirement |
| Checksum overclaimed as proof | Label unkeyed self-consistency only; require real verified Delta proof later |
| Private-source licensing | Vendor no restricted source; use clean adapters; record internal authorization before reuse or distribution |

## Current stopping point

The current candidate combines the verified card-core experience with
session-only PayBox OAuth and authenticated contract discovery. It is ready to
advance only after the connection security suite, deterministic cold package,
and a consent/discovery/disconnect/revoke live smoke test pass without invoking
any discovered tool.

That stopping point proves account connection and adapter planning, not Delta
enforcement. Credential, balance, card, and request-history reads plus all
remote tool calls remain disabled; `tools/list` reads only the account-specific
catalog and enabled-plugin configuration. Card
execution still requires a mandatory PayBox-side Delta boundary, source-bound
checkout evidence, one-use credential-claim semantics, merchant lifecycle
evidence, and an end-to-end sandbox transaction.

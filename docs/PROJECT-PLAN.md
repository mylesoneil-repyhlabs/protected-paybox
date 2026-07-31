# Protected PayBox project plan

Status: Sprint 1 through Sprint 3 local implementation and QA complete;
GitHub publication and independent re-download verification pending
Date: 2026-07-30
Owner: delta product and engineering
Target repository: personal GitHub, separate from Coinbase Guard

## Product truth today

Protected PayBox provides a valid,
credential-free skill package and deterministic CLI for one strict Solana
Mainnet USDC-to-SOL transaction-shaped fixture. It compiles a closed mandate,
evaluates complete labeled fixture evidence, returns `PASS`, `BLOCK`, or
`REVIEW`, records an unkeyed SHA-256 local self-consistency checksum, and
handles one-use replay and concurrency.

The supported custom fixture is exactly 25 USDC sold for at least 0.18 SOL,
with 100 bps maximum slippage and price impact, a 0.00005 SOL network-fee cap,
a 0.00002 SOL priority-fee cap, same-wallet settlement, and a 120-second
authorization. The fixture remains synthetic and does not estimate a live
market price.

The CLI creates this custom mandate with `plan --intent`, saves the plan, and
displays its policy digest. `demo --plan ... --confirm-policy ...` evaluates
the labeled fixture only when supplied that exact saved plan and digest. The
direct custom-intent demo shortcut is intentionally unsupported. The
confirmation binds bytes, not identity: the CLI cannot authenticate who
authored a chat message.
Canonical one-use state stays in the fixed private runtime; a managed install
keeps it in the product-level owner-only `state` directory outside immutable
version payloads. The CLI does not accept a caller-selected history directory.
Once that policy produces a `PASS`, a later attempt under a different nonce
returns `BLOCK/PLAN_ALREADY_USED`, including after a verified version upgrade.

Sprint 2 integrates an offline `inspect-tools` command and the
`SOLANA-EVIDENCE-CONTRACT.md` partner contract. The inspector accepts a saved
MCP `tools/list` capture, bounds and validates it, classifies tool risk,
redacts value-bearing schema examples, and produces a deterministic snapshot.
It has no OAuth or network path and cannot establish that a capture came from
PayBox.

Sprint 3 implementation adds a private, versioned managed installer with an
exact per-file SHA-256 manifest, restricted-`PATH` runtime discovery,
idempotent same-version installation, verified explicit `--upgrade`, and
operation after extracted-source deletion. Mutable plans and one-use history
live in a separate owner-only product state directory so the versioned payload
remains immutable and replay state survives upgrade. It also adds release/CI
validators and a pure local signing-hook conformance hypothesis. The
production composition always throws `PUBLIC_EXECUTION_LOCKED` before
inspecting its argument.

The current source tree passes 133/133 full-suite tests, including 17/17
managed-installer tests, 10/10 local signing-hook tests, and 2/2
release-content scanner tests. Skill, local-link,
release-metadata, and source-content checks also pass. The same-commit,
same-toolchain committed archive passes byte-repeatability, full extracted
tests, restricted-`PATH` cold install, source deletion, installed behavior,
and independent security/release review.

PayBox has not been contacted. No authenticated `tools/list`, OAuth session,
wallet, quote, chain state, venue response, or network simulation has been
captured. The checked-in `tools/list` capture is synthetic. The inspector is
an offline static-analysis aid, not PayBox discovery or authenticated
evidence.

Production Delta is not integrated. The public `execute`, `sign`, and
`broadcast` paths fail at runtime with `PUBLIC_EXECUTION_LOCKED`; no PayBox or
network adapter exists, so no signature, transaction, or money movement is
possible.

## Product decision

The first useful partner asset is not a generic DeFi guard. Sprint 1 proves one
complete, auditable fixture path for one exact-input on-chain swap:

> Protected PayBox turns a user's natural-language swap request into a closed
> mandate, pauses for explicit authorization, evaluates one exact
> transaction-shaped fixture against complete labeled wallet, route, market,
> fee, message, and simulation evidence, and returns `PASS`, `BLOCK`, or
> `REVIEW` with a bound local record and checksum.

The public partner-evaluation build stops before PayBox signing or broadcast.
A Sprint 1 `PASS` means only that the exact local fixture satisfied the closed
local policy. It is not a signature, execution grant, fill, price guarantee,
production Delta decision, or Mandate Guarantee.

## Why Solana is the primary candidate

PayBox's launch positioning and MoonPay's current agentic-finance surface place
substantial emphasis on Solana. A PayBox pitch asset should therefore begin
with Solana if the authenticated PayBox contract exposes enough pre-sign
information to verify the operation honestly.

The primary candidate is:

- Solana mainnet;
- one exact-input held USDC to native SOL swap;
- one PayBox wallet;
- one PayBox-supported aggregator or venue;
- one serialized unsigned transaction;
- no separate SPL-token approval or delegate instruction;
- no transfer, bridge, lending, perpetual, prediction-market, x402, card, or
  secret-release operation.

The current closed fixture policy profile models held USDC to SOL, matching a
natural agentic swap use case. Solana does not require an EVM-style allowance
transaction for the wallet-owned source token account, but the final swap must
not create a delegate or separate approval. The proposed transaction may
contain understood associated-token-account, compute-budget, token, system,
and route instructions, but every program and instruction must be decoded and
allowlisted. An unknown instruction or unresolved address lookup table is
`REVIEW`, not `PASS`.

### EVM comparison

| Criterion | Solana | EVM |
| --- | --- | --- |
| PayBox launch relevance | Stronger | Broader ecosystem relevance, but weaker launch-specific signal |
| First demo candidate | USDC to SOL | Native ETH to USDC on Base |
| Transaction inspection | Versioned transactions, address lookup tables, program instructions, compute budget, priority fee | Chain ID, nonce, `to`, `value`, calldata, EIP-1559 fee fields |
| Implementation complexity | Higher decoder and account-resolution complexity | Usually simpler deterministic calldata and contract-code checks |
| Route evidence | Strong if PayBox exposes Jupiter or another named route and exact transaction | Strong if PayBox exposes a named aggregator/router and exact calldata |
| Approval avoidance | Wallet-owned USDC source account; separate approval or delegate instructions forbidden | Native ETH input avoids ERC-20 approval |
| Partner-pitch value | Highest if it matches PayBox's real launch path | Better fallback if it is materially more inspectable |

Solana is the product-led choice. EVM is the engineering fallback, not a
parallel Sprint 1 scope.

### Future live-chain gate

Sprint 1 fixes Solana as the local fixture profile because it best matches the
PayBox launch context. That does not establish that authenticated PayBox
exposes the same venue or transaction shape. Before enabling any live
read-only preflight, the engineering lead must capture the authenticated
PayBox MCP contract. Solana remains the live candidate only if PayBox exposes,
before signing:

1. the exact wallet and chain;
2. the named venue or aggregator and route;
3. the exact quote and its freshness or reference block;
4. the complete serialized unsigned transaction;
5. enough transaction context to resolve address lookup tables and decode
   every instruction;
6. a simulation or a transaction that can be simulated independently; and
7. a clean separation between prepare/read operations and sign/broadcast.

If Solana fails this gate and an EVM route satisfies it, the first live
preflight becomes native ETH to USDC on one selected EVM chain, with Base as
the preferred candidate. If neither chain satisfies it, Protected PayBox
remains the shipped labeled credential-free simulation. The team must not
reconstruct a different route and call it the PayBox proposal.

## Target persona

**Alex** is a security-conscious crypto user who wants to operate a PayBox
wallet through a mobile chat application. Alex understands wallets, tokens,
slippage, and gas at a practical level but does not read transaction bytes.
Alex wants autonomous operation within meaningful limits and does not want to
approve every action manually.

Alex must be able to answer, without opening JSON:

- What exactly did I authorize?
- What would this transaction do?
- Which facts were checked and how fresh were they?
- Why did the action pass, block, or require review?
- Was anything signed, broadcast, or moved?

## Goals

- Produce a compelling PayBox-specific partner artifact faster than Coinbase
  Guard by reusing its verified architecture and release lessons.
- Prove one action end to end across intent, policy, evidence, proposal,
  decision, receipt, UX, install, and documentation.
- Make the gap between PayBox grant compliance and human-intent verification
  concrete.
- Define the exact native signing-boundary hook PayBox would need for
  bypass-resistant Delta enforcement.
- Publish reproducible, current-state releases to the user's personal GitHub.

## Non-goals through Sprint 3

- Generic DeFi or arbitrary transaction protection.
- PayBox signing, transaction broadcast, or mainnet money movement.
- A claim that a skill prevents direct calls to raw PayBox mutation tools.
- Production Delta policy syntax, signed receipts, proof verification, or
  liability assignment.
- Prediction markets, tokenized equities, perpetuals, lending, staking,
  recurring strategies, portfolio rebalancing, x402 service delivery, cards,
  secrets, or off-chain ecommerce.
- A claim that PayBox, a venue, RPC provider, or chain signs the normalized
  evidence stored in the local receipt.

## First action taxonomy

The first versioned policy family is
`digital-asset-solana-exact-input-swap.v1`.

It must bind:

- action kind: exact-input swap;
- wallet fingerprint and exact recipient;
- Solana cluster and genesis hash;
- input asset identity: exact USDC mint and decimals;
- output asset identity: native SOL;
- exact input amount;
- minimum output amount;
- maximum slippage in basis points;
- maximum price impact in basis points;
- maximum network fee and priority fee in SOL and USD;
- exact aggregator or venue;
- allowed program IDs and program-data fingerprints;
- allowed route tokens and pools;
- whether associated-token-account creation is permitted;
- approvals, bridges, arbitrary transfers, and arbitrary instructions: false;
- one use;
- validity start, authorization expiry, and proposal expiry.

The exact proposal additionally binds:

- message version;
- fee payer;
- recent blockhash and last valid block height;
- all static and lookup-table account keys;
- every instruction and program ID;
- input and output token accounts;
- compute-unit limit and price;
- expected token and SOL deltas;
- route and platform fees;
- serialized unsigned transaction bytes and digest.

An EVM fallback uses the equivalent
`digital-asset-evm-exact-input-swap.v1` fields: chain ID, wallet, recipient,
asset contracts and decimals, venue, router address and code hash, nonce,
`to`, `value`, calldata, gas limit, EIP-1559 fee fields, route, exact unsigned
bytes, one use, and expiry.

## User stories and acceptance criteria

### US-1: Capture a closed mandate

As Alex, I can state a swap in plain English and see every material economic
and authorization term before anything is evaluated.

Acceptance:

- known user terms are preserved verbatim;
- no silent chain, asset, route, amount, or constraint substitution occurs;
- missing material constraints are grouped into one concise question;
- decimal arithmetic never uses binary floating point;
- an unsupported request stops instead of being translated into a supported
  swap.

### US-2: Authorize exactly what was displayed

As Alex, I authorize the complete displayed mandate in a separate message.

Acceptance:

- the initial request is not authorization;
- silence, a connected wallet, or agent-authored text is not authorization;
- authorization binds the latest policy digest and expires;
- any changed policy term requires a new display and authorization;
- the current public implementation must say that chat authorship is not
  cryptographically authenticated;
- a skill remains model guidance and cannot prevent an agent from bypassing it
  to call another connected PayBox tool.

### US-3: Understand the decision

As Alex, I receive a compact `PASS`, `BLOCK`, or `REVIEW` with one primary
reason, impact, checked facts, freshness, recovery, receipt status, and the
no-sign boundary.

Acceptance:

- `BLOCK` means complete verified evidence shows a mandate violation;
- `REVIEW` means required evidence is missing, stale, malformed, mismatched,
  rate-limited, ambiguous, or unavailable;
- evidence failure never becomes `PASS`;
- hashes and normalized technical details remain available on request but are
  not required in the ordinary journey.

### US-4: Detect accidental or unrehashed mutation and replay

As Alex or a PayBox engineer, I can detect a candidate or record change when
the recorded checksum has not also been recomputed, and I can reject replay
that changes proposal semantics.

Acceptance:

- the current receipt binds policy, authorization, wallet, route, evidence,
  exact canonical fixture-message bytes, decision, nonce, and expiry; a future
  live record must bind the actual unsigned transaction bytes;
- any unrehashed instruction, account, recipient, mint, amount, route,
  program, fee, blockhash, or lookup-table mutation fails local checksum
  verification;
- because the checksum is unkeyed SHA-256, an active editor can change the
  record and recompute it; this is not a Delta signature, authenticity proof,
  or adversarial tamper protection;
- exact retry may return the prior current result without a second provider
  call;
- nonce reuse for different semantics blocks;
- concurrent one-use attempts serialize;
- after one nonce produces `PASS`, the same one-use policy cannot produce a
  second `PASS` under another nonce.

### US-5: Evaluate a future PayBox signing hook

As a PayBox product or security engineer, I can run a conformance suite against
a candidate pre-sign integration.

Acceptance:

- changed transaction, expired proof, wrong wallet or agent client, replay,
  concurrent consumption, restart, revocation, and ambiguous broadcast are
  covered;
- the public build cannot obtain a signing capability;
- the responsibility boundary between model, Delta, PayBox, venue, and user is
  documented.

## Architecture

```text
User
  |
Protected PayBox skill
  |  model: extract, clarify, explain only
  v
Current deterministic Guard Core
  |- intent compiler and closed policy validator
  |- explicit authorization binder
  |- fixture proposal decoder and canonical serializer
  |- fixture evidence normalizer and freshness checks
  |- PASS / BLOCK / REVIEW engine
  |- nonce, one-use policy state, receipt, and local history
  `- labeled local Solana fixture only

Current public boundary
  `- execute / sign / broadcast throw at runtime

Sprint 2, integrated offline surfaces
  |- inspect-tools accepts only a saved tools/list capture
  |- bounded static risk classification and redacted snapshot
  |- Solana F1/L1 evidence and trust contract
  `- no OAuth, PayBox, venue, chain, or Delta adapter

Sprint 3, implemented locally
  |- private versioned managed installer and exact SHA manifest
  |- deterministic release and cold-install validation scripts
  |- pure local PayBox signing-boundary conformance artifacts
  |- production composition always runtime-locked
  `- authenticated/live adapters remain gated on discovered contracts
```

The model may preserve language, identify missing terms, and explain typed
output. Deterministic code owns schema validation, canonicalization, decimal
arithmetic, evidence, freshness, decisions, receipts, nonce state, and all
future execution gates.

Host-mediated PayBox output copied through chat is not trusted evidence. The
offline `inspect-tools` command can parse, bound, classify, redact, sort, and
digest a saved MCP `tools/list` response, but it performs no provider I/O,
authenticates no provider, and does not feed the evaluator. A live preflight
requires a deterministic adapter or authenticated Delta-controlled proxy to
own the PayBox request and receive the provider response. If the host's OAuth
token cannot be delegated safely, that mode remains unavailable.

## Evidence contract

A future live read-only `PASS` requires:

- exact PayBox wallet and credential/agent-client fingerprint;
- selected chain identity;
- sufficient held input balance and fee reserve;
- runtime token or mint identity and decimals;
- complete quote, route, fees, minimum output, and expiry;
- named venue/aggregator and exact program or router identities;
- exact unsigned transaction before signing;
- full instruction or calldata decoding;
- recent chain state and independent simulation;
- expected wallet asset deltas;
- no unexpected approval, delegate, transfer, bridge, signer, account,
  instruction, or contract call;
- fee and economic limits inside the mandate;
- proposal expiry equal to the earliest evidence expiry.

Suggested starting profile:

- quote age at most 10 seconds;
- chain-head age at most 15 seconds;
- simulation at the quoted block/slot or within an explicitly bounded drift;
- proposal lifetime at most 30 seconds;
- five-second per-source timeout;
- bounded response bodies;
- HTTPS and strict host, method, and tool allowlists;
- no redirects or fallback to a mutating method.

Provider receipt time is not silently represented as provider observation
time. Evidence authenticity limits must remain visible.

## Sprint 1: truthful simulation

State: complete in the shared tree
Version: `0.1.0`
Committed Sprint 1 baseline: `ff37db6`

### PM result

- Froze one strict Solana Mainnet exact-input USDC-to-SOL fixture surface.
- Kept live PayBox, broad DeFi, production Delta, signing, and broadcast out of
  scope.
- Defined a meaningful `BLOCK`, corrected `PASS`, and evidence-unavailable
  `REVIEW`.
- Kept README current-only and moved historical detail into these docs.

### Engineering result

- Implemented the skill, runner, CLI, versioned closed schemas, canonical
  hashing, integer decimal/atomic arithmetic, policy compiler, fixture builder,
  evidence normalizer, evaluator, receipt verifier, reporting, and private
  file handling.
- Added `doctor`, `plan`, `demo`, `simulate`, and `verify`.
- Made `execute`, `sign`, and `broadcast` fail with
  `PUBLIC_EXECUTION_LOCKED`.
- Bound exact canonical message bytes to decoded top-level and inner
  operations, fee payer, signer set, lookup-table resolution, program
  allowlist, builder, assets, amount, minimum receive, recipient, simulated
  deltas, and fee fields.

### Data result

- Implemented labeled, deterministic Swaps.xyz-shaped fixtures without
  claiming that authenticated PayBox uses Swaps.xyz.
- Added the strict custom 25 USDC fixture:
  `examples/solana-25-usdc-intent.json`.
- Preserved exact Solana chain and CAIP-19 asset identity; symbols remain
  display labels only.
- Marked every fixture as self-reported local evidence with no PayBox or
  network contact.

### DevOps and UX result

- Added Node 22 runtime discovery, safe absolute-path JSON input, non-symlink
  and size checks, owner-only artifacts, and skill validation.
- Implemented compact mandate and decision output with technical hashes only
  on request.
- Made `SIMULATION ONLY · NO PAYBOX CONTACT · NO SIGNATURE · NO TRANSACTION`
  part of every supported result.
- Kept credentials unnecessary and out of the workflow.

### QA result

The v0.2 direct pre-installer Node test run is 104/104 green. This aggregate
includes the Sprint 2 inspector and CLI tests as well as Sprint 1 coverage:

- closed intent and evidence schemas;
- atomic-unit arithmetic;
- `PASS`, policy `BLOCK`, and evidence `REVIEW`;
- exact message bytes and decoded-operation semantics;
- unknown programs, hidden inner calls, unresolved or changed evidence, and
  unexpected asset movement;
- receipt checksum mismatch detection and redaction-before-checksum;
- confirmation-before-replay;
- full-evidence nonce binding;
- stale and expired replay prevention;
- 50-way in-process concurrency;
- atomic cross-process once-write convergence;
- invalid nonce redaction;
- the public execution lock;
- bounded offline discovery parsing and risk classification.

No direct external target-user interview is claimed. The skill and CLI embody
the approved Alex persona requirements; Mini-sprint 2 should obtain fresh
qualitative feedback.

### Sprint 1 exit gate

- [x] Strict Solana fixture and custom 25 USDC mandate work through
      deterministic code.
- [x] Complete fixture evidence returns `PASS`, `BLOCK`, or `REVIEW`.
- [x] Every supported outcome has a redacted local record whose unkeyed
      SHA-256 checksum can be recomputed for self-consistency.
- [x] Exact bytes and every decoded operation are bound.
- [x] Full evidence is included in nonce semantics.
- [x] Stale or expired facts cannot inherit a historical `PASS`.
- [x] Same-process and cross-process once-write behavior is atomic.
- [x] Public execution remains locked.
- [x] PayBox and external networks are never contacted.
- [x] v0.2 direct pre-installer suite passes 104/104.
- [x] README describes only current verified functionality.
- [ ] No authenticated PayBox `tools/list` is claimed; this is a future live
      integration prerequisite.
- [ ] No GitHub tag, release archive, checksum, or independent re-download is
      claimed by this shared-tree verification.

### Mini-sprint 1 result

State: complete in the shared tree

Mini-sprint 1 hardened the completed simulation by adding and verifying:

1. the strict custom 25 USDC intent path;
2. exact decoded swap and priority-fee operation binding;
3. nonce semantics over policy, confirmation, and the complete evidence
   bundle, including quote, reference, simulation, and timestamps;
4. current re-evaluation before replay so expired mandates and stale evidence
   never reuse a historical `PASS`;
5. atomic cross-process once-write using owner-only temporary files and a
   single successful hard-link claim;
6. the initial offline, bounded, redacted PayBox tool-discovery module and
   adversarial tests, subsequently exposed through the Sprint 2
   `inspect-tools` command.

## Sprint 2: offline tool-surface and evidence contract

State: complete
Version: `0.2.0`

Sprint 2 deliberately does not claim a live read-only preflight. It turns the
unknown PayBox surface and Solana evidence requirements into inspectable
partner artifacts without requiring credentials.

### Team result

- PM: froze the offline-only scope and prohibited authenticated/live wording.
- Engineering lead: kept OAuth, provider I/O, signing, and broadcast outside
  the runtime.
- Senior engineer: integrated `inspect-tools` into the CLI with absolute-path
  input and optional owner-only snapshot output.
- Data engineer: implemented bounded parsing, conservative classification,
  deterministic redaction and digests, plus
  `docs/SOLANA-EVIDENCE-CONTRACT.md`.
- DevOps: added malformed, ambiguous, duplicate, deceptive, destructive,
  oversized, and redaction-focused tests.
- Design/front-end: made `OFFLINE CAPTURE ANALYSIS` and the no-OAuth boundary
  prominent in ordinary output.
- QA: expanded the v0.2 direct pre-installer suite to 104/104 green and
  completed independent adversarial review.
- Persona: can distinguish a static schema-risk snapshot from proof of real
  provider behavior.

### Sprint 2 implemented gate

- [x] `inspect-tools` accepts a saved direct array, `{tools}`, or JSON-RPC
      `tools/list` response.
- [x] Input size, shape, depth, node count, tool count, strings, keys, and
      duplicate names are bounded.
- [x] Tools are conservatively classified as `read`, `prepare`, `sign`,
      `broadcast`, `combined_write`, or `unknown`.
- [x] Destructive, deceptive, preparatory, mutating, and unknown tools cannot
      become safe read-only candidates.
- [x] Value-bearing examples and secret-shaped schema values are redacted
      before optional owner-only snapshot output.
- [x] The snapshot declares `offline_analysis: true` and
      `provider_authenticated: false`.
- [x] The Solana evidence contract separates implemented fixture profile `F1`
      from proposed live profile `L1`, source authenticity, and the PayBox
      questions that must be answered.
- [x] No OAuth, PayBox, venue, chain, Delta, signing, or broadcast adapter was
      added.
- [x] v0.2 direct pre-installer suite passes 104/104.

### Mini-sprint 2

State: complete

The adversarial review confirmed that misleading names, descriptions, enum
actions, and annotations cannot turn a mutating tool into a read-only
candidate. It also covered schema-value leakage, malformed JSON-RPC
envelopes, duplicate tools, oversized inputs, owner-only output, alternate
history redirection, one-use replay, and the execution lock. The target-persona
review found no blocker for a local simulation-only partner asset and
confirmed that the checksum, authorship, provider-authenticity, and bypass
limits remain visible.

### Deferred live preflight gate

An authenticated read-only preflight remains future work and cannot ship
merely because `inspect-tools` accepts a saved capture. It still requires:

- a deterministic adapter that owns authenticated PayBox reads without
  exposing OAuth material to chat;
- the exact unsigned candidate before signing;
- complete transaction decoding and independent recent-chain simulation;
- authenticated wallet, route, source, and freshness bindings;
- `REVIEW` on missing, stale, malformed, ambiguous, rate-limited, or changed
  evidence; and
- no mutation, signature, broadcast, or money movement.

## Sprint 3: installable partner release and signing-boundary conformance kit

Release target: `v0.3.0`
State: local implementation, committed-archive validation, and independent
Mini-sprint 3 review complete; GitHub publication and re-download pending

Sprint 3 does not enable public signing. It packages the prototype
reproducibly and turns the evidence contract into the asset used to pitch a
native PayBox integration.

### Team result

- PM: froze the non-signing partner asset, made the native-hook ask explicit,
  and kept archive/release claims behind final verification.
- Engineering lead: defined the managed-install and allowlisted-release
  boundaries and made the production composition fail closed before it can
  read credentials or clients.
- Senior engineer: implemented the private versioned installer, exact manifest
  verification, closed signing-hook schema, exact claim comparison, semantic
  limits, stable product-level replay state across installed versions, and a
  deliberately in-memory one-use signing-hook conformance consumer.
- Data engineer: bound policy, proposal, message, route, chain, wallet, fee
  payer, exact assets and amounts, recipient, builder, fee limits, nonce, and
  validity in the local hook hypothesis.
- DevOps: implemented Node 22/24 CI with immutable action SHAs,
  skill/link/metadata/content checks, allowlisted same-commit archive
  repeatability, checksum creation,
  restricted-`PATH` cold-install validation, and source-deletion checks.
- Design/front-end: kept install, simulation, local conformance, and locked
  execution visibly distinct in the README and ordinary output.
- QA: brought the full source suite to 133/133, including 17/17 managed
  installer tests, 10/10 local signing-hook tests, and 2/2 release-content
  scanner tests; the same suite passes from the committed archive.
- Persona: an internal target-persona walkthrough found the mandate and
  no-execution boundary clear, while identifying the exact-digest confirmation
  as appropriate for a partner asset rather than finished consumer UX. Direct
  external target-user feedback is not claimed.

### Required future native handshake

1. Protected PayBox freezes exact transaction bytes.
2. Delta verifies the authorized mandate and bound evidence.
3. A short-lived one-use grant binds PayBox agent client, wallet, chain,
   transaction digest, policy, proof, and expiry.
4. PayBox verifies and atomically consumes that grant inside its signing
   boundary.
5. PayBox signs only identical bytes.
6. Broadcast returns an idempotency key and transaction signature/hash.
7. Uncertain submission enters reconciliation by transaction identity and
   wallet nonce/sequence; it is never blindly resubmitted.

### Sprint 3 exit gate

- [x] Any local hook-field mutation, wrong audience, invalid semantic bound,
      or expiry fails.
- [x] Same-process sequential replay and 50-way concurrent use accept at most
      one local attempt.
- [x] The local conformance result discloses that it is not durable and has
      not verified a cryptographic grant.
- [x] The conformance kit explains that a raw alternate mutation path defeats
      skill-level enforcement and specifies the mandatory PayBox-side hook.
- [x] Managed-install tests cover restricted-`PATH` discovery, exact manifest
      verification, idempotency, verified explicit upgrade, and operation
      after extracted-source deletion.
- [x] Managed plans and evaluator history stay outside immutable version
      payloads, and one-use state survives a verified upgrade.
- [x] Public code remains unable to sign or broadcast; the production
      composition is always locked.
- [x] Production Delta proof, PayBox-native enforcement, liability assignment,
      and mainnet protection remain unclaimed.
- [x] Current source-tree tests and skill/link/metadata/content checks pass.
- [x] Build and cold-validate the same-commit/same-toolchain archive from the
      committed `v0.3.0` source.
- [x] Verify the local archive checksum, allowlisted contents, installed
      behavior, and execution lock agree.
- [x] Complete independent Mini-sprint 3 security, release, and internal
      persona QA.
- [ ] Verify the GitHub tag and independently downloaded release asset agree
      with the final committed source and checksum.

Durable or distributed grant consumption, authenticated issuer proof, PayBox
client binding, revocation, restart persistence, ambiguous-broadcast recovery,
and reorg handling are production-partner gates. They are not properties of
the local conformance simulator.

### Sprint 3 mini-sprint

State: local gates complete; GitHub publication and re-download pending

Completed local work:

1. Committed the exact candidate source and built the archive from that commit.
2. Independently inspected installer paths, permissions, symlink rejection,
   manifest verification, explicit upgrade, and source-deletion durability.
3. Re-ran 133/133 tests and all skill/link/metadata/content checks from the
   candidate.
4. Cold-installed the archive under a restricted `PATH`, deleted the extracted
   source, and reran doctor, fixture demo, offline inspector, and execution
   lock from the managed copy.
5. Confirmed the hook artifact cannot be confused with a cryptographic grant,
   provider response, durable replay store, or live integration.
6. Reconciled README and all claim/security documents to current evidence.

Remaining external gate:

1. Publish the matching tag and asset, then independently download the GitHub
   asset and verify its checksum and behavior.

## Good stopping point

Stop after the patched `v0.3.0` partner-evaluation release passes every
remaining Mini-sprint 3 gate. At that point the asset should provide:

- one complete credential-free simulation;
- an offline tool-surface inspector and explicit Solana evidence contract;
- one real read-only preflight only if a later authenticated PayBox contract
  satisfies the deferred live gate;
- a meaningful `BLOCK`, a valid candidate, a mutation failure, and a replay
  failure;
- a managed install, current documentation, and a reproducible
  personal-GitHub release;
- a precise native PayBox signing-hook contract and conformance suite;
- no signing, broadcast, or money movement.

Only partner or user evidence should justify the next taxonomy. Recommended
expansion order is additional AMM routes, one venue-specific prediction-market
order, lending deposit/withdraw, tokenized equities, and then perpetuals.
x402 and ecommerce follow only after the team can verify the purchased
service or item, merchant, delivery, cancellation, refund, and dispute facts.

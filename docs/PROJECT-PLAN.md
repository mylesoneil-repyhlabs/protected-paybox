# Protected PayBox project plan

Status: implementation plan  
Date: 2026-07-30  
Owner: delta product and engineering  
Target repository: personal GitHub, separate from Coinbase Guard

## Product truth today

Protected PayBox is currently a project specification, an unimplemented skill
scaffold, and a partial Sprint 1 deterministic foundation. The repository now
contains package metadata, a launcher, canonical hashing, decimal helpers,
closed intent validation, a fixed Solana profile, and policy-plan
construction. It does not yet have a complete executable CLI or skill
workflow, proposal/evidence/simulation/decision pipeline, receipt, nonce
history, tests, PayBox OAuth session, authenticated PayBox tool inventory,
live data adapter, Delta integration, or signing or broadcast capability.

Nothing in the current repository can yet complete a protected flow, simulate
or submit a PayBox operation, or produce a verified decision. Sprint 1 must
preserve that truth until each corresponding capability is implemented and
tested.

## Product decision

The first useful partner asset is not a generic DeFi guard. It is one complete,
auditable path for one exact-input on-chain swap:

> Protected PayBox turns a user's natural-language swap request into a closed
> mandate, pauses for explicit authorization, evaluates one exact unsigned
> transaction against fresh wallet, route, market, fee, and simulation
> evidence, and returns `PASS`, `BLOCK`, or `REVIEW` with a bound receipt.

The public partner-evaluation build will stop before PayBox signing or
broadcast. A `PASS` will mean that the candidate satisfied the checked policy
and evidence at that moment. It will not be a signature, execution grant,
fill, price guarantee, production Delta decision, or Mandate Guarantee.

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

The current partial policy profile models held USDC to SOL, matching a natural
agentic swap use case. Solana does not require an EVM-style allowance
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
| Approval avoidance | Native SOL input avoids SPL approval | Native ETH input avoids ERC-20 approval |
| Partner-pitch value | Highest if it matches PayBox's real launch path | Better fallback if it is materially more inspectable |

Solana is the product-led choice. EVM is the engineering fallback, not a
parallel Sprint 1 scope.

### Chain-selection gate

The engineering lead must capture the authenticated PayBox MCP contract before
freezing the chain profile. Solana is selected only if PayBox exposes, before
signing:

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
remains a labeled credential-free simulation. The team must not reconstruct a
different route and call it the PayBox proposal.

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
  cryptographically authenticated.

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

### US-4: Detect mutation and replay

As Alex or a PayBox engineer, I can prove that changing the candidate after
verification invalidates the result.

Acceptance:

- the receipt binds policy, authorization, wallet, route, evidence, exact
  unsigned bytes, decision, nonce, and expiry;
- any instruction, account, recipient, mint, amount, route, program, fee,
  blockhash, or lookup-table mutation invalidates the receipt;
- exact retry may return the prior current result without a second provider
  call;
- nonce reuse for different semantics blocks;
- concurrent one-use attempts serialize.

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
Deterministic Guard Core
  |- intent compiler and closed policy validator
  |- explicit authorization binder
  |- proposal decoder and canonical serializer
  |- evidence normalizer and freshness checks
  |- PASS / BLOCK / REVIEW engine
  |- nonce, replay, receipt, and local history
  |
  |- PayBox read/prepare adapter
  |- route quote adapter
  |- Solana or EVM evidence adapter
  |- independent transaction simulator
  `- Delta adapter: labeled local simulation initially

Public production-composition seam
  `- sign/broadcast capability unavailable
```

The model may preserve language, identify missing terms, and explain typed
output. Deterministic code owns schema validation, canonicalization, decimal
arithmetic, evidence, freshness, decisions, receipts, nonce state, and all
future execution gates.

Host-mediated PayBox output copied through chat is not trusted evidence. A
live preflight requires the deterministic adapter or an authenticated
Delta-controlled proxy to own the PayBox request and receive the provider
response. If the host's OAuth token cannot be delegated safely, that mode
remains unavailable.

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

## Sprint 1: contract discovery and truthful simulation

Release target: `v0.1.0`

### PM

- Freeze this PRD, action taxonomy, persona, claims, and non-goals.
- Define the ordinary demo: meaningful conditional swap, first candidate
  `BLOCK`, revised candidate `PASS`.
- Keep the real transaction cap separate from the simulated narrative.
- Record every unsupported PayBox action instead of implying broad coverage.

### Full-stack engineering lead

- Define versioned module boundaries and schemas.
- Template only reusable, committed Coinbase Guard patterns; do not copy its
  Coinbase-specific action or its dirty working tree.
- Make the public sign/broadcast composition seam unimplementable through
  environment variables, flags, credentials, or runtime code loading.

### Senior full-stack engineer

- Implement the deterministic compiler, validator, proposer, fixture
  pipeline, decision engine, receipt verifier, nonce state, redacted history,
  CLI, and skill runner.
- Keep the credential-free path as the default.

### Back-end data engineer

- Capture and hash authenticated PayBox `tools/list` without invoking a
  mutation.
- Classify every tool as read, prepare/simulate, approve, sign, broadcast, or
  unknown.
- Build labeled Solana and EVM fixtures, source metadata, and the evidence
  schema.

### DevOps engineer

- Add pinned Node runtime support, CI, dependency lock, secret/content scan,
  deterministic release archive, checksum, managed installer, and restricted
  `PATH` cold-install tests.
- Exclude credentials, OAuth data, runtime state, raw provider bodies, and
  generated private artifacts from releases.

### Designer and front-end engineer

- Produce a chat-native mandate and decision hierarchy.
- Keep raw hashes and paths behind a details request.
- Make `SIMULATION`, `NO PAYBOX CONTACT`, and `NO SIGNATURE` visually
  unmistakable.

### QA specialist

- Test unsupported intent, malformed schema, decimal boundaries, stale and
  missing evidence, wrong route, mutation, replay, nonce concurrency, early
  failure receipts, redaction, restricted `PATH`, source deletion, and release
  contents.
- Verify that redaction happens before receipt sealing and authorization
  before retry lookup.

### Target persona

- Complete install, intent, clarification, authorization, decision, detail,
  and history journeys without coaching.
- Explain the decision and execution boundary back to the team.

### Sprint 1 exit gate

- Authenticated tool inventory exists, but no PayBox mutation was called.
- Chain decision is recorded using the selection gate above.
- Credential-free `BLOCK -> PASS` fixture works through deterministic code.
- Every supported outcome has a verifiable redacted local receipt.
- Public code has no reachable sign or broadcast capability.
- Full test, skill, link, secret scan, deterministic bundle, managed install,
  restricted `PATH`, source-deletion, and claim-ledger checks pass.
- README is created or updated before release and describes only the current
  verified functionality.
- GitHub tag, release archive, checksum, and independent re-download
  verification are complete.

### Sprint 1 mini-sprint

Fix reproduced QA and persona findings, prioritizing:

1. any false `PASS`, invalid negative receipt, replay race, or secret leak;
2. `BLOCK` versus `REVIEW` errors;
3. stale or misleading mode/boundary language;
4. source-dependent installer instructions;
5. unnecessary digest, path, or configuration ceremony.

Do not begin Sprint 2 until the patched release passes the full gate again.

## Sprint 2: one live read-only swap preflight

Release target: `v0.2.0`

Implement only the selected Solana route, or the documented EVM fallback.

### Team deliverables

- PM: freeze the live mode, freshness profile, source responsibility, and
  public wording.
- Engineering lead: approve the PayBox OAuth/read boundary and adapter
  allowlist.
- Senior engineer: implement PayBox read/prepare, chain, quote, decoding, and
  simulation adapters.
- Data engineer: normalize only allowlisted facts, resolve route identities,
  and bind every evidence timestamp or slot/block.
- DevOps: add network-contract fixtures, provider-failure tests, and secret
  redaction checks.
- Design/front-end: distinguish `DRY RUN` from `READ-ONLY PREFLIGHT` and show
  checked-source freshness.
- QA: attack schema drift, malicious route data, stale blockhash, reorg,
  lookup-table mutation, program/router mutation, unexpected deltas, fee
  manipulation, rate limits, timeouts, and partial responses.
- Persona: complete the preflight and correctly explain that no signature or
  future execution guarantee exists.

### Sprint 2 exit gate

- The adapter, not the model, obtains authenticated PayBox facts.
- OAuth tokens and agent-client keys never enter chat, logs, receipts, history,
  artifacts, or Git.
- PayBox exposes the exact unsigned candidate before signing.
- The complete transaction is decoded and simulated against recent state.
- Every economic and instruction-level constraint is checked.
- One-byte or one-field mutation invalidates the old result.
- Missing, stale, malformed, ambiguous, rate-limited, or changed evidence
  returns `REVIEW`.
- Healthy-source performance target is p95 at or below 12 seconds, with a
  progress update after two seconds.
- No sign, approval, broadcast, transaction hash, or money movement occurs.
- Full Sprint 1 release gates rerun, README reflects only current v0.2
  behavior, and the personal-GitHub release is independently verified.

### Sprint 2 mini-sprint

Fix actual PayBox schema mismatches, flaky source behavior, false provenance,
transaction-decoder gaps, output overload, and any path that contacts a
mutation. Re-run the full security and release gates.

## Sprint 3: PayBox signing-boundary conformance kit

Release target: `v0.3.0`

Sprint 3 does not enable public signing. It turns the prototype into the asset
used to pitch a native PayBox integration.

### Team deliverables

- PM: partner narrative, responsibility model, latency budget, rollout gates,
  and exact native-hook ask.
- Engineering lead: production-shaped adapter and private-composition
  boundary.
- Senior engineer: conformance server, durable-grant contract, recovery state
  machine, and adversarial fixtures.
- Data engineer: proof/evidence binding manifest and reconciliation schema.
- DevOps: isolated conformance environment, fault injection, restart and
  concurrency tests, and reproducible partner package.
- Design/front-end: three-minute `BLOCK -> PASS -> mutation/replay rejected`
  demo.
- QA: independent attack review across bypass, proof mismatch, expiry,
  revocation, concurrency, restart, uncertain broadcast, reorg, and receipt
  verification.
- Persona: confirm the experience preserves useful autonomy without requiring
  approval for every in-policy proposal.

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

- Changed bytes, wrong wallet/client, expired proof, replay, concurrent use,
  restart, and revocation all fail.
- One-use consumption is durable and atomic.
- Ambiguous broadcast enters reconciliation-only state.
- The conformance kit demonstrates that a raw alternate mutation path would
  defeat enforcement and specifies how PayBox must remove it.
- Public GitHub code still cannot sign or broadcast.
- Production Delta proof, PayBox-native enforcement, liability assignment, and
  mainnet protection remain unclaimed.
- README, security boundary, claim ledger, sprint log, partner contract, and
  release artifacts agree.

### Sprint 3 mini-sprint

Incorporate independent security, PayBox-engineer, and persona findings. Patch
all enforcement-boundary, receipt, replay, recovery, and documentation
defects, then repeat the complete release verification.

## Good stopping point

Stop after the patched `v0.3.0` partner-evaluation release. At that point the
asset should provide:

- one complete credential-free simulation;
- one real read-only preflight for the selected chain and route, if PayBox
  exposes the required contract;
- a meaningful `BLOCK`, a valid candidate, a mutation failure, and a replay
  failure;
- current documentation and a reproducible personal-GitHub release;
- a precise native PayBox signing-hook contract and conformance suite;
- no signing, broadcast, or money movement.

Only partner or user evidence should justify the next taxonomy. Recommended
expansion order is additional AMM routes, one venue-specific prediction-market
order, lending deposit/withdraw, tokenized equities, and then perpetuals.
x402 and ecommerce follow only after the team can verify the purchased
service or item, merchant, delivery, cancellation, refund, and dispute facts.

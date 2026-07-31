# Protected PayBox security boundary

Status: v0.3.0 local release gates complete; live execution locked;
GitHub publication and independent re-download verification pending
Date: 2026-07-30

## Current boundary

The repository implements a complete credential-free Sprint 1 fixture flow:
skill, runner, CLI, closed Solana USDC-to-SOL mandate, deterministic labeled
evidence, exact fixture-message decoding and byte binding, `PASS`, `BLOCK`, and
`REVIEW`, an unkeyed SHA-256 local self-consistency checksum, canonical
one-use policy state, and explicitly locked execution.

The current Node suite is 133/133 green. It verifies exact
decoded-operation binding, nonce semantics over the complete evidence bundle,
current re-evaluation before replay, stale and expired replay prevention,
canonical one-use policy consumption, atomic same-process and cross-process
once-write behavior, offline tool-surface inspection, managed installation,
and the local signing-hook conformance hypothesis. The 17 installer tests, 10
hook tests, and 2 release-content scanner tests also pass as targeted subsets.

The current product has not authenticated to PayBox, captured an authenticated
PayBox `tools/list`, read a PayBox wallet, requested a live quote, contacted
Solana or a venue, run a network simulation, called production Delta, requested
a signature, or broadcast anything. Every fixture states that PayBox and
external networks were not contacted.

Sprint 2 exposes the offline helper through `inspect-tools`. It reads only a
caller-supplied saved capture, parses bounded JSON, classifies tool risk,
redacts value-bearing schema examples, and can write an owner-only
deterministic snapshot. It has no provider I/O, OAuth client, or MCP
connection. It is not evidence that any real PayBox tool schema has been
observed or that a provider behaves as its schema says.

Sprint 3 adds a private, versioned managed installer. It copies only an
allowlisted payload, rejects source symlinks, stores owner-only files, records
the exact SHA-256 digest of every managed file, verifies the complete manifest
before reusing or upgrading an install, and requires explicit `--upgrade`
between versions. Tests cover restricted-`PATH` runtime discovery and
operation after the extracted source is removed.

Sprint 3 also adds a closed local signing-hook schema and pure conformance
functions. They compare every claim field to an independently supplied
expected claim and enforce current self-wallet semantics, output and fee
limits, audience, validity, and same-process one-use behavior. They do not
authenticate an issuer, validate a cryptographic proof, reconstruct a PayBox
request, contact a provider, or persist replay state. The production
composition always throws `PUBLIC_EXECUTION_LOCKED` before inspecting its
argument.

## Security objective

The intended system verifies one exact proposed on-chain operation against one
human-authorized mandate before a future signing boundary can release it.

The public partner-evaluation build must remain safe even when a user supplies
credentials because no public code path may obtain a sign or broadcast
capability. The future production objective additionally requires PayBox to
enforce the Delta result inside its credential-release or signing boundary.

## Trust boundaries

### User and host

The user owns the mandate and must authorize the complete displayed policy in
a new message. The public chat flow can bind that message to policy bytes but
cannot prove who typed it. Production requires an authenticated user signer or
PayBox passkey session.

The host application controls the model, connected tools, OAuth session, and
message attribution. A compromised host is outside the protection offered by
a skill alone.

### Language model

Treat the model as untrusted and potentially prompt-injected.

The model may:

- preserve user language;
- extract candidate fields;
- ask for missing material constraints;
- explain deterministic output.

The model may not:

- invent policy terms or defaults;
- author wallet, quote, route, chain, fee, simulation, or provider facts;
- perform monetary arithmetic;
- select the decision;
- issue a receipt or grant;
- control nonce/retry state;
- sign, approve, or broadcast.

### Deterministic Guard Core

For the current fixture surface, typed deterministic code owns:

- exact schema validation;
- canonical serialization and digests;
- decimal arithmetic;
- policy compilation;
- evidence normalization and freshness;
- fixture-message decoding and exact canonical-byte comparison;
- `PASS`, `BLOCK`, and `REVIEW`;
- receipt construction and verification;
- nonce, replay, canonical one-use policy consumption, concurrency, expiry,
  and history;
- atomic local nonce once-write and replay state.

Future live evidence and grant consumption remain outside the current build.

Any unexpected exception, schema, field, tool, route, program, contract,
instruction, provider status, or state transition fails closed.

### PayBox

PayBox is an external credential and wallet control plane. Its OAuth tokens,
agent-client keys, wallet material, private keys, key shares, and raw secrets
must never be passed through chat or stored by the guard.

No current product path contacts PayBox. The `tool_contract` inside fixture
evidence is an explicit unverified placeholder and says that authenticated
schemas have not been observed.

The offline `inspect-tools` command does not make a tool safe. It marks
read-only candidates conservatively and requires mandate gating for prepare,
sign, broadcast, combined-write, deceptive, and unknown surfaces. Its source
record always says `offline_analysis: true` and
`provider_authenticated: false`. A later live adapter may expose only
explicitly allowlisted authenticated read or prepare operations. Unknown,
approve, sign, broadcast, secret-release, card, or arbitrary-operation tools
remain denied.

A future live preflight may treat an authenticated PayBox response as evidence
that PayBox returned it over the configured connection. A local SHA-256
receipt would not independently authenticate PayBox's source facts.

### Venue, chain, RPC, quote, and simulation providers

These providers are not contacted in the current build. Any future live
adapter must apply:

- HTTPS;
- fixed origins, hosts, paths, methods, and tool names;
- no redirects;
- bounded request and response sizes;
- bounded timeouts;
- no fallback from a failed read into a mutation;
- source-specific timestamps, slots, blocks, or local receipt times;
- explicit source-authenticity limitations.

Missing or unavailable facts produce `REVIEW`. A verified policy violation
produces `BLOCK`.

### Delta

The current build does not call a Delta adapter. Its deterministic local
evaluator and unkeyed SHA-256 checksum are explicitly fixture-only and are not
a production Delta decision, signature, or cryptographic authenticity proof.
The checksum detects accidental or unrehashed mutation. An active editor can
change the record and recompute the checksum.

Production requires:

- authenticated immutable user intent;
- exact policy and transaction bindings;
- independent outcome;
- pinned verifier identity and proof program;
- cryptographic proof verification;
- durable one-use grants;
- evidence that PayBox consumes the exact grant inside its signing boundary.

## Why a skill alone is not enforcement

A skill influences model behavior. It does not remove other connected tools.
If raw PayBox sign or broadcast tools remain available, a compromised or
prompt-injected agent can bypass the skill and call them directly.

The public prototype may demonstrate policy verification, but it must not
claim bypass resistance.

True enforcement requires one of:

1. a native PayBox pre-sign hook that requires a valid Delta-bound grant;
2. a Delta-controlled proxy that is the only mutation surface and holds the
   PayBox authorization outside the model; or
3. equivalent host enforcement that makes raw PayBox mutations unavailable.

The preferred partner design is the native hook because PayBox retains its
wallet and session-key architecture while Delta supplies the independent
intent and evidence decision.

## Protected assets

- human-authored mandate and authorization;
- PayBox OAuth token and agent-client identity;
- wallet identity and funds;
- quote, route, transaction, and simulation evidence;
- Delta proof and one-use grant;
- receipt and local history;
- package and installer integrity.

## Primary threats and controls

| Threat | Control |
| --- | --- |
| Prompt injection or compromised model | Model cannot decide, author evidence, or reach signer |
| Direct raw PayBox bypass | Must be removed or gated at the PayBox signing boundary |
| Policy substitution | Display full closed mandate; bind explicit new authorization to exact digest |
| Asset-symbol spoofing | Bind cluster/chain plus exact mint or contract and decimals |
| Malicious or stale quote | Independent chain facts, bounded freshness, exact route and simulation |
| Transaction mutation after verification | Bind complete serialized unsigned bytes and re-check before future signing |
| Hidden program or router behavior | Decode all instructions/calldata; unknown behavior is `REVIEW` |
| Approval or delegate drain | First scope forbids approvals, delegates, permits, and separate approval transactions |
| Unexpected recipient or account | Bind exact wallet, recipient, fee payer, token accounts, signers, and deltas |
| Gas or priority-fee manipulation | Bind gas/compute limits, fee fields, and mandate ceilings |
| Replay and concurrency | Semantic nonce plus durable atomic one-use consumption |
| Ambiguous submission | Reconcile by existing transaction identity; never blindly submit another |
| Tool or provider schema drift | Bind schema/version digest and deny unknown fields/tools |
| Secret leakage | OAuth isolation, bounded redaction, sanitize before sealing, release secret scans |
| Accidental or inconsistent release contents | Dependency-free runtime, immutable CI action SHAs, allowlisted committed payload, same-commit/same-toolchain double build, checksum, cold install |

The managed manifest and release checksum are unkeyed integrity aids. They do
not authenticate a publisher or resist an active editor with the same OS-user
access. The installed runner does not re-verify the manifest on every launch;
re-running the installer from unchanged source detects managed-file or marker
divergence.

## Solana-specific controls

The Solana candidate requires deterministic handling of:

- mainnet genesis hash;
- wallet, fee payer, and all required signers;
- exact USDC input mint and native SOL output;
- legacy or versioned message type;
- recent blockhash and last-valid-block-height;
- address lookup table accounts and resolved keys;
- every program ID and instruction;
- upgradeable-program data identity where relevant;
- system, token, associated-token-account, compute-budget, and venue programs;
- input/output token accounts and ownership;
- compute unit limit and priority-fee price;
- route plan, platform fee, minimum output, and slippage;
- expected pre/post SOL and token balances;
- unexpected writable accounts, delegates, approvals, close-account behavior,
  transfers, or additional signers;
- independent simulation against a recent slot.

Unknown lookup tables, unresolved program data, extra instructions, changed
blockhash, changed writable accounts, or unexplained balance deltas cannot
pass.

## EVM-fallback controls

If Solana fails the pre-sign visibility gate, an EVM fallback must bind:

- chain ID and wallet;
- exact token contracts and decimals;
- nonce;
- recipient;
- venue and router address;
- router runtime-code hash;
- `to`, `value`, calldata, and decoded route;
- gas limit, maximum fee, and priority fee;
- exact input, minimum output, fees, and expected balance deltas;
- simulation block and result.

Unknown calldata, proxy implementation drift, permit, unlimited approval,
delegate call to an unknown target, or unexplained token transfer cannot pass.

## Authorization and replay

- The initial user request is not authorization.
- Authorization is accepted only after the complete mandate is displayed.
- Changed semantics always require new authorization.
- The CLI binds the supplied confirmation digest to the exact policy; it does
  not authenticate the chat author.
- The skill's separate-message instruction is behavioral guidance. A model
  can bypass the skill, and the CLI cannot prove which person or process
  supplied the matching digest.
- Confirmation is revalidated before replay lookup.
- The semantic nonce digest includes the policy, confirmation, and the entire
  evidence bundle, including quote, reference, simulation, and timestamps.
- The evaluator recomputes the current result before consulting history.
- An exact, still-current retry may return its prior stored record.
- The same nonce with different semantics is `BLOCK`.
- A historical `PASS` is never returned after mandate expiry or evidence
  staleness.
- Concurrent identical attempts serialize in-process.
- Cross-process attempts write owner-only temporary records and use one atomic
  hard-link claim, so only one record wins.
- One-use state is keyed by the policy digest in the fixed private runtime. In
  a managed install, plans and history live in the owner-only product-level
  `state` directory outside immutable version payloads. The CLI does not
  accept a caller-selected history directory.
- After one nonce produces `PASS`, a different nonce for the same policy
  returns `BLOCK/PLAN_ALREADY_USED`; it cannot produce a second `PASS`, even
  after a verified managed-version upgrade.

## Local record and checksum boundary

Every current fixture result records:

- mode;
- policy and authorization;
- exact wallet and fixed Solana asset identities;
- fixture tool-contract placeholder;
- exact canonical message bytes and decoded operations;
- normalized evidence and source times;
- quote, reference, chain, wallet, asset, message, and simulated-result facts;
- decision and reason;
- nonce and expiry;
- public no-execution boundary;
- an unkeyed SHA-256 checksum over canonical local content and bindings.

Early `BLOCK` and `REVIEW` results use deterministic placeholders for
unavailable fields and must not imply that missing evidence was checked.
Sanitize the record before computing the checksum.

Verification recomputes the unkeyed checksum and its recorded bindings. This
detects accidental corruption and mutation when the checksum has not also
been recomputed. Anyone who can edit the record can recompute every SHA-256
value, so the checksum does not establish adversarial tamper resistance,
authorship, authenticity, or independent evidence provenance. It is not:

- a production Delta signature or proof;
- authenticated user identity;
- independently authenticated PayBox, venue, or chain data;
- a signing grant;
- an executed transaction;
- a fill or price guarantee;
- a liability guarantee.

## Credential and data handling

- Never request a raw OAuth token, agent-client key, private key, seed phrase,
  key share, passkey export, or PayBox secret in chat.
- Keep credentials outside the repository and managed release.
- A future live adapter may use credentials only inside its own process or an
  approved host credential store.
- Do not persist raw headers, OAuth responses, PayBox bodies, wallet labels,
  internal IDs, account lists, or arbitrary provider error text.
- Store only allowlisted redacted facts and fingerprints with owner-only
  permissions.
- No remote telemetry by default.
- Clearing local history requires immediate explicit confirmation.

## Public execution lock

The current `execute`, `sign`, and `broadcast` CLI commands all call the same
runtime lock and throw `PUBLIC_EXECUTION_LOCKED`. The runtime has no
PayBox/OAuth adapter or network path capable of requesting a signature,
approval, broadcast, secret, or card output. This is directly covered by the
green test suite. This is a runtime-enforced product boundary, not a
type-level or packaging guarantee.

The v0.3.0 public build preserves this boundary. A reviewed private
composition may eventually provide a closure-held signing capability only
after all conformance gates pass.

## Locked or unclaimed capabilities

- live PayBox integration;
- any authenticated PayBox tool surface or real `tools/list` capture;
- live Solana or EVM route support beyond the labeled fixture;
- read-only wallet or quote evidence;
- live-chain transaction simulation;
- PayBox approval, signature, or broadcast;
- production Delta integration;
- a cryptographically authenticated or provider-backed signing-hook grant;
- durable or distributed hook replay consumption;
- keyed or signed Delta receipt;
- independent source authentication;
- bypass resistance;
- Mandate Guarantee;
- recourse or transaction reversal;
- prediction markets, AMMs beyond the selected route, tokenized equities,
  perpetuals, lending, x402, cards, secrets, and ecommerce.

These remain locked until implementation evidence and the claim ledger say
otherwise.

The following offline surfaces are implemented and are not included in the
locked list:

- `inspect-tools` analysis of a saved, untrusted `tools/list` capture;
- deterministic redacted tool-risk snapshots; and
- the fixture/live separation and proposed fields in
  `SOLANA-EVIDENCE-CONTRACT.md`;
- private versioned managed installation with exact file-digest verification;
  and
- the pure local signing-hook schema, exact comparison, semantic validation,
  expiry check, and same-process replay simulator.

## Release security gate

Implemented and currently passing or directly validated in the source tree:

- full unit, integration, adversarial, and UX tests;
- skill metadata and workflow validation;
- local-link validation;
- credential and secret-content scan, including OAuth access, refresh and
  session tokens and client-secret forms;
- explicit managed-copy and release-archive path allowlists;
- restricted-`PATH` managed install;
- source deletion followed by an installed doctor check;
- README, security boundary, claim ledger, and shipped behavior comparison.

The exact committed source has also passed same-commit/same-toolchain
byte-repeatability, archive content scanning, all 133 extracted tests,
restricted-`PATH` cold install, source deletion, installed behavior, and
independent security/release review.

Still pending before the external release gate can be marked complete:

- publish the matching GitHub tag and asset; and
- independently re-download the GitHub asset and verify its checksum and
  installed behavior.

The README must describe current verified functionality only. Historical
detail belongs in tags, releases, changelog, or sprint log.

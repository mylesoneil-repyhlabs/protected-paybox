# Protected PayBox claim ledger

Status: current source-tree truth
Date: 2026-07-30

## Status vocabulary

- `VERIFIED_CURRENT`: directly evidenced by the current source tree and the
  verification runs recorded below.
- `EXTERNAL_SOURCE`: stated by a cited primary external source, not verified
  through the current implementation.
- `PENDING_VERIFICATION`: implementation exists, but a required release or
  independent-review gate has not run.
- `DESIGN_TARGET`: approved requirement, not implemented.
- `UNKNOWN`: must be discovered or tested.
- `LOCKED`: deliberately unavailable in the public build.

## Current product claims

| Claim | Status | Current evidence | Allowed wording |
| --- | --- | --- | --- |
| A Protected PayBox fixture prototype exists | `VERIFIED_CURRENT` | Skill, runner, CLI, deterministic evaluator, local checksum records, tests, and current README | "Protected PayBox is an independent, credential-free Delta simulation prototype." |
| A completed Sprint 1 skill exists | `VERIFIED_CURRENT` | `skills/protected-paybox/SKILL.md` and skill validation | "The skill guides one strict Solana USDC-to-SOL fixture flow." |
| A complete fixture guard flow exists | `VERIFIED_CURRENT` | `plan`, `demo`, `simulate`, `verify`; current 133/133 full-suite run | "One labeled transaction-shaped fixture can be compiled, evaluated, and locally checksum-verified end to end." |
| The current build evaluates exact fixture proposals | `VERIFIED_CURRENT` | Closed evidence normalizer and deterministic evaluator | "Complete local fixture evidence returns PASS, BLOCK, or REVIEW." |
| A strict custom 25 USDC fixture is supported | `VERIFIED_CURRENT` | `plan --intent` creates a saved plan and displayed digest; `demo --plan ... --confirm-policy ...`; CLI tests | "The current custom example evaluates exactly 25 USDC for at least 0.18 SOL under its stated synthetic limits after the saved plan and exact digest are supplied." |
| The CLI authenticates who authored the chat confirmation | `LOCKED` | The CLI compares only the supplied digest; no authenticated chat identity is available | "The CLI proves digest equality, not who supplied it." |
| A skill alone makes the flow bypass-resistant | `LOCKED` | A skill cannot remove or gate another connected PayBox tool | "Bypass resistance requires enforcement inside the PayBox signing boundary or an exclusive protected proxy." |
| Exact decoded operations are bound | `VERIFIED_CURRENT` | Canonical message-byte comparison and exact builder/asset/amount/minimum/recipient/priority-fee tests | "Changing the decoded operation or bound message bytes prevents PASS." |
| Full evidence is bound to the nonce | `VERIFIED_CURRENT` | Semantic digest includes complete evidence; quote/reference/simulation/timestamp mutation tests | "A nonce cannot replay different evidence semantics." |
| Stale or expired state cannot replay PASS | `VERIFIED_CURRENT` | Re-evaluation-before-history and dedicated stale/expired tests | "Only an exact, still-current retry may reuse its stored result." |
| Cross-process once-write is atomic | `VERIFIED_CURRENT` | Owner-only temporary file plus hard-link claim; worker-process test | "Concurrent processes converge on one durable nonce record." |
| A one-use policy cannot PASS under a second nonce | `VERIFIED_CURRENT` | Canonical policy-use claim in fixed private state; CLI, preflight, and cross-version installer tests | "After one PASS, the same policy returns BLOCK/PLAN_ALREADY_USED under another nonce, including after a verified upgrade." |
| Caller-selected history can redirect one-use state | `LOCKED` | The CLI has no `--history` option | "One-use state is kept in the canonical private runtime." |
| The v0.3.0 source suite is green | `VERIFIED_CURRENT` | Full Node run on 2026-07-30 | "133/133 source-tree tests pass." |
| A managed installer exists | `VERIFIED_CURRENT` | 17/17 installer tests; versioned owner-only copy, separate stable owner-only state, exact SHA-256 manifest, restricted-`PATH` discovery, idempotency, explicit integrity-checked upgrade, cross-version replay, ancestor-symlink rejection, and source-deletion checks | "The local package installs an integrity-checked private managed copy that remains usable after the extracted source is removed; stable replay state survives upgrade, and the unkeyed manifest is not publisher authentication." |
| An allowlisted release pipeline exists | `VERIFIED_CURRENT` | Immutable GitHub Actions SHAs, metadata/link/content validators, allowlisted archive builder, checksum generator, and cold-install validator are present; skill, links, metadata, and source-content checks pass | "The repository contains pinned CI actions plus same-commit/same-toolchain archive-repeatability and cold-install validation scripts." |
| A committed release archive has passed the release gate | `PENDING_VERIFICATION` | No committed-ref archive or independent Mini-sprint 3 run is recorded yet | "Release archive verification remains pending." |
| The current build has PayBox OAuth integration | `LOCKED` | No OAuth client or session exists | "PayBox has not been connected from this repository." |
| An offline PayBox tool-surface inspector exists | `VERIFIED_CURRENT` | `inspect-tools`, bounded parser, risk classifier, redacted deterministic snapshot, CLI and module tests | "Protected PayBox can conservatively analyze a saved tools/list capture offline; it does not contact or authenticate PayBox." |
| The PayBox MCP tool surface has been captured here | `UNKNOWN` | No authenticated contract artifact exists in this repository | "Authenticated tool discovery remains a future live-integration gate." |
| A Solana evidence contract is documented | `VERIFIED_CURRENT` | `docs/SOLANA-EVIDENCE-CONTRACT.md` separates fixture profile `F1` from proposed live profile `L1` | "The repository specifies the fields, bindings, sources, authenticity limits, and PayBox questions required for a future live preflight." |
| A signing-hook conformance hypothesis exists | `VERIFIED_CURRENT` | Closed JSON schema, pure local normalizer/verifier/one-process consumer, always-locked production composition, and 10/10 targeted tests | "The local conformance kit models exact field binding, semantic limits, audience, expiry, and one-process replay behavior for a proposed PayBox hook." |
| Release content is scanned for credential forms | `VERIFIED_CURRENT` | 2/2 targeted scanner tests and passing source-content scan | "The release scanner rejects OAuth access, refresh and session tokens, client-secret forms, and other configured secret patterns." |
| The signing-hook claim is cryptographically authenticated or provider-backed | `LOCKED` | The claim kind explicitly says it is not a cryptographic grant; no issuer proof, PayBox response, Delta proof, credential, or network adapter exists | "The signing-hook asset is an unauthenticated local interface hypothesis only." |
| The local signing-hook replay consumer is durable or distributed | `LOCKED` | It uses an in-memory set and resets with the process | "The local consumer demonstrates only same-process sequential and concurrent one-use behavior." |
| The current build reads PayBox wallet data | `LOCKED` | No adapter exists | "No PayBox wallet or account data is read." |
| The current build obtains live quotes or chain data | `LOCKED` | No adapter exists | "No external market, route, RPC, or chain data is used." |
| The current build runs a live-chain simulation | `LOCKED` | Only labeled simulation-shaped fixture facts exist | "No Solana RPC or venue simulation is performed." |
| The current build creates a local checksum record | `VERIFIED_CURRENT` | Record creation, checksum verification, unrehashed-mutation, and disclaimer tests | "Every supported outcome has an unkeyed SHA-256 local self-consistency checksum." |
| The local checksum prevents an active editor from rewriting a record | `LOCKED` | SHA-256 is unkeyed; an editor can recompute the record and binding digests | "The checksum detects accidental or unrehashed mutation; it is not a signature, authenticity proof, or adversarial tamper protection." |
| The current build signs or broadcasts | `LOCKED` | Runtime CLI lock and test; no PayBox/network adapter | "Nothing can be signed, broadcast, or moved." |
| The current build integrates production Delta | `LOCKED` | No Delta adapter exists | "Production Delta is not integrated." |
| Protected PayBox currently provides a Mandate Guarantee | `LOCKED` | No production Delta or PayBox enforcement | "Protected PayBox is not currently a Mandate Guarantee." |

## External PayBox facts

These statements are external product documentation, not implementation
evidence for Protected PayBox.

| External statement | Status | Primary source | Safe use |
| --- | --- | --- | --- |
| PayBox describes agent clients and scoped grants for wallets, cards, and secrets | `EXTERNAL_SOURCE` | [MoonPay Help Center](https://support.moonpay.com/en/articles/669841-how-agent-connections-work-in-paybox) | Explain the integration hypothesis; do not claim the local repository has these capabilities |
| PayBox documents wallet signatures or transaction hashes as derived outputs | `EXTERNAL_SOURCE` | [MoonPay Help Center](https://support.moonpay.com/en/articles/669841-how-agent-connections-work-in-paybox) | Motivate a pre-sign Delta hook |
| PayBox documents operation-bound approvals | `EXTERNAL_SOURCE` | [PayBox FAQ](https://support.moonpay.com/en/articles/669843-paybox-faqs) | Compare exact-operation approval with exact mandate verification |
| PayBox says payment-card support is coming in Phase 2 | `EXTERNAL_SOURCE` | [PayBox FAQ](https://support.moonpay.com/en/articles/669843-paybox-faqs) | Keep cards out of the initial scope |
| MoonPay says valid in-grant Agent Client operations are deemed user-authorized | `EXTERNAL_SOURCE` | [MoonPay Terms, Section 6B](https://www.moonpay.com/legal/terms_of_use_bvi_launchpad) | Explain why grant compliance is not enough |
| MoonPay says it does not assess Agent Client intent, logic, frequency, or correctness | `EXTERNAL_SOURCE` | [MoonPay Terms, Section 6B](https://www.moonpay.com/legal/terms_of_use_bvi_launchpad) | State the Delta product wedge without claiming a partnership |
| PayBox exposes the exact unsigned transaction before signing | `UNKNOWN` | Requires authenticated tool and behavior inspection | Mandatory gate for a live preflight |
| PayBox exposes a native external-policy callback | `UNKNOWN` | No verified public contract in this repository | Present as the partner integration ask, not current capability |
| PayBox exposes read-only and sign scopes separately | `UNKNOWN` | Requires authenticated OAuth/tool inspection | Do not assume least-privileged live mode |
| PayBox exposes a sandbox or testnet signing path | `UNKNOWN` | Requires product/API confirmation | No testnet or mainnet signing claim |

## Chain and action claims

| Claim | Status | Evidence or gate | Allowed wording |
| --- | --- | --- | --- |
| Solana is the selected fixture chain | `VERIFIED_CURRENT` | Fixed mainnet genesis reference and closed CAIP-19 asset profile | "Sprint 1 supports one strict Solana Mainnet fixture profile." |
| Protected PayBox supports Solana swaps | `VERIFIED_CURRENT` | Strict USDC-to-SOL fixture compiler/evaluator only | "Protected PayBox supports one labeled Solana USDC-to-SOL fixture; it does not support a live swap." |
| Protected PayBox supports EVM swaps | `LOCKED` | Fallback design only | "EVM is the fallback if it provides materially better pre-sign visibility." |
| Protected PayBox supports any live AMM | `LOCKED` | Swaps.xyz-shaped data is an explicit local fixture; PayBox routing is unknown | "The fixture shape is not evidence that PayBox uses Swaps.xyz." |
| Protected PayBox supports all tokens | `LOCKED` | Runtime accepts only exact fixed USDC and SOL identities | "No static token-count or generic-token claim is permitted." |
| Protected PayBox supports prediction markets | `LOCKED` | Deferred taxonomy | "Prediction markets are an expansion candidate after the swap path is proven." |
| Protected PayBox supports lending, perps, or tokenized equities | `LOCKED` | Deferred taxonomy and evidence work | Do not use current-capability language |
| Protected PayBox supports x402 or ecommerce | `LOCKED` | Service/item-delivery evidence is not designed | Do not use current-capability language |

## Release wording

### Current v0.3.0 source-tree wording

> Protected PayBox provides a credential-free, labeled simulation of one
> strict Solana Mainnet USDC-to-SOL swap mandate. It uses transaction-shaped
> local fixtures and deterministic checks to return PASS, BLOCK, or REVIEW
> with an unkeyed SHA-256 local self-consistency checksum. It can also classify
> a saved MCP tools/list capture offline and documents the evidence PayBox
> would need to expose before a live preflight. PayBox, production Delta,
> Swaps.xyz, Solana, and other networks are not contacted. No signature or
> transaction can be produced. A local conformance kit models the exact
> contract a future mandatory PayBox signing hook would need to validate, but
> it is not a cryptographic grant, provider integration, or enforcement
> boundary.

Current evidence:

- skill, runner, CLI, compiler, policy, fixture builder, evidence normalizer,
  decisions, receipt, nonce/history, report, and validation modules;
- strict 25 USDC custom fixture through a saved plan and exact displayed
  digest;
- exact decoded-operation and message-byte binding;
- full-evidence nonce binding and stale/expired replay prevention;
- atomic cross-process once-write and canonical one-use policy consumption;
- offline `inspect-tools` CLI and conservative classifier;
- `SOLANA-EVIDENCE-CONTRACT.md`;
- private versioned managed installer with exact file-digest manifest,
  restricted-`PATH` runtime discovery, idempotency, verified explicit upgrade,
  source-deletion durability, and separate product-level replay state that
  survives an upgrade;
- pure local signing-hook contract and always-locked production composition;
- 133/133 full-suite, 17/17 installer, 10/10 signing-hook, and 2/2
  release-content scanner test runs;
- passing skill, link, metadata, and source-content checks;
- current-only README.

The checksum is unkeyed. An active editor can change a record and recompute
it, so it is not a Delta signature, provider-authenticity proof, or
adversarial tamper protection. The CLI compares a confirmation digest but
cannot authenticate chat authorship. The skill can be bypassed if another
PayBox mutation tool remains available. The same-commit/same-toolchain archive
repeatability scripts are implemented, but a committed release archive and
independent Mini-sprint 3 review have not yet passed, so no GitHub release is
claimed.

### Future live-preflight candidate wording

> Protected PayBox can run a read-only preflight for one exact supported
> on-chain swap. It binds authenticated PayBox wallet/proposal facts, fresh
> chain and route evidence, independent simulation, and exact unsigned
> transaction bytes. A PASS is point-in-time preflight evidence only. No
> signature is requested and nothing is broadcast.

Required evidence before this wording is allowed:

- adapter owns authenticated PayBox reads;
- exact unsigned candidate exists before signing;
- complete transaction decoding and simulation;
- mutation and stale-evidence tests;
- no reachable mutation;
- full deferred live-preflight gate.

### Current signing-hook wording

> Protected PayBox includes a conformance kit that demonstrates the exact
> field, semantic, expiry, and local one-use checks PayBox would need at its
> signing boundary.
> The public package remains non-signing and does not claim a live PayBox or
> production Delta integration.

Implemented evidence:

- managed installer and allowlisted release manifest;
- exact per-file SHA-256 verification and restricted-`PATH` install tests;
- closed conformance contract and pure local verifier;
- mutation, semantic-bound, audience, expiry, sequential-replay, and
  same-process concurrency tests;
- always-locked production composition; and
- explicit partner responsibility and deferred production gates.

Still required before release or enforcement wording:

- committed deterministic archive/checksum validation;
- independent Mini-sprint 3 review and later GitHub artifact re-download;
- cryptographic issuer proof and provider-authenticated reconstruction;
- durable cross-process and cross-region consumption;
- restart, revocation, recovery, and uncertain-submission conformance against
  an actual PayBox sandbox; and
- a mandatory PayBox hook with no raw mutation bypass.

## Permanently prohibited without new evidence

Do not say:

- "PayBox is integrated with Delta."
- "Every PayBox action is protected."
- "The skill prevents bypass."
- "PASS means PayBox will sign or the trade will fill."
- "The receipt authenticates PayBox or chain data."
- "This is a cryptographic Delta receipt."
- "Protected PayBox assigns liability."
- "Protected PayBox reverses an on-chain payment."
- "Solana, EVM, prediction markets, lending, perps, cards, x402, or ecommerce
  are supported" before their complete end-to-end gates pass.

## Claim-review rule

Before every push or release:

1. inspect compiler, policy, proposer, adapters, evidence, decisions, receipt,
   reconciliation, tests, release contents, and installed behavior;
2. downgrade any claim not supported across all relevant layers;
3. update this ledger;
4. rewrite README to describe the current verified release only;
5. run the release scan and independent re-download verification.

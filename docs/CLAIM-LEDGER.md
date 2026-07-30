# Protected PayBox claim ledger

Status: current repository truth  
Date: 2026-07-30

## Status vocabulary

- `VERIFIED_CURRENT`: directly evidenced by the current checked-in repository.
- `EXTERNAL_SOURCE`: stated by a cited primary external source, not verified
  through the current implementation.
- `DESIGN_TARGET`: approved requirement, not implemented.
- `UNKNOWN`: must be discovered or tested.
- `LOCKED`: deliberately unavailable in the public build.

## Current product claims

| Claim | Status | Current evidence | Allowed wording |
| --- | --- | --- | --- |
| A Protected PayBox repository exists | `VERIFIED_CURRENT` | Local Git repository and scaffold | "Protected PayBox is being designed as a separate partner prototype." |
| A completed Protected PayBox skill exists | `UNKNOWN` | Current `SKILL.md` is an unimplemented scaffold with TODOs | "The skill workflow is not implemented yet." |
| Project plan and security requirements exist | `VERIFIED_CURRENT` | Files under `docs/` | "The initial scope, sprint gates, and security boundary are documented." |
| Partial deterministic planning modules exist | `VERIFIED_CURRENT` | Package, launcher, canonical/decimal/validation/constants/policy modules | "Closed Solana intent validation and policy-plan construction are partially implemented." |
| A complete executable guard flow exists | `LOCKED` | CLI, proposal/evidence/simulation/decision/receipt pipeline and tests are incomplete | "No end-to-end protected flow is currently runnable." |
| The current build evaluates proposals | `LOCKED` | No evidence, proposal, simulation, or decision engine exists | "No candidate currently receives PASS, BLOCK, or REVIEW." |
| The current build has PayBox OAuth integration | `LOCKED` | No OAuth client or session exists | "PayBox has not been connected from this repository." |
| The PayBox MCP tool surface has been captured here | `UNKNOWN` | No authenticated contract artifact exists in this repository | "Authenticated tool discovery is a Sprint 1 gate." |
| The current build reads PayBox wallet data | `LOCKED` | No adapter exists | "No PayBox wallet or account data is read." |
| The current build obtains live quotes or chain data | `LOCKED` | No adapter exists | "No external market, route, RPC, or chain data is used." |
| The current build simulates transactions | `LOCKED` | No simulator exists | "No transaction simulation is currently implemented." |
| The current build returns `PASS`, `BLOCK`, or `REVIEW` | `DESIGN_TARGET` | Constants and requirements exist; decision pipeline does not | "The planned decision model is PASS/BLOCK/REVIEW." |
| The current build creates a receipt | `LOCKED` | No receipt implementation exists | "No receipt is currently created." |
| The current build signs or broadcasts | `LOCKED` | No runtime or signing adapter exists | "Nothing can be signed, broadcast, or moved." |
| The current build integrates production Delta | `LOCKED` | No Delta adapter exists | "Production Delta is not integrated." |
| A skill alone prevents raw PayBox bypass | `LOCKED` | A skill cannot remove other connected tools | "True enforcement requires a PayBox signing-boundary hook or exclusive protected proxy." |
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
| Solana is the selected implementation chain | `DESIGN_TARGET` | Preferred because it best matches PayBox launch emphasis; subject to authenticated visibility gate | "Solana is the primary candidate." |
| Protected PayBox supports Solana swaps | `LOCKED` | A fixed USDC-to-SOL policy profile is partial; no complete compiler, adapter, decoder, quote, simulator, or decision exists | "The first planned profile is one USDC-to-SOL swap." |
| Protected PayBox supports EVM swaps | `LOCKED` | Fallback design only | "EVM is the fallback if it provides materially better pre-sign visibility." |
| Protected PayBox supports any AMM | `LOCKED` | No venue is selected | "Only one fully verified route may enter initial scope." |
| Protected PayBox supports all tokens | `LOCKED` | No runtime token validation exists | "No static token-count or generic-token claim is permitted." |
| Protected PayBox supports prediction markets | `LOCKED` | Deferred taxonomy | "Prediction markets are an expansion candidate after the swap path is proven." |
| Protected PayBox supports lending, perps, or tokenized equities | `LOCKED` | Deferred taxonomy and evidence work | Do not use current-capability language |
| Protected PayBox supports x402 or ecommerce | `LOCKED` | Service/item-delivery evidence is not designed | Do not use current-capability language |

## Planned release claims

These phrases become usable only after the matching release gate passes.

### Sprint 1 candidate wording

> Protected PayBox provides a credential-free, labeled simulation of one
> conditional on-chain swap mandate. It uses local fixtures and deterministic
> checks to return PASS, BLOCK, or REVIEW with a locally verifiable
> tamper-evident receipt. PayBox, production Delta, and the chain are not
> contacted. No signature or transaction can be produced.

Required evidence:

- implemented compiler, policy, proposer, decisions, receipt, nonce/history,
  tests, installer, and skill;
- authenticated `tools/list` captured separately without a mutation;
- full Sprint 1 release gate;
- README and release assets match the claim.

### Sprint 2 candidate wording

> Protected PayBox can run a read-only preflight for one exact supported
> on-chain swap. It binds authenticated PayBox wallet/proposal facts, fresh
> chain and route evidence, independent simulation, and exact unsigned
> transaction bytes. A PASS is point-in-time preflight evidence only. No
> signature is requested and nothing is broadcast.

Required evidence:

- adapter owns authenticated PayBox reads;
- exact unsigned candidate exists before signing;
- complete transaction decoding and simulation;
- mutation and stale-evidence tests;
- no reachable mutation;
- full Sprint 2 release gate.

### Sprint 3 candidate wording

> Protected PayBox includes a conformance kit that demonstrates the exact
> proof and one-use-grant checks PayBox would need at its signing boundary.
> The public package remains non-signing and does not claim a live PayBox or
> production Delta integration.

Required evidence:

- conformance contract and test server;
- proof mismatch, expiry, wallet/client mismatch, replay, concurrency, restart,
  revocation, and uncertain-submission tests;
- full Sprint 3 release gate;
- partner responsibility model.

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

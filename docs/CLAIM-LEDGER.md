# Claim Ledger

Status labels:

- `IMPLEMENTED`: present in current source and covered by tests.
- `EXTERNAL_SOURCE`: stated by a linked primary source, not proven locally.
- `FIXTURE_ONLY`: true only of labeled local data.
- `LOCKED`: deliberately unavailable.
- `PARTNER_REQUIRED`: depends on authenticated PayBox/provider integration.

## Current product claims

| Claim | Status | Evidence / approved wording |
| --- | --- | --- |
| Protected PayBox evaluates a closed card mandate | `IMPLEMENTED` | Card policy/evidence/evaluator modules and scenario tests |
| DoorDash has a complete demo decision matrix | `FIXTURE_ONLY` | One `PASS`, ten `BLOCK`, five `REVIEW` scenarios; “DoorDash-shaped local fixture” |
| Amazon, Uber, Instacart, Walmart, and Target share the schema | `FIXTURE_ONLY` | Each has a labeled happy-path fixture; never call this merchant coverage |
| Money uses exact minor units | `IMPLEMENTED` | Integer strings and `BigInt` arithmetic |
| Checkout changes are detected | `IMPLEMENTED` | Snapshot digest recomputation and receipt binding |
| A plan can pass only once in persisted fixture history | `IMPLEMENTED` | Exact replay converges; temporal `REVIEW` promotion atomically consumes the plan; different nonce returns `PLAN_ALREADY_USED` |
| CLI and MCP reject raw credential-shaped input | `IMPLEMENTED` | Recursive key, property-name, and value rejection with no-echo tests |
| The local record is tamper-evident | `IMPLEMENTED` | “Unkeyed SHA-256 self-consistency checksum” |
| The local record is a production Delta proof | `LOCKED` | It is not signed, authenticated, non-repudiable, or a guarantee |
| The demo contacts PayBox, Delta, a merchant, or a card network | `LOCKED` | Boundary flags and production composition lock |
| The demo issues a card, authorizes a charge, or places an order | `LOCKED` | No network/execution adapter exists |
| A skill alone prevents bypass | `LOCKED` | A skill cannot gate another connected PayBox mutation tool |
| Real enforcement can be added at credential release | `PARTNER_REQUIRED` | Requires mandatory PayBox hook, exact binding, fresh Delta proof, no alternate path |

## External product facts

| Claim | Status | Source / constraint |
| --- | --- | --- |
| PayBox describes scoped grants and one-time credentials | `EXTERNAL_SOURCE` | [PayBox credential model](https://support.moonpay.com/en/articles/669779-paybox-store-credentials-once-let-ai-agents-pay-securely) |
| PayBox payment cards are documented as Phase 2/future | `EXTERNAL_SOURCE` | [PayBox FAQ](https://support.moonpay.com/en/articles/669843-paybox-faqs); do not imply live card tools |
| PayBox card API/provider/merchant list is public | `LOCKED` | Not observed in reviewed public sources |
| MoonAgents Card is a crypto-funded virtual Mastercard debit card | `EXTERNAL_SOURCE` | [MoonAgents Card](https://support.moonpay.com/en/articles/629708-moonagents-card-crypto-funded-virtual-payment-cards); separate from PayBox cards |
| DoorDash is verified PayBox/MoonAgents coverage | `LOCKED` | No end-to-end transaction evidence reviewed |
| PayBox uses Resy | `LOCKED` | Not established by reviewed primary sources |
| MoonPay CLI uses swaps.xyz | `EXTERNAL_SOURCE` | Relevant to future swap adapter, not proof of PayBox tool parity |

## Evidence claims

| Claim | Status | Approved interpretation |
| --- | --- | --- |
| Generalized extraction can classify item semantics | `PARTNER_REQUIRED` | Current fixtures recompute solution/request/response bindings but have no source artifact; live use needs non-financial scalar attributes plus source provenance |
| Generalized extraction can establish checkout total or authorization | `LOCKED` | Money, merchant identity, credential status require authenticated sources |
| Missing/stale/conflicting evidence blocks release | `IMPLEMENTED` | Current fixture runtime returns `REVIEW`; production gate must treat it as non-releasable |
| Fixture provenance is provider authenticated | `LOCKED` | Exact accepted provenance is `SELF_REPORTED_FIXTURE` |

## Distribution claims

| Claim | Status | Evidence |
| --- | --- | --- |
| Repository root is a Codex plugin | `IMPLEMENTED` | Plugin manifest, MCP config, plugin validation |
| Skill installer creates a managed private copy | `IMPLEMENTED` | Installer suite, digest marker, path/symlink protections |
| MCP is dependency-free and supports current discovery | `IMPLEMENTED` | Modern `resultType`, unsupported-version, legacy-compatibility, and tool tests |
| Release ZIP is deterministic and cold validated | `IMPLEMENTED` only after current release gate | Build script and source-deletion validator; report exact result after run |
| GitHub tag/asset is published and verified | `IMPLEMENTED` only after publish | Do not claim until remote tag, asset digest, and re-download checks pass |

## Prohibited shorthand

Do not say:

- “Protected PayBox supports DoorDash.”
- “Works anywhere cards are accepted.”
- “PayBox cards are live.”
- “Delta prevented a charge” when no charge was attempted.
- “Cryptographic proof” without qualifying the unkeyed local checksum.
- “The skill prevents bypass.”
- “Full PayBox coverage.”

Say:

```text
This local partner-evaluation fixture shows the exact card-purchase decision
Delta could enforce at PayBox's future credential-release boundary. It made no
PayBox, merchant, card, or network call.
```

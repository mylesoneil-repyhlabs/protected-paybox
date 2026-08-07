# Claim Ledger

Status labels:

- `IMPLEMENTED`: present in current source and covered by tests.
- `DISCOVERY_ONLY`: real authenticated connectivity with financial calls absent.
- `EXTERNAL_SOURCE`: stated by a linked primary source, not proven locally.
- `FIXTURE_ONLY`: true only of labeled local data.
- `LOCKED`: deliberately unavailable.
- `PARTNER_REQUIRED`: requires a mandatory PayBox/provider integration.
- `RELEASE_PENDING`: implemented in the current candidate but not yet backed by
  a published v0.5 release gate.

## Current product claims

| Claim | Status | Evidence / approved wording |
| --- | --- | --- |
| A user can authorize a PayBox client with OAuth 2.1 authorization code and PKCE S256 | `DISCOVERY_ONLY` | Dynamic public-client registration, exact loopback callback, state validation, `mcp` scope |
| The PayBox access token is session-only | `IMPLEMENTED` | Memory-only, no `offline_access`, refresh tokens/broader scopes rejected, discarded on disconnect/expiry/process exit |
| Protected PayBox performs authenticated PayBox MCP discovery | `DISCOVERY_ONLY` | Upstream `initialize`, `notifications/initialized`, and paginated `tools/list` only; this reads the account-specific catalog and enabled-plugin configuration |
| The model sees a redacted discovery summary | `IMPLEMENTED` | Digest-derived aliases, name digests, classifications, risk flags, input/output schema digests; no raw names, tokens, codes, client/session IDs, descriptions, or schemas. Digests are not confidential or dictionary-resistant; `observed_at` is outside the deterministic snapshot digest |
| Protected PayBox can call a discovered PayBox tool | `LOCKED` | No upstream `tools/call`, REST, SDK, or CLI execution implementation |
| Protected PayBox reads credentials, balances, cards, request history, or other financial resources | `LOCKED` | `list_credentials`, `get_portfolio`, `get_request`, `list_requests`, and plugin tools are not called; `tools/list` still reads account-specific catalog/configuration |
| A discovered tool is automatically safe to call | `LOCKED` | Every discovered tool is unreviewed and mandate-gated regardless of name, classification, or schemas |
| Protected PayBox evaluates a closed card mandate | `IMPLEMENTED` | Card policy/evidence/evaluator modules and scenario tests |
| DoorDash has a complete demo decision matrix | `FIXTURE_ONLY` | One `PASS`, ten `BLOCK`, five `REVIEW` scenarios; “DoorDash-shaped local fixture” |
| Amazon, Uber, Instacart, Walmart, and Target share the schema | `FIXTURE_ONLY` | Each has a labeled happy-path fixture; never call this merchant coverage |
| Money uses exact minor units | `IMPLEMENTED` | Integer strings and `BigInt` arithmetic |
| Checkout changes are detected | `IMPLEMENTED` | Snapshot digest recomputation and receipt binding |
| A fixture plan can pass only once in persisted local history | `IMPLEMENTED` | Exact replay converges; temporal `REVIEW` promotion atomically consumes the plan; different nonce returns `PLAN_ALREADY_USED` |
| CLI and MCP reject raw credential-shaped input | `IMPLEMENTED` | Recursive key, property-name, and value rejection with no-echo tests |
| The local record is tamper-evident | `IMPLEMENTED` | “Unkeyed SHA-256 self-consistency checksum” |
| The local record is a production Delta proof | `LOCKED` | It is not signed, authenticated, non-repudiable, or a guarantee |
| The connection path moves money or requests a credential | `LOCKED` | OAuth/MCP method allowlist; no remote tool call |
| The fixture evaluation contacts PayBox, Delta, a merchant, or a card network | `LOCKED` | Fixture record boundary flags and financial composition lock |
| A skill plus OAuth prevents bypass | `LOCKED` | The official connector, SDK/CLI, or another token-bearing client can bypass a local gate |
| Real enforcement can be added at credential release/signing | `PARTNER_REQUIRED` | Requires mandatory PayBox proof consumption, exact binding, fresh Delta proof, and no alternate mutation path |

## External product facts

| Claim | Status | Source / constraint |
| --- | --- | --- |
| PayBox exposes an OAuth 2.1 + PKCE MCP connector | `EXTERNAL_SOURCE` | [OAuth](https://docs.paybox.sh/connect/oauth) and [MCP connector](https://docs.paybox.sh/connect/mcp) |
| PayBox documents `request_payment` | `EXTERNAL_SOURCE` | [MCP tools](https://docs.paybox.sh/reference/mcp-tools#request_payment): granted card ID, merchant, real HTTPS origin, integer cents, currently USD |
| PayBox documents one-use `claim_payment_credentials` after approval | `EXTERNAL_SOURCE` | [MCP tools](https://docs.paybox.sh/reference/mcp-tools#claim_payment_credentials); this returns usable card details and is not called here |
| PayBox's developer reference names Basis Theory origin binding and token metadata | `EXTERNAL_SOURCE` | Does not establish issuer, processor, network, geography, or merchant coverage |
| Older Help Center pages call payment cards Phase 2/future | `EXTERNAL_SOURCE` | [PayBox FAQ](https://support.moonpay.com/en/articles/669843-paybox-faqs); conflicts with current developer docs and is not the sole current product claim |
| The documented card tools are enabled for the user's account | `PARTNER_REQUIRED` | Must be confirmed by authenticated account `tools/list`; public docs alone are insufficient |
| `request_payment` places the merchant order or proves a charge | `LOCKED` | PayBox explicitly says it only requests a one-time card; merchant checkout is separate |
| PayBox supports DoorDash end to end | `LOCKED` | No authenticated tool/merchant transaction evidence reviewed |
| PayBox documents generalized `request_swap` fields | `EXTERNAL_SOURCE` | [MCP tools](https://docs.paybox.sh/reference/mcp-tools#request_swap); actual pair/chain support is quote- and account-dependent |
| The current plugin supports arbitrary PayBox swaps | `LOCKED` | It discovers schemas only and retains one fixed offline USDC-to-SOL fixture |
| PayBox uses Resy | `LOCKED` | Not established by the reviewed primary documentation |
| MoonAgents Card is a crypto-funded virtual Mastercard debit card | `EXTERNAL_SOURCE` | [MoonAgents Card](https://support.moonpay.com/en/articles/629708/moonagents-card-crypto-funded-virtual-payment-cards); separate from the PayBox request-payment contract |

## Evidence claims

| Claim | Status | Approved interpretation |
| --- | --- | --- |
| Generalized extraction can classify item semantics | `PARTNER_REQUIRED` | Current fixtures recompute solution/request/response bindings but have no source artifact; live use needs non-financial scalar attributes plus provenance |
| Generalized extraction can establish checkout total or authorization | `LOCKED` | Money, merchant identity, credential status, and merchant result require authenticated sources |
| Missing/stale/conflicting evidence blocks release | `IMPLEMENTED` | Current fixture runtime returns `REVIEW`; production gate must treat it as non-releasable |
| Fixture provenance is provider authenticated | `LOCKED` | Exact accepted provenance is `SELF_REPORTED_FIXTURE` |
| Authenticated `tools/list` is transaction evidence | `LOCKED` | It proves a returned catalog/schema only, not account state or execution |

## Distribution and release claims

| Claim | Status | Evidence |
| --- | --- | --- |
| Repository root is a Codex plugin | `IMPLEMENTED` | Plugin manifest, MCP config, plugin validation |
| Skill installer creates a managed private copy | `IMPLEMENTED` | Installer suite, digest marker, path/symlink protections |
| Local MCP is dependency-free and supports current discovery | `IMPLEMENTED` | Modern result semantics, unsupported-version, legacy compatibility, and tool tests |
| v0.5 connection/discovery release is published and cold verified | `RELEASE_PENDING` | Do not claim until committed source, Node 22/24 CI, deterministic bundle, source-deletion cold install, checksum, and live non-financial revocation smoke test pass |
| The previously published v0.4.0 artifact was verified | `IMPLEMENTED` | Historical release evidence only; it does not contain the v0.5 PayBox connection |

## Prohibited shorthand

Do not say:

- “Protected PayBox can use my PayBox account.”
- “Protected PayBox supports DoorDash.”
- “Works anywhere cards are accepted.”
- “PayBox cards are Phase 2” as the only current truth.
- “PayBox cards work for this account” without authenticated discovery and a
  sandbox execution.
- “Delta prevented a charge” when no charge was attempted.
- “OAuth means the transaction is protected.”
- “Cryptographic proof” without qualifying the unkeyed local checksum.
- “The skill prevents bypass.”
- “Full PayBox coverage.”

Approved current wording:

```text
Protected PayBox can connect to PayBox for this local session and inspect the
authenticated account-specific tool catalog and enabled-plugin configuration.
It cannot call any PayBox tool; read credentials, balances, card details, or
request history; request or claim a card; place an order; sign; swap; or move
money. Its local fixtures show the decision Delta could enforce only if PayBox
makes that check mandatory at the credential or signing boundary.
```

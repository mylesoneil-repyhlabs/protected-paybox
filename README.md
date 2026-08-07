# Protected PayBox

Protected PayBox combines authenticated PayBox capability discovery with a
separate card-first Delta-mandate simulation. It does not yet put Delta in the
live PayBox credential path. It ships as one local Codex plugin with a bundled
skill and dependency-free MCP server.
DoorDash is the reference journey; Amazon, Uber, Instacart, Walmart, and Target
are representative fixture profiles.

The current build can connect to a PayBox account through OAuth 2.1 in the
user's browser and fetch authenticated `initialize` and `tools/list` responses.
That discovery reads the account-specific tool catalog and enabled-plugin
configuration exposed to the authorized client; it does not read credentials,
balances, request history, card details, or other financial resources.
The access token is held only in memory for that local process. The connector
requests only `mcp`, not `offline_access`; it stores no access token, refresh
token, authorization code, PKCE verifier, PayBox password, passkey, card data,
or signing key.

Authenticated connection does not enable execution. The remote client has no
`tools/call` implementation, so it cannot list account credentials, request or
claim a payment card, reveal a secret, sign, swap, place an order, or move
funds. Fixture evaluation remains local and uses no production Delta service.

PayBox's current developer documentation describes Basis Theory card
tokenization plus `request_payment` and `claim_payment_credentials`. The first
authorizes a merchant-and-amount-scoped one-time card; it does not submit the
merchant checkout. Those tools remain deliberately unreachable here. Public
developer docs and the older MoonPay Help Center disagree on card rollout, so
actual availability and grants must be established from the authenticated
account surface, not marketing copy.

Representative fixtures are not merchant coverage. This release is a
desktop/local partner-evaluation plugin. It is not a hosted
ChatGPT or Claude mobile connector and does not reproduce PayBox's mobile
experience.

## What the demo proves

For a closed card-purchase mandate, the demo can:

1. compile exact merchant, basket, price, fee, tip, destination, expiry, and
   payment-envelope constraints into a canonical policy;
2. model a caller-supplied confirmation digest for custom plans, while labeling
   canned fixtures as auto-bound with no user authorization;
3. evaluate an exact checkout snapshot and proposed one-time credential scope;
4. return deterministic `PASS`, `BLOCK`, or `REVIEW` reason codes;
5. bind the policy, checkout snapshot, proposal, evidence, decision, one-use
   state, and public execution boundary in a local record; and
6. reject a second successful use of a persisted mandate.

It does not yet provide a production Delta proof. Its receipt uses an **Unkeyed SHA-256 self-consistency checksum**, useful for tamper detection in the demo
but not publisher authentication, non-repudiation, or a guarantee.

## Card coverage

The DoorDash fixture matrix exercises:

| Decision | Examples |
| --- | --- |
| `PASS` | Exact merchant, basket, totals, destination, and one-time credential envelope satisfy the mandate |
| `BLOCK` | Wrong platform or storefront, excessive total or tip, wrong/missing item, changed quantity, recurring flag, excessive credential expiry, changed address, or subscription |
| `REVIEW` | Stale checkout, low-confidence or incomplete semantics, inconsistent arithmetic, or snapshot tampering |

The same merchant-neutral schema has a labeled happy-path fixture for six
commerce archetypes:

| Fixture | Archetype | Current status |
| --- | --- | --- |
| DoorDash | Meal delivery | Simulated fixture only |
| Amazon | Marketplace retail | Simulated fixture only |
| Uber | Mobility | Simulated fixture only |
| Instacart | Grocery delivery | Simulated fixture only |
| Walmart | Omnichannel retail | Simulated fixture only |
| Target | Omnichannel retail | Simulated fixture only |

These names demonstrate taxonomy portability. They do not prove payment-rail
acceptance, ordering access, authenticated evidence, PayBox support, or live
enforcement.

## Quick start

Requires Node.js 22 or newer. No package installation is required.

Connect a PayBox account for one session and capture a private authenticated
tool snapshot:

```bash
./run paybox-connect \
  --out /absolute/private/paybox-tools.json
```

The flow has already registered the uniquely labeled client printed by the
command. Open its PayBox URL in a browser on the same computer and approve only
in PayBox. The `mcp` bearer carries the full authority of every credential grant
you select even though this implementation calls only `initialize` and
`tools/list`. Select no credential if PayBox permits; otherwise select one
least-sensitive non-secret evaluation credential and require human approval
for every operation. Never grant a raw secret for this test. The command
performs authenticated capability discovery, closes the MCP session, and
discards the in-memory token before printing its final result. Every connect
attempt may leave its named registered client in PayBox, including an incomplete
or failed attempt. Revoke every name reported by the command separately in
PayBox's Clients screen when finished; its OAuth metadata does not advertise a
revocation endpoint.

No PayBox account is required for the local fixture demos:

```bash
./run card-demo --merchant doordash --scenario block-total
./run card-demo --merchant doordash --scenario pass
./run card-demo --merchant doordash --scenario review-incomplete
```

Optional diagnostics:

```bash
./run doctor
./run card-merchants
```

Create a private custom mandate from the bundled example:

```bash
./run card-plan \
  --intent /absolute/path/to/examples/card/doordash-intent.json \
  --details
```

Show the resulting mandate in full. The intended host workflow asks for a
separate confirmation message, then supplies the exact matching digest:

```bash
./run card-demo \
  --plan /absolute/path/to/card-plan.json \
  --confirm-policy <displayed-policy-digest> \
  --scenario pass
```

The harness binds the supplied digest but cannot prove who authored the chat message.
It models confirmation; it does not enforce human authorization or identity.

## Plugin and skill

The repository root is a Codex plugin:

- `.codex-plugin/plugin.json` declares the plugin;
- `.mcp.json` launches the bundled local MCP through the portable `./run`
  launcher; and
- `skills/protected-paybox/` supplies the operator workflow and claim boundary.

Download and extract the release ZIP, then add the extracted directory as a
local plugin. To install only the skill and managed harness:

```bash
./install
```

The installer creates a private, versioned managed copy and links only the
skill. It records file digests, refuses unsafe path or symlink layouts, and
continues to work after the downloaded source is removed.

Local permissions: network access is used only after an explicit PayBox connect
or authenticated sync action; secret-shaped tool arguments are rejected; OAuth
tokens are memory-only; the harness reads only files explicitly supplied to
commands; plan/record writes are local and owner-only; and custom MCP
evaluations retain private one-use history. A source-checksummed release does
not authenticate its publisher.

The MCP exposes ten tools. Four manage session-only PayBox connection and
authenticated discovery; six operate the local fixture harness:

- `protected_paybox_capabilities`
- `protected_paybox_connect`
- `protected_paybox_connection_status`
- `protected_paybox_sync_tools`
- `protected_paybox_disconnect`
- `protected_paybox_card_plan`
- `protected_paybox_card_demo`
- `protected_paybox_card_evaluate`
- `protected_paybox_swap_demo`
- `protected_paybox_verify_record`

It supports MCP `2026-07-28` stateless discovery and the retained legacy
initialize flow. It rejects raw PAN, CVV, private-key, seed, OAuth-token, and
client-secret shaped fields before evaluation. Authenticated PayBox discovery
uses PayBox's documented streamable HTTP protocol `2025-06-18`. Remote tool
descriptions, schemas, and tool names are treated as untrusted: MCP callers
receive stable aliases, name digests, conservative classifications, risk flags,
and input/output schema digests. Raw names and structurally redacted schemas
appear only in an explicitly requested owner-only snapshot file; authenticated
provider descriptions are replaced with a redaction marker even there. Aliases
are derived from the name digest rather than provider ordering. Name and schema
digests reduce direct
prompt-injection exposure, but they are not confidential or dictionary-resistant
representations of a small known tool vocabulary. `observed_at` records when the
catalog was seen and is deliberately outside the deterministic snapshot digest.
Every discovered tool remains unreviewed and mandate-gated; none is treated as a
safe read, regardless of its name, classification, or schemas.

## Evidence contract

Financial facts and product semantics have different authority requirements:

| Evidence class | Examples | Live source required for enforcement |
| --- | --- | --- |
| Financial/identity | Merchant ID, domain, amount, currency, subtotal, tax, fees, tip, destination digest, credential scope | Authenticated PayBox, merchant, processor, or issuer artifact |
| Product semantics | Item category, dietary attribute, condition, seller, restricted-item flag | Future generalized-extractor output with source provenance; current fixtures bind only solution plus recomputed request/response digests and confidence |

The generalized evidence extractor is suitable for non-financial product
semantics only. It must not determine the amount, fees, merchant identity,
currency, card authorization, or whether funds moved. Missing, stale,
ambiguous, contradictory, or internally inconsistent evidence returns
`REVIEW`; it never fails open.

All monetary values are integer minor-unit strings. The checkout snapshot
digest binds merchant, items, arithmetic, destination, risk flags, and the
proposed credential request. A changed field after evaluation invalidates the
snapshot.

## What real enforcement requires

A skill or BYOA MCP can guide the agent, but the agent can bypass it if the raw
PayBox connector remains available. This release avoids that problem by
exposing no PayBox mutations at all. Bypass-resistant execution still requires
a mandatory Delta check inside PayBox's credential-release boundary:

1. A merchant/evidence component supplies the basket semantics and an
   authenticated checkout digest to the protected gate.
2. PayBox authenticates the agent, forms its exact PAN-free credential envelope,
   and sends operation/grant IDs, merchant scope, amount, currency, use count,
   expiry, proposal digest, and evidence digest.
3. Delta returns a compact fresh signed release token bound to those exact
   fields; PayBox need not receive the underlying basket.
4. PayBox returns a one-time credential only for an exact, unconsumed `PASS`.
5. `BLOCK`, `REVIEW`, timeout, stale proof, or mismatch blocks autonomous
   release. PayBox may route to separately authenticated passkey approval, which
   is logged as direct human approval rather than a Delta `PASS`.
6. PayBox, its processor, or issuer supplies available credential,
   authorization, capture, reversal, refund, and expiry events for
   reconciliation.

Pilot latency targets, to be validated with PayBox, are p95 at or below 500 ms,
p99 at or below 1,000 ms, and a 1,500 ms hard hook deadline when evidence is
already available. The hook contains no PAN, CVV, or reusable credential.

The analogous swap boundary remains a mandatory Delta check before PayBox
signing/broadcast. Live quote/chain/simulation evidence is not present in this
release.

## Preserved swap fixture

The plugin also includes one fixed Solana USDC-to-SOL exact-input simulation:

```bash
./run demo --scenario block-minimum-receive
./run demo --scenario pass
```

It does not support arbitrary swap assets, live quotes, wallet access, signing,
or broadcast.

## Roadmap

### Current release: account connection and card core

- session-only PayBox OAuth 2.1 with PKCE S256 and exact issuer/resource pins;
- authenticated, bounded, redacted `tools/list` discovery;
- no refresh token, token persistence, generic remote call, or financial tool;
- card purchase is the default demo;
- DoorDash has a full decision matrix;
- five additional representative commerce-archetype fixtures prove
  common-schema reuse;
- exact checkout and credential-request binding;
- one-use persisted fixture ledger;
- local MCP plus installable skill/plugin; and
- execution remains locked.

### Next engineering release: reviewed adapters and authenticated evidence

- review the owner-only authenticated snapshot and pin approved name, input,
  and output-schema digests;
- build only explicit, mandate-gated adapters after human review of each exact
  input/output contract; no discovered tool is auto-enabled as a safe read;
- a generalized-extractor adapter for product semantics;
- raw-artifact golden corpus and adversarial extraction tests;
- merchant/provider provenance and field-level source digests;
- lifecycle state and authorization/capture/refund reconciliation; and
- a PayBox hook conformance server and event simulator.

### Protected payment engineering candidate — partner hook required

- production Delta signatures and policy evaluation using pinned authorized
  Repyh dependencies;
- a merchant checkout adapter that supplies authenticated basket and amount
  evidence;
- a partner-confirmed exclusive protected `request_payment` path bound to the exact merchant
  HTTPS origin, integer USD cents, currency, checkout digest, and one-use Delta
  decision;
- route both usable card authority returned immediately by an autonomous
  `request_payment` and later `claim_payment_credentials` output directly to an
  isolated credential broker or merchant executor, never through model context;
  and
- submit once, then reconcile with `get_request`; never re-call a write tool to
  finish a pending operation.

### PayBox partner release

- a PayBox sandbox and verified merchant/region/card eligibility;
- mandatory pre-credential Delta hook with no alternate mutation path;
- real signed Delta proof using pinned released Repyh dependencies;
- provider idempotency and uncertain-result reconciliation; and
- negotiated hook latency plus authenticated human/passkey fallback; and
- verified merchant/region coverage based on end-to-end transactions.

Current primary references: [PayBox OAuth](https://docs.paybox.sh/connect/oauth),
[MCP connector](https://docs.paybox.sh/connect/mcp),
[MCP tools](https://docs.paybox.sh/reference/mcp-tools), and
[request lifecycle](https://docs.paybox.sh/concepts/requests).

## Verification

Run the complete local gate:

```bash
npm test
npm run check:skill
npm run check:links
npm run check:release
npm run check:content
```

Release bundles are deterministic, content-scanned, cold-installed under a
restricted `PATH`, tested after the extracted source is deleted, and accompanied
by a SHA-256 checksum. CI tests Node 22 and Node 24 with Actions pinned to
immutable commit SHAs.

## Documentation

- [Design](docs/DESIGN.md)
- [Tools](docs/TOOLS.md)
- [Card evidence contract](docs/CARD-EVIDENCE-CONTRACT.md)
- [Card execution contract](docs/CARD-EXECUTION.md)
- [Modules](docs/MODULES.md)
- [Project plan](docs/PROJECT-PLAN.md)
- [Sprint log](docs/SPRINT-LOG.md)
- [Security boundary](docs/SECURITY-BOUNDARY.md)
- [Claim ledger](docs/CLAIM-LEDGER.md)
- [Research](docs/RESEARCH.md)
- [Stakeholder reviews](docs/STAKEHOLDER-REVIEWS.md)

## Primary research

- [PayBox](https://paybox.sh/)
- [PayBox credential model](https://support.moonpay.com/en/articles/669779-paybox-store-credentials-once-let-ai-agents-pay-securely)
- [PayBox agent connections](https://support.moonpay.com/en/articles/669841-how-agent-connections-work-in-paybox)
- [PayBox FAQ](https://support.moonpay.com/en/articles/669843-paybox-faqs)
- [MoonAgents Card](https://support.moonpay.com/en/articles/629708-moonagents-card-crypto-funded-virtual-payment-cards)
- [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)

Protected PayBox is an independent partner-evaluation prototype in a personal
repository. It is not a MoonPay or PayBox product.

# Security Boundary

## Current boundary

Protected PayBox is no longer wholly offline. It has an optional PayBox account
connection whose complete upstream allowlist is:

- OAuth challenge and metadata reads;
- dynamic public-client registration;
- authorization-code exchange with PKCE S256;
- MCP `initialize`;
- MCP `notifications/initialized`;
- paginated MCP `tools/list`; and
- best-effort MCP session `DELETE` on disconnect.

It does not implement upstream `tools/call`, REST API methods, SDK/CLI execution,
credential/balance/card/request-history reads, credential listing, payment
requests, credential claims, request polling, wallet signing, swaps, x402,
plugin execution, or Delta calls. `tools/list` itself reads the account-specific
catalog and enabled-plugin configuration.

The public boundary is:

```text
paybox_oauth_available = true
authenticated_tool_discovery_available = true
remote_paybox_tool_calls_available = false
private_delta_used = false
signature_requested = false
transaction_broadcast = false
funds_moved = false
execution_available = false
payment_credential_requested = false
card_authorization_requested = false
```

Fixture records retain `paybox_oauth_used = false` and
`paybox_contacted = false` because those flags describe that evaluation, not
whether a separate discovery session existed earlier in the process. A fixture
`PASS` never becomes permission to use a discovered tool.

`src/integration/production-composition.js` still throws
`PUBLIC_EXECUTION_LOCKED` before constructing any financial execution client.
`execute`, `sign`, and `broadcast` commands must fail.

## OAuth security properties

- Exact PayBox issuer, MCP resource, metadata, authorization, token, and
  registration endpoints are pinned and validated.
- Only authorization code with PKCE S256 and a public client is accepted.
- `state` is random and compared in constant time.
- The callback listener binds an ephemeral `127.0.0.1` port and checks exact
  Host, loopback peer, method, and `/callback` path.
- Only `mcp` is requested. `offline_access` is omitted; refresh tokens, identity
  tokens, unexpected scopes, and confidential-client material are rejected.
- The access token, authorization code, PKCE verifier, and MCP session ID are
  never returned to the model or written by the connection module. The
  authorization-start result necessarily exposes the browser URL, including
  the public client ID, PKCE challenge, state, and loopback redirect.
- The access token exists only in process memory and is discarded on explicit
  disconnect, expiry, command exit, or process exit.
- HTTP redirects, oversized bodies, malformed JSON, metadata drift, protocol
  mismatch, repeated cursors, and excess pagination fail closed.

These controls reduce token exposure; they do not narrow the `mcp` bearer below
the full authority of every credential grant the user selected in PayBox. While
connected, compromise of the local process could expose or misuse that token
outside the intended module. The flow has already registered the uniquely
labeled client. Select no
credential if PayBox permits; otherwise select one least-sensitive non-secret
evaluation credential, choose human approval for every operation, and never
grant a raw secret for this test.

Disconnect discards the local token reference and attempts MCP session cleanup.
PayBox's advertised OAuth metadata does not list a revocation endpoint. The
registered client/grant therefore persists until the user revokes it from the
PayBox Clients screen. Registration happens before consent, so every connect
attempt may leave its reported named client even when authorization, exchange,
or discovery fails; each reported name requires manual revocation.

## Discovery data boundary

Authenticated `tools/list` establishes which tools and schemas PayBox returned
to this client at one time. This is an account-specific catalog and
enabled-plugin-configuration read. It does not read the user's credential
inventory, balances, card details, or request history, and does not prove how a
tool behaves when called.

The ordinary CLI and MCP result includes only:

- provider-authenticated source marker and pinned resource/protocol;
- tool count and deterministic snapshot digest;
- stable tool aliases and provider-name digests;
- conservative classification and risk flags; and
- input- and output-schema digests; plus
- `observed_at` metadata outside the deterministic snapshot digest.

Provider-controlled names, descriptions, and schemas are excluded from
model-facing summaries. An optional owner-only CLI output may contain raw names
and structurally redacted schemas; authenticated provider descriptions are
replaced with a redaction marker even there. A missing output schema or
sensitive output field is unsafe by
default. Name and schema digests isolate raw provider text but are not
confidential or dictionary-resistant for a small known vocabulary. Every
discovered tool is unreviewed and mandate-gated; no name, classification, or
schema makes one a safe read.

## What is protected locally

- Closed input shapes reject unknown fields.
- Policy and source-intent digests detect plan mutation.
- Checkout snapshot and evidence digests detect fact mutation.
- Receipt bindings detect record mutation.
- Exact replay converges on the stored result.
- A different successful nonce for the same one-use fixture plan is blocked.
- Owner-only files and directories are used for managed install and state.
- Installer rejects unsafe relative roots, ancestor escapes, and symlinked
  source/managed directories.
- The local MCP rejects credential-key aliases, private-key/JWT/bearer/token
  patterns, and Luhn-valid PAN-like values recursively without echoing them.
- Release scans reject common secret and live-execution patterns.

These controls protect the local demonstration and discovery client. They do
not authenticate a Delta mandate or make the local process a trusted execution
environment.

## Why OAuth plus a skill or MCP is not enforcement

OAuth authenticates a client and scopes its access to the PayBox grant. It does
not require PayBox to evaluate Delta's policy. If the agent can call the
official PayBox connector, PayBox SDK/CLI, or another token-bearing client, it
can bypass Protected PayBox entirely. Even within this MCP, adding a raw
upstream `tools/call` without a mandatory gate would create the same problem.

Real bypass resistance requires:

- one exclusive mutation path for each protected action;
- a mandatory PayBox-side Delta check before credential release or signing;
- exact binding from stored proposal to `request_payment`, credential claim,
  or `request_swap` parameters;
- fresh signed proof verification;
- atomic one-use consumption; and
- fail-closed timeout, mismatch, and uncertain-outcome behavior.

## Threat model

| Threat | Current control | Enforceable release requirement |
| --- | --- | --- |
| Prompt-injected agent skips the skill | Explicitly not prevented | Remove or gate alternate PayBox mutation clients |
| Agent asks Protected PayBox to invoke a discovered tool | No upstream `tools/call` implementation | Add only canonical, proof-gated operation adapters |
| OAuth token or code appears in model output | Connection state returns redacted fields; token/code remain internal | Isolated credential broker and audited redaction |
| OAuth callback interception or CSRF | Exact loopback binding, host/peer/path checks, PKCE S256, state | Platform-specific redirect hardening and security review |
| Overbroad PayBox grant | Full-authority warning; no credential if allowed, otherwise one least-sensitive non-secret evaluation credential with human approval; no remote calls | Enforced connector policy, no raw secrets, least privilege |
| Local process compromise steals bearer token | Memory-only, no refresh, bounded lifetime | OS credential isolation or hosted confidential service |
| Local disconnect is mistaken for revocation | Track every attempted client name and require manual PayBox Clients revocation | Revocation endpoint or verified Clients workflow |
| Tool name carries prompt injection or is misclassified as safe | Model sees aliases/digests; both input and output contracts are analyzed; classifications are advisory | Allowlisted adapter plus runtime contract tests |
| Agent changes merchant/amount after `PASS` | Snapshot/proposal/receipt digests in fixtures | Provider request derived from stored proposal |
| Model invents price or merchant | Financial fixture authority is explicit; uncertainty is `REVIEW` | Authenticated merchant/provider artifact |
| Stale checkout reused | Expiry/freshness checks | Provider expiry plus fresh Delta proof |
| Duplicate credential or charge | Local fixture one-use history | Durable lease, provider request identity, journal, reconciliation |
| Pending operation is reissued | No live operation path | Submit once and poll the original PayBox `request_id` |
| Wrong user supplies a matching digest in chat | Modeled confirmation is disclosed | Authenticated identity and signed mandate |
| Record checksum treated as proof | Explicit unkeyed-checksum wording | Signed, independently verified Delta proof |
| Raw card data leaks to model/logs | No payment/claim calls; prohibited input scanner | PCI-scoped handling outside model context |
| Provider event is forged/replayed | No live events | Authenticated unique event IDs and append-only journal |

## Evidence policy

Complete facts that violate the mandate are `BLOCK`. Missing, malformed, stale,
conflicting, low-confidence, or unauthenticated critical facts are `REVIEW`.
Neither `BLOCK` nor `REVIEW` permits credential release.

Critical financial evidence includes merchant origin/identity, amount and ISO
currency, subtotal/tax/fees/discounts/tip, destination binding, credential
scope/expiry/use count, and recurring/MIT/card-on-file/incremental/partial
flags. Production values must come from authenticated merchant, PayBox,
processor, or issuer artifacts. Generalized extraction is not sufficient.

## Credential handling

Do not ask the user to paste or supply:

- PAN, card number, CVV/CVC, or full card expiry;
- account password or passkey material;
- OAuth authorization code, access token, or refresh token;
- PayBox API key or `pbxk1.` signing key;
- wallet private key, seed phrase, or mnemonic; or
- reusable payment credentials.

PayBox's public reference says an autonomous `request_payment` can return usable
card authority immediately and `claim_payment_credentials` can return usable
one-time virtual-card details later. Both outputs must go directly to an
isolated credential broker or merchant executor, never through model context.
Both calls are deliberately absent because they would cross the current
credential/model and PCI boundary. The connection
client handles its own short-lived OAuth token internally; this is not an
exception allowing credentials in tool arguments, plans, fixtures, logs, or
receipts.

The fixture context includes exact basket data, scalar item attributes,
merchant/storefront reference, amount components, postal code, and an address
digest, but no raw address. Local plans, records, and one-use history persist
until the evaluator deletes its private runtime state; there is no automated
retention job. Production should minimize fields, use an opaque saved-address
reference or keyed digest, define retention/deletion, and isolate payment
credentials from model context.

## Receipt limitations

The local checksum verifies that a supplied record is internally consistent. It
does not prove who approved the mandate, that evidence came from PayBox or a
merchant, that Delta evaluated the action, that PayBox consumed the decision,
or that funds did or did not move outside this process.

An authenticated tool snapshot proves only the observed tool catalog, not an
operation or account state. Production proof requires authenticated intent,
authenticated evidence, a signed Delta decision, independent verification,
exact PayBox consumption, and lifecycle evidence.

## Release security gates

- full tests on supported Node versions, including mocked OAuth and upstream MCP;
- callback, state, scope-escalation, token-redaction, metadata-drift, pagination,
  response-size, SSE, disconnect, and expiry adversarial tests;
- proof that no upstream `tools/call` or financial-resource-read path is exposed;
- skill/plugin validation and metadata/link/content checks;
- no dependency or action-tag drift;
- deterministic archive comparison;
- safe-path and symlink checks;
- restricted-`PATH` cold install and source-deletion checks;
- checksum verification; and
- a live account smoke test limited to consent, authenticated discovery,
  redacted output, local disconnect, and verified manual revocation of every
  reported client name in PayBox Clients.

# Tools

## Local CLI

| Command | Purpose | Side effects |
| --- | --- | --- |
| `./run doctor` | Show runtime and exact boundary | None |
| `./run paybox-connect [--timeout 300] [--out <absolute-path>]` | Authorize a session, run authenticated PayBox MCP discovery, print a redacted summary, then disconnect | Registers/authorizes a PayBox client; calls OAuth metadata, token, MCP initialize, `tools/list`, and optional session cleanup; never calls a PayBox tool |
| `./run inspect-tools --capture <absolute-path>` | Classify a previously saved MCP `tools/list` capture offline | Optional private redacted snapshot |
| `./run card-merchants` | List representative merchant fixtures | None |
| `./run card-plan --intent <absolute-path>` | Compile and privately save a card plan | Local owner-only file |
| `./run card-demo --merchant doordash --scenario <name>` | Evaluate a labeled fixture | Optional local record |
| `./run card-simulate ...` | Evaluate a saved plan and exact evidence | Private one-use history and optional record |
| `./run demo --scenario <name>` | Run the fixed USDC-to-SOL swap fixture | Optional local record |
| `./run verify --record <absolute-path>` | Verify local record self-consistency | None |
| `./run execute`, `sign`, `broadcast` | Demonstrate the public execution lock | Always fails |

`paybox-connect` prints the PayBox authorization URL to stderr. The user signs
in, chooses the credential grant, and approves only on PayBox. By that point the
flow has already registered the uniquely named public client. Protected PayBox
requests `mcp` only, never requests `offline_access`, rejects refresh tokens,
and keeps the access token in memory. Open the URL in a browser on the same
computer. The command discards the token before printing its final result and
reports `disconnected` as the final state.

If `--out` is provided, the absolute private file contains a normalized tool
snapshot whose secret-like schema defaults/examples are redacted. Ordinary
output contains only stable aliases, name digests, classifications, risk flags,
input/output schema digests, and an overall snapshot digest. Provider-controlled
names and structurally redacted schemas remain only in the explicitly requested
owner-only file; authenticated descriptions are replaced with a redaction marker
even there. It contains no token, authorization code, MCP session
ID, credential inventory, card details, wallet balance, or request history.
The catalog itself is account-specific and can reveal enabled-plugin
configuration. Name and schema digests isolate raw provider text from the model,
but they are not confidential or dictionary-resistant for a small known
vocabulary. `observed_at` is metadata outside the deterministic snapshot digest.
Every discovered tool is unreviewed and mandate-gated; no classification makes
one a safe read.

Relative input paths are rejected. Runtime state is stored in a private
version-independent state directory; callers cannot redirect the canonical
one-use fixture history through CLI options.

## Local MCP tools

| Tool | Input | Result |
| --- | --- | --- |
| `protected_paybox_capabilities` | none | Exact connection, fixture, and execution boundary |
| `protected_paybox_connect` | optional timeout, 60–600 seconds | PayBox authorization URL and session-only grant guidance |
| `protected_paybox_connection_status` | none | `disconnected`, `authorization_pending`, or redacted `connected` status |
| `protected_paybox_sync_tools` | none | Stable aliases, name digests, classifications, risk flags, and input/output schema digests |
| `protected_paybox_disconnect` | none | Local token discard, best-effort session-cleanup attempt, and names requiring manual revocation in PayBox Clients |
| `protected_paybox_card_plan` | closed card intent | Canonical plan and authorization prompt |
| `protected_paybox_card_demo` | merchant, scenario | Fixture `PASS`, `BLOCK`, or `REVIEW` |
| `protected_paybox_card_evaluate` | plan, evidence, digest, nonce | Exact card decision and local record |
| `protected_paybox_swap_demo` | scenario | Fixed swap decision and local record |
| `protected_paybox_verify_record` | record | Local checksum verification |

The connection sequence is:

1. call `protected_paybox_connect` once;
2. open the returned `authorization_url` and approve only on PayBox;
3. check `protected_paybox_connection_status` if needed;
4. call `protected_paybox_sync_tools`; and
5. call `protected_paybox_disconnect` when finished.

The MCP server holds connection state only in that process. It implements no
generic proxy and no upstream `tools/call`; therefore a discovered
`request_payment`, `claim_payment_credentials`, `request_swap`, credential,
signing, x402, or plugin tool cannot be invoked through Protected PayBox.

Capabilities, status, sync, and record verification do not call a PayBox
financial resource tool. `tools/list` still reads the account-specific catalog
and enabled-plugin configuration. `connect` is open-world and not idempotent
because it registers a public OAuth client and begins a new consent flow. `disconnect`
changes local session state and is idempotent. Exact card evaluation is
stateful, non-destructive, idempotent by nonce, and writes private one-use
fixture history.

The local server supports:

- stateless `server/discover`, `tools/list`, and `tools/call` for MCP
  `2026-07-28`; and
- legacy `initialize`, `tools/list`, and `tools/call` for retained clients.

Its upstream PayBox client separately pins streamable HTTP MCP protocol
`2025-06-18`, as documented by PayBox.

## Sensitive-field handling

Never paste a PayBox password, passkey, access/refresh token, API key, signing
key, PAN, CVV/CVC, seed phrase, or private key into Protected PayBox. The user
authenticates in PayBox's browser flow.

The local MCP rejects credential-shaped keys and values recursively. Internally
received OAuth codes, PKCE verifier, tokens, and MCP session IDs are excluded
from model-facing status and discovery results. The authorization-start result
must expose a browser URL; it contains the public client ID, PKCE challenge,
state, and loopback redirect. A local access token is still a bearer credential:
while the process is connected, its authority is the PayBox grant the user
approved. More precisely, this flow has already registered the uniquely named
client, and the `mcp` bearer has the full authority of every selected grant:
select no credential if PayBox permits; otherwise select one least-sensitive
non-secret evaluation credential and choose Human approval for every operation.
Never grant a raw secret. The token retains the authority of those grants even
though this module cannot call a remote tool.

`disconnect` discards the local token and attempts MCP session cleanup. PayBox's
advertised metadata does not expose a token-revocation endpoint, so ending the
server-side client/grant requires the PayBox Clients screen. Every connect
attempt may leave its named registration there, even if authorization, token
exchange, or discovery fails; revoke every name the process reports.

## Fixture scenario names

Card:

```text
pass
block-merchant
block-storefront
block-total
block-tip
block-item
block-quantity
block-recurring
block-address
block-subscription
block-credential-expiry
review-stale
review-low-confidence
review-incomplete
review-total-mismatch
review-snapshot-tamper
```

Swap:

```text
pass
block-minimum-receive
block-network-fee
block-price-impact
block-recipient
review-stale
review-unknown-program
review-hidden-inner-call
review-simulation-failed
```

## Result wording

Every fixture decision carries the current boundary:

```text
FIXTURE EVALUATION ONLY · OPTIONAL PAYBOX OAUTH IS DISCOVERY-ONLY · NO PAYBOX TOOL CALL · NO CREDENTIAL OR AUTHORIZATION · NO SIGNATURE OR BROADCAST · NO ORDER · NO MONEY MOVED
```

The record is not a signed Delta proof. Canned demos are labeled
`FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION`. Custom evaluation records a matching
caller-supplied digest but cannot authenticate the author. `PASS` means only
that the complete local fixture satisfied the displayed closed policy.

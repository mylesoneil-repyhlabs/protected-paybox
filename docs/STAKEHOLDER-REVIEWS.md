# Stakeholder Reviews

These are synthetic stakeholder reactions used for design pressure. They are
not statements from PayBox, customer research, or evidence of market demand.

## v0.5 connection/discovery candidate

### Skeptical PayBox product owner

Verdict: conditional `GO` for a tightly labeled developer evaluation that
connects and discovers tools; `NO-GO` for any financial integration claim.

What now works:

- The implementation follows PayBox's documented OAuth authorization-code,
  dynamic public-client, PKCE S256, MCP resource, and protocol contract.
- The user signs in, chooses credential grants, and approves only in PayBox.
- Authenticated `tools/list` can resolve the exact account/deployment surface
  and enabled-plugin configuration instead of inferring them from public
  marketing or old Help Center copy.
- Model-facing discovery exposes only stable aliases, provider-name digests,
  conservative classifications, risk flags, and input/output schema digests.
- There is no upstream `tools/call`, credential/balance/request-history read,
  credential claim, payment, signing, swap, or x402 path.

Release concerns:

1. Dynamic registration creates a real, uniquely named PayBox client before
   consent. Every attempt can leave that client even if consent or discovery
   fails; the user must see that account-side effect before authorizing.
2. An `mcp` bearer token may carry the credential grant the user selected. The
   token has the full authority of every selected grant. The user should choose
   no credential if allowed; otherwise one least-sensitive non-secret evaluation
   credential, human approval for every operation, and no raw secrets.
3. Local disconnect discards the token but does not revoke the server-side
   client. The flow must direct the user to revoke every reported client name in
   PayBox Clients and verify manual revocation during the live smoke test.
4. A tool appearing in `tools/list` proves catalog availability, not a working
   merchant, supported asset pair, or transaction outcome.
5. Current developer docs supersede the old “unobserved contract” conclusion,
   but the older Help Center's Phase 2 wording remains a public-source conflict.

Required wording:

```text
Connected for authenticated tool discovery only. No PayBox tool was called,
and only the account-specific tool catalog and enabled-plugin configuration were
read. No credential, balance, card detail, request history, payment, signature,
swap, order, or funds movement was requested.
```

### Delta CTO

Verdict: conditional `GO` for the structural discovery boundary after the full
security and release gates; `NO-GO` for Delta enforcement.

Positive findings:

- Issuer/resource/endpoints and OAuth metadata are pinned and validated.
- Public-client registration rejects confidential-client material.
- The loopback callback is exact-bound and protected by PKCE S256 plus random
  state; redirects and malformed metadata fail closed.
- Only `mcp` is requested; refresh tokens, identity tokens, and returned scope
  escalation are rejected.
- Access token, authorization code, PKCE verifier, and MCP session ID are
  excluded from model-facing status and discovery summary. The browser
  authorization URL necessarily contains the public client ID, challenge,
  state, and loopback redirect.
- Upstream MCP supports bounded JSON/SSE parsing, exact request-ID matching,
  pagination limits, cursor-loop rejection, and protocol validation.
- Connection generations prevent timeout, disconnect, reconnect, and concurrent
  operations from committing a late token or stale tool snapshot. Replaced and
  failed upstream sessions are cleaned up.
- Provider-controlled tool names are absent from model-facing output. Name and
  schema digests are not confidential or dictionary-resistant, and
  `observed_at` sits outside the deterministic snapshot digest. Every discovered
  tool remains unreviewed and mandate-gated; none is classified as a safe read.
- The strongest current control is structural: the upstream client exports no
  `tools/call` function and the local MCP exposes no generic remote-call tool.

Release concerns:

1. Mocked tests cannot establish the live PayBox metadata, registration,
   callback, SSE, pagination, expiry, cleanup, and revocation behavior. Run one
   non-financial live smoke test.
2. The access token is memory-only but exists inside the local process. A local
   process compromise could use the bearer outside the intended module.
3. Dynamic registrations may accumulate because registration precedes consent
   and no OAuth revocation endpoint is advertised. Record every attempted name
   and verify manual revocation of each in PayBox Clients.
4. Authenticated tool classification remains static analysis. “Read” is not a
   security grant, and no discovered tool should be auto-enabled even when both
   schema digests are present.
5. Fixture record flags apply to each evaluation and must not be used to claim
   that no separate OAuth discovery session occurred.

Delta architecture conclusion:

- OAuth authenticates the PayBox client; it does not authenticate a Delta
  mandate or force PayBox to consume a Delta decision.
- A documented or discovered `request_payment` can return usable authority, and
  `claim_payment_credentials` can reveal card details. Delta must be mandatory
  before both immediate issuance and one-time claim.
- A raw official connector, REST route, SDK/CLI, plugin, or internal operation
  is a bypass unless PayBox enforces the check server-side.
- For swaps, the mandatory check must occur before the signing window signs and
  PayBox broadcasts the exact `request_swap` intent.

### Target user

Verdict: conditional `GO` for an assisted desktop developer test; `NO-GO` for a
general mobile or purchasing experience.

The intended user understanding after connection is:

- “I approved the uniquely named PayBox client that was already registered.”
- “Protected PayBox read my account-specific tool catalog and enabled-plugin
  configuration.”
- “It did not list or retrieve my credentials, balances, requests, or history.”
- “It cannot use any discovered tool or buy, sign, swap, or pay.”
- “Disconnect removed the local token, but I still need to revoke the client in
  PayBox if I want its server-side access ended.”

Confusion risks:

- “Connect my account” can sound like usable account functionality rather than
  schema discovery.
- `connected` can sound persistent even though the token is process-only.
- A tool name such as `request_payment` can sound like merchant coverage.
- A fixture `PASS` can sound like permission to call the newly discovered tool.

The UI-free flow therefore needs one explicit sentence before consent, one
after discovery, and one after disconnect that restates these boundaries.

## Required pre-release verification

The v0.5 candidate is not re-gated until all of the following are recorded:

- complete source tests on Node 22 and 24;
- OAuth metadata/registration/PKCE/state/callback/expiry/redaction tests;
- upstream MCP JSON/SSE/session/pagination/401/403/limit tests;
- proof that no local MCP tool or CLI command can invoke upstream `tools/call`;
- skill/plugin, metadata, links, content/secret scan, shell syntax, deterministic
  bundle, restricted-`PATH`, and source-deletion cold-install gates; and
- a live, non-financial PayBox flow limited to consent, authenticated
  `initialize`/`tools/list`, redacted output, disconnect, and verified manual
  revocation.

The live gate must not call `list_credentials` or any discovered tool. Logs and
artifacts must be checked for tokens, authorization codes, PKCE verifiers, MCP
session IDs, credential metadata, and secret-like schema defaults. The
authorization URL contains public flow parameters and should still be retained
only as long as needed for the active consent flow.

## Current gate

- `CONDITIONAL GO`: local session-only OAuth and authenticated discovery
  candidate, after all gates above pass.
- `GO`: existing local `BLOCK`/`PASS`/`REVIEW` fixtures, with their simulation
  boundary unchanged.
- `NO-GO`: credential/balance/card/request-history reads, card request/claim,
  merchant checkout, wallet signing, generalized swaps, x402, plugin execution,
  production Delta proof, mobile general-user claims, or funds movement.

## Residual partner dependencies

- account-confirmed card and swap schemas plus a supported sandbox;
- mandatory Delta proof verification before every immediate/approved credential
  release, one-time claim, wallet sign, and swap broadcast;
- no alternate official connector, REST, SDK/CLI, plugin, or internal bypass;
- reviewed source-artifact corpus and generalized-extractor adapter;
- authenticated merchant origin, money, authorization, capture, reversal, and
  refund evidence;
- durable request identity, submit-once recovery, one-use lease, and
  reconciliation;
- PCI/data-retention design that keeps one-time card details outside model
  context;
- measured latency, availability, timeout, and authenticated human fallback;
  and
- independently verified end-to-end sandbox payment plus reversal/refund.

## Retained card-core lessons

The v0.4 review established requirements that remain in force:

- canned records are fixture auto-bound and never imply user authorization;
- custom matching digests do not authenticate authorship;
- exact minor-unit arithmetic, checkout/evidence digest recomputation,
  freshness, title/quantity, expiry, and one-use concurrency checks fail closed;
- incomplete or uncertain evidence returns `REVIEW` with the missing field;
- raw credential-shaped input is rejected without echoing values;
- merchant fixtures are archetypes, never merchant coverage;
- local receipts are unkeyed self-consistency checks, not Delta proofs; and
- every financial result says no credential, authorization, order, signature,
  broadcast, or money movement occurred.

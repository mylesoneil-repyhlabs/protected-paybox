# PayBox signing-hook conformance hypothesis

Status: local interface hypothesis; no PayBox or Delta integration
Date: 2026-07-30

## What this asset is

This is a partner-conversation and local conformance asset for the integration
Protected PayBox would need to become bypass-resistant. It proposes the claims
a mandatory PayBox pre-sign hook would have to validate and consume.

It is **not**:

- an observed or approved PayBox API;
- evidence that PayBox exposes a pre-sign hook;
- a PayBox OAuth client, wallet adapter, signer, or broadcaster;
- a production Delta policy result or cryptographic grant;
- authentication of a chat author;
- durable or distributed replay protection.

No function in this asset reads credentials, contacts a network, requests a
signature, broadcasts a transaction, or moves funds. The public production
composition throws `PUBLIC_EXECUTION_LOCKED` without inspecting its argument.

## Why the hook is required

A skill can guide an agent through policy verification, but it cannot prevent
the same agent from calling an exposed raw PayBox mutation tool. Enforcement
requires the wallet signing boundary itself to refuse every mutation unless it
receives, validates, and atomically consumes an independently issued,
transaction-bound Delta grant. Raw sign, approve, and broadcast paths must not
remain reachable around that hook.

Whether PayBox can provide that boundary is an open partner question.

## Proposed v1 claim

The machine-readable hypothesis is
[`config/paybox-signing-hook.v1.schema.json`](../config/paybox-signing-hook.v1.schema.json).
The proposed claim binds all of the following:

| Claim | Required signing-bound meaning |
| --- | --- |
| `audience` | Exactly `paybox.signing-boundary`; prevents use at another verifier |
| `decision` | Exactly `PASS` |
| `policy_digest` | Exact authorized policy bytes |
| `proposal_digest` | Exact structured proposal evaluated by Delta |
| `message_digest` | Exact serialized unsigned Solana message presented for signing |
| `route_digest` | Exact route and program/account projection |
| `evidence_digest` | Complete authenticated evidence bundle Delta evaluated |
| `simulation_digest` | Exact-byte simulation result and freshness context |
| `tool_contract_digest` | Authenticated PayBox tool name, version, and closed schema |
| `paybox_authority_digest` | Non-secret wallet, connection, grant, and approval-scope binding |
| `chain_id` | Solana mainnet genesis identity |
| `wallet_account`, `fee_payer` | Wallet and fee-paying account |
| `sell_asset`, `buy_asset` | Exact CAIP-style asset identities |
| amount fields | Exact input, policy minimum output, and quoted output |
| `recipient` | Exact destination account |
| `builder` | Observed builder/provider identity, whatever PayBox actually returns |
| slippage and price-impact fields | Proposed and maximum basis points |
| fee fields | Proposed and maximum network and priority fees |
| `nonce` | Unique consumption identity |
| `issued_at`, `expires_at` | Short validity window, at most five minutes |
| `one_use` | Must be `true` |

The `claim_kind` literal intentionally says
`local-interface-hypothesis-not-a-cryptographic-grant`. The local SHA-256 claim
digest is only a deterministic equality check. It does not authenticate an
issuer, user, PayBox, or Delta.

## Proposed production sequence

1. PayBox prepares stable unsigned transaction bytes without releasing a
   signing capability.
2. Protected PayBox independently reconstructs the full proposed action from
   those bytes and authoritative evidence.
3. Delta evaluates the exact policy, proposal, and message and issues a
   short-lived cryptographically authenticated one-use grant.
4. PayBox reconstructs the expected signing request independently at its
   signing boundary.
5. PayBox verifies issuer, proof, audience, every claim binding, freshness, and
   current wallet/session authorization.
6. PayBox atomically consumes the nonce in durable shared storage.
7. Only that exact message may be signed. Any byte change requires a new
   proposal, Delta result, and nonce.
8. PayBox returns an unambiguous transaction identity for reconciliation.

Steps 1 and 4–8 require PayBox product support and are not implemented here.
Step 3 requires a production Delta protocol and is also not implemented here.

## Local conformance API

The targeted local contract suite is 10/10 green. From the extracted release or
repository checkout, run it with:

```bash
npm run conformance:hook
```

`normalizePayBoxHookClaim` strictly validates the closed v1 shape.

`verifyPayBoxHookClaim` compares an untrusted claim to an independently
reconstructed expected claim over every field and enforces audience and time.
It fails closed on mutation, unknown or missing fields, wrong audience, invalid
validity, unsafe self-recipient or self-funded semantics, quote below minimum,
limits above their maxima, or expiry. JSON Schema closes the shape; these
cross-field comparisons are owned by the runtime validator.

`createLocalOneUseConformanceConsumer` demonstrates sequential and concurrent
one-use behavior inside one JavaScript process. Its check-and-set occurs before
an asynchronous yield, so concurrent local calls accept at most one attempt.
The returned result explicitly reports:

- `local_only: true`;
- `durable: false`;
- `cryptographic_grant_verified: false`.

Restarting the process resets this simulator. It must never be used as a
production replay store.

Those tests cover the unconditional production lock, exact claim acceptance,
amount mutation, unsafe semantic bounds, evidence/authority binding mutation,
wrong audience, expiry, sequential replay, and same-process concurrency. They
do not test a cryptographic issuer, PayBox behavior, provider authenticity, or
durable replay storage.

## Conformance gates for a real integration

A future adapter stays locked until all gates have external evidence:

- authenticated PayBox tool schemas and stable unsigned-message preparation;
- a mandatory pre-sign hook with no raw mutation bypass;
- documented wallet/session and user-authorization semantics;
- exact byte re-check immediately inside the signing boundary;
- pinned Delta issuer and proof verification;
- durable, atomic, cross-process and cross-region nonce consumption;
- expiry checked against a trusted clock;
- failure-closed behavior for timeout, schema drift, proof failure, mutation,
  replay, or ambiguous submission;
- credential isolation from chat, logs, fixtures, receipts, and Delta evidence;
- reconciliation against the returned transaction identity before any retry;
- adversarial partner conformance tests against the actual PayBox sandbox.

Until those gates pass, Protected PayBox remains simulation-only and makes no
bypass-resistance claim.

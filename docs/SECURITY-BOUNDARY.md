# Protected PayBox security boundary

Status: design boundary; no complete guard runtime exists  
Date: 2026-07-30

## Current boundary

The repository currently contains an unimplemented skill scaffold, product
documentation, and partial deterministic Sprint 1 modules for canonical
hashing, decimal arithmetic, closed validation, a fixed Solana profile, and
policy-plan construction. The launcher is not yet an executable end-to-end
guard because its CLI and the remaining pipeline are incomplete.

The repository has not authenticated to PayBox, enumerated PayBox tools, read
a wallet, requested a quote, simulated a transaction, produced a decision,
called Delta, created a receipt, signed a transaction, or broadcast anything.

The name Protected PayBox is a project name, not a current security claim.

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

Typed deterministic code must own:

- exact schema validation;
- canonical serialization and digests;
- decimal arithmetic;
- policy compilation;
- evidence normalization and freshness;
- transaction decoding;
- `PASS`, `BLOCK`, and `REVIEW`;
- receipt construction and verification;
- nonce, replay, concurrency, expiry, and history;
- future one-use grant consumption.

Any unexpected exception, schema, field, tool, route, program, contract,
instruction, provider status, or state transition fails closed.

### PayBox

PayBox is an external credential and wallet control plane. Its OAuth tokens,
agent-client keys, wallet material, private keys, key shares, and raw secrets
must never be passed through chat or stored by the guard.

A live preflight may trust an authenticated PayBox response as evidence that
PayBox returned it over the configured connection. A local SHA-256 receipt
does not independently authenticate PayBox's source facts.

The public build may expose only explicitly allowlisted read or prepare
operations. Unknown, approve, sign, broadcast, secret-release, card, or
arbitrary-operation tools are denied.

### Venue, chain, RPC, quote, and simulation providers

These are external data sources, not decision authorities. Apply:

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

Sprint 1 may use only a labeled local test double. A simulated binding check is
not a production Delta decision or cryptographic proof.

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
| Release supply-chain compromise | Pinned dependencies, allowlisted payload, deterministic archive, checksum, cold install |

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
- Authorization and credential scope must be revalidated before returning a
  cached nonce result.
- An exact retry may return its prior current result.
- The same nonce with different semantics is `BLOCK`.
- Concurrent identical attempts serialize.
- Expired or superseded receipts remain history only.

## Receipt boundary

Every supported result must bind:

- mode;
- policy and authorization;
- wallet and agent-client fingerprints;
- exact proposal;
- normalized evidence and source times;
- exact unsigned transaction digest;
- decision and reason;
- nonce and expiry;
- receipt digest.

Early `BLOCK` and `REVIEW` results use deterministic placeholders for
unavailable fields and must not imply that missing evidence was checked.
Sanitize the record before sealing the receipt.

A public local receipt proves only local byte integrity. It is not:

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
- Use credentials only inside the current adapter process or approved host
  credential store.
- Do not persist raw headers, OAuth responses, PayBox bodies, wallet labels,
  internal IDs, account lists, or arbitrary provider error text.
- Store only allowlisted redacted facts and fingerprints with owner-only
  permissions.
- No remote telemetry by default.
- Clearing local history requires immediate explicit confirmation.

## Public execution lock

Through Sprint 3, the public build must have no method, route, tool, runtime
loader, environment flag, or credential configuration capable of requesting a
PayBox signature, approval, broadcast, secret, or card output.

The production-composition seam must always fail with an explicit engineering
integration error. A reviewed private composition may eventually provide a
closure-held signing capability after all conformance gates pass.

## Locked or unclaimed capabilities

- live PayBox integration;
- complete authenticated PayBox tool surface;
- Solana or EVM route support;
- read-only wallet or quote evidence;
- transaction simulation;
- PayBox approval, signature, or broadcast;
- production Delta integration;
- cryptographic receipt;
- independent source authentication;
- bypass resistance;
- Mandate Guarantee;
- recourse or transaction reversal;
- prediction markets, AMMs beyond the selected route, tokenized equities,
  perpetuals, lending, x402, cards, secrets, and ecommerce.

These remain locked until implementation evidence and the claim ledger say
otherwise.

## Release security gate

Each release must pass:

- full unit, integration, adversarial, and UX tests;
- skill metadata and workflow validation;
- local-link validation;
- credential and secret-content scan;
- release-path allowlist;
- deterministic archive generation;
- checksum generation;
- restricted-`PATH` managed install;
- source deletion followed by installed doctor and default-flow checks;
- independent GitHub re-download and checksum verification;
- README, security boundary, claim ledger, and shipped behavior comparison.

The README must describe current verified functionality only. Historical
detail belongs in tags, releases, changelog, or sprint log.

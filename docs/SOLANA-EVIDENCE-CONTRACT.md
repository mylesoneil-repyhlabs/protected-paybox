# Protected PayBox Solana evidence contract

| Contract property | Value |
| --- | --- |
| Document version | `0.3.0-draft.1` |
| Runtime baseline | Protected PayBox `0.3.0` |
| Implemented evidence schema | `protected-paybox.evidence.solana-swap.v1` |
| Implemented policy schema | `protected-paybox.policy.solana-exact-input-swap.v1` |
| Current profile | `F1`: deterministic local fixture |
| Proposed live profile | `L1`: authenticated, read-only, pre-sign Solana evidence |
| Last reviewed | 2026-07-30 |

This document is the field and trust contract for evaluating one exact-input
USDC-to-SOL proposal on Solana Mainnet before a wallet signature is requested.
It serves three audiences:

- product: what must be true before Protected PayBox can return a live `PASS`;
- engineering: which bytes and facts must be acquired, normalized, and bound;
- PayBox: the minimum authenticated prepare and signing-hook surface required
  for enforcement rather than model guidance.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative only for the proposed
live profile. They do not imply that PayBox currently exposes these fields.

## Scope and non-claims

The implemented `F1` profile is credential-free, offline, and
simulation-only. It uses canonical JSON encoded as base64 to stand in for a
Solana v0 message. It does not contain a real serialized Solana message,
contact PayBox, contact Solana, request a route, request a signature, broadcast
a transaction, or move funds.

`swaps.xyz` is the name of the current fixture builder. MoonPay's public
[swap skill](https://github.com/moonpay/skills/blob/main/skills/moonpay-swap-tokens/SKILL.md)
says that the MoonPay CLI builds swaps through Swaps.xyz. That is useful for
shaping a fixture, but it is **not evidence that PayBox routes through
Swaps.xyz**. The live adapter must record the route and provider that the
authenticated PayBox contract actually returns.

The proposed `L1` profile is deliberately narrow:

- one PayBox wallet;
- Solana Mainnet, identified as
  `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`;
- exact-input native Solana USDC mint
  `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`;
- native SOL output;
- same-wallet recipient;
- one swap and one compute-budget operation;
- no approval, delegate, bridge, transfer, arbitrary call, extra signer,
  scheduling, or additional action.

A `PASS` is permission for the next protected step, not a promise that a swap
will settle at the quoted result. Every `REVIEW` and `BLOCK` is non-releasable.

## Decision semantics

| Decision | Meaning | Release effect |
| --- | --- | --- |
| `PASS` | Fresh, complete evidence for the exact candidate satisfies every supported mandate constraint. | Eligible only for the separately protected signing step. |
| `BLOCK` | Complete, internally coherent evidence proves a mandate violation. | Do not sign; change the proposal or authorize a new mandate. |
| `REVIEW` | Authenticity, freshness, decoding, simulation, or completeness is insufficient to prove compliance. | Do not sign; refresh or escalate. |

The current evaluator gives `REVIEW` precedence when a bundle contains both an
uncertainty and a policy failure. This avoids representing an incomplete or
untrusted bundle as proof of a specific violation.

## Implemented `F1` field contract

All fields below are required. Objects are closed: an unknown or missing field
causes schema normalization to fail and the evaluator returns `REVIEW`.
Atomic amounts are unsigned base-10 strings.

| Field | Current type and source | Current binding or check | `L1` replacement or extension |
| --- | --- | --- | --- |
| `schema_version` | Literal `protected-paybox.evidence.solana-swap.v1`; local fixture | Exact match | Introduce a separately versioned live schema; do not silently widen v1. |
| `mode` | Literal `simulated_fixture` | Any other value returns `REVIEW/LIVE_EVIDENCE_UNAVAILABLE` | Literal such as `live_read_only`, accepted only after the live adapter ships. |
| `collected_at` | Canonical ISO-8601; local clock | At most 15 seconds old and no more than 2 seconds in the future | Adapter collection start/end plus source receipt times. |
| `provenance.authenticity` | Literal `SELF_REPORTED_FIXTURE` | Required | Per-field authenticity tier and source identity. |
| `provenance.paybox_contacted` | `false` | Required | `true` only when the deterministic adapter owns an authenticated response. |
| `provenance.network_contacted` | `false` | Required | `true` only when the deterministic adapter owns the RPC responses. |
| `provenance.statement` | Bounded local label | Recorded | Machine-readable source inventory plus a concise display statement. |
| `tool_contract.provider` | Literal `unverified-paybox-contract` | Required | Authenticated MCP server identity and connection origin. |
| `tool_contract.tool_name` | Placeholder `paybox.wallet.sign_and_broadcast` | Required but explicitly unverified | Exact observed prepare tool name; sign/broadcast must remain a separate gated role. |
| `tool_contract.schema_digest` | SHA-256 of a synthetic placeholder note | Exact placeholder match | Digest of the authenticated, redacted `tools/list` schema and protocol version. |
| `tool_contract.authenticated_schema_observed` | `false` | Required | `true`, with capture time, auth context fingerprint, and raw-capture digest. |
| `wallet.account` | Base58 public key; fixture | Equals authorized wallet, fee payer, recipient, and sole required signer | Authenticated PayBox wallet read, then independently checked in message and chain data. |
| `wallet.chain_id` | CAIP-2 string; fixture | Equals policy chain | PayBox wallet chain plus independently verified Solana genesis identity. |
| `wallet.sell_balance_atomic` | Synthetic USDC balance | Must cover exact sell amount | Sum only valid owner token accounts for the exact mint and token program at a bound slot. |
| `wallet.native_fee_balance_atomic` | Synthetic lamports | Must cover simulated network fee | Direct RPC balance for fee payer at the bound slot. |
| `wallet.observed_at` | Local fixture time | At most 15 seconds old | Local receipt time plus RPC context slot; do not invent provider observation time. |
| `assets.sell.caip19` | Fixed CAIP-19 USDC identity | Equals policy | Reconstructed from verified chain, mint, namespace, and asset standard. |
| `assets.sell.mint` | Fixed USDC mint | Equals policy | Direct mint account lookup. |
| `assets.sell.decimals` | Integer `6` | Equals policy | Decode from the mint account; never trust symbol metadata alone. |
| `assets.sell.token_program` | Fixture SPL Token program | Must equal the legacy SPL Token program | Verify mint-account owner; unsupported Token-2022 profiles return `REVIEW`. |
| `assets.sell.token_extensions[]` | Empty local array | Any entry returns `REVIEW` | Decode every extension and allow only explicitly supported combinations. |
| `assets.buy.caip19` | Fixed native SOL CAIP-19 identity | Equals policy | Verify the configured native-asset identity. |
| `assets.buy.decimals` | Integer `9` | Equals policy | Fixed network-native unit, cross-checked with the configured chain profile. |
| `assets.observed_at` | Local fixture time | At most 15 seconds old | Mint and asset observation metadata, including context slot and response digest. |
| `chain.chain_id` | Fixture CAIP-2 string | Equals policy | Map a direct `getGenesisHash` result to the configured CAIP-2 identity. |
| `chain.current_slot` | Synthetic unsigned integer | Used for simulation lag and lookup-table ordering | Direct committed RPC slot with endpoint, commitment, and response digest. |
| `chain.current_block_height` | Synthetic unsigned integer | Used for blockhash safety margin | Direct RPC block height from the same chain context. |
| `chain.recent_blockhash` | Deterministic fixture blockhash | Equals decoded message blockhash | Exact blockhash returned by `getLatestBlockhash` and embedded in candidate bytes. |
| `chain.blockhash_valid` | Synthetic `true` | Must be true; otherwise `REVIEW` | Direct `isBlockhashValid` check at the chosen commitment. |
| `chain.observed_at` | Local fixture time | At most 15 seconds old | Local receipt time, endpoint identity, commitment, slot, and raw response digest. |
| `quote.builder` | Fixture string `swaps.xyz` | Equals policy and decoded swap operation | Actual authenticated provider or builder identity; no inferred routing. |
| `quote.request_digest` | SHA-256 of chain, assets, exact input, and recipient | Must equal the locally recomputed fixture request digest | Bind the complete provider request, policy digest, wallet, slippage, fee limits, and correlation ID. |
| `quote.raw_response_digest` | Despite its name, digest of five normalized fixture fields | Recomputed over builder, expected/minimum output, price impact, and expiry | Digest the actual bounded response bytes and separately digest normalized semantics. |
| `quote.expected_receive_atomic` | Synthetic lamports | Must equal simulated buy credit in `F1` | Authenticated quote amount; compare with independent simulation, allowing only documented deterministic fee treatment. |
| `quote.minimum_receive_atomic` | Synthetic lamports | Cannot exceed expected output; must meet the authorized minimum | Must equal the slippage threshold encoded in exact candidate bytes. |
| `quote.price_impact_bps` | Synthetic integer | Must not exceed policy cap | Provider calculation plus enough route inputs to reproduce or independently sanity-check it. |
| `quote.observed_at` | Local fixture time | At most 10 seconds old | Provider timestamp when available and local receipt time; keep them distinct. |
| `quote.expires_at` | Local fixture time + 10 seconds | Must be in the future | Provider expiry; proposal expiry is the earliest of mandate, quote, blockhash, and grant expiry. |
| `reference.source` | Literal `local-reference-fixture` | Required | Named independent source or reproducible on-chain calculation, not copied from the candidate quote. |
| `reference.expected_receive_atomic` | Synthetic lamports | Derives the slippage floor | Bind source request, response, route assumptions, fees, slot, and raw/semantic digests. |
| `reference.observed_at` | Local fixture time | At most 10 seconds old | Source time plus local receipt time and chain context. |
| `message.format` | Literal `fixture_json_base64` | Required | Real Solana versioned-message or unsigned-transaction format, named precisely. |
| `message.message_base64` | Base64 of canonical fixture JSON | Must be canonical base64 and parse to `decoded` | Exact serialized candidate bytes returned before signing; no model reconstruction. |
| `message.message_sha256` | SHA-256 of decoded base64 bytes | Recomputed and bound to simulation and receipt | Recomputed over exact wire bytes and consumed unchanged by the signing hook. |
| `message.decoded.schema_version` | `protected-paybox.fixture-solana-message.v1` | Exact match | Versioned deterministic Solana decoder schema and decoder build digest. |
| `message.decoded.version` | `v0` | Exact match | Parsed from the serialized versioned message. |
| `message.decoded.fee_payer` | Fixture public key | Must equal authorized wallet | Parse from exact bytes; verify PayBox wallet ownership. |
| `message.decoded.recent_blockhash` | Fixture blockhash | Must equal chain evidence | Parse from exact bytes and validate independently. |
| `message.decoded.last_valid_block_height` | Synthetic height | Must exceed current height with at least 20 blocks of margin | Bind the `getLatestBlockhash` response that supplied the message blockhash. |
| `message.decoded.required_signers[]` | One fixture wallet | Must contain exactly the authorized wallet | Derive from the message header and all account keys; unexpected signer is `BLOCK`. |
| `message.decoded.address_lookup_tables[]` | One fixture table with account, resolved flag, slot, and data hash | All must resolve; resolution slot cannot exceed chain slot | Fetch every table directly, bind raw account data, indexes, resolved keys, authority/deactivation state, and context slot. |
| `message.decoded.instructions[0]` | Synthetic compute-budget decode | Must be index 0, allowlisted compute-budget program, and exactly one compute operation | Decode exact instruction bytes and compute total priority fee from unit limit and unit price. |
| `message.decoded.instructions[1]` | Synthetic exact-input swap decode | Must be index 1, Jupiter v6 fixture program, and exactly one swap operation | Decode actual route instructions and every account; no hardcoded assumption about PayBox venue. |
| `message.decoded.instructions[1].decoded_operation` | Builder, assets, exact input, minimum output, recipient | Each value binds policy, quote, or wallet | Versioned per-program semantic decoder; unsupported program or discriminator returns `REVIEW`. |
| `message.decoded.inner_program_ids[]` | Synthetic program IDs | Every program must be allowlisted | Derive from exact simulation inner instructions and decode their operations, not only IDs. |
| `simulation.message_sha256` | Fixture message hash | Must equal proposal message hash | Hash of the exact bytes passed to `simulateTransaction`. |
| `simulation.context_slot` | Synthetic slot | Must be no more than two slots behind chain slot and not ahead | RPC context slot, commitment, min-context-slot, endpoint, and response digest. |
| `simulation.successful` / `error_code` | Synthetic result | Failure returns `REVIEW` | Preserve the full typed RPC error and sanitized logs; never treat failure as a policy fact. |
| `simulation.sell_debit_atomic` | Synthetic USDC debit | Must equal exact authorized input | Compute from pre/post token balances and decoded transfers for the exact mint and owner. |
| `simulation.buy_credit_atomic` | Synthetic SOL credit | Must meet authorized minimum and equal fixture expected output | Compute from pre/post lamports after separating network and priority fees. |
| `simulation.recipient_account` | Fixture recipient | Must equal authorized wallet | Derive from account deltas and decoded route semantics. |
| `simulation.network_fee_atomic` | Synthetic lamports | Balance must cover it; must not exceed cap | Obtain through simulation and/or `getFeeForMessage`, with calculation method recorded. |
| `simulation.priority_fee_atomic` | Synthetic lamports | Must not exceed cap and must equal decoded compute operation | Recompute from exact compute-budget instructions and actual consumed/limited units. |
| `simulation.unexpected_asset_deltas[]` | Empty fixture array | Any entry is `BLOCK` | Enumerate every changed wallet-owned lamport/token position, including created accounts and rent. |
| `simulation.undecoded_instructions[]` | Empty fixture array | Any entry is `REVIEW` | Include top-level and inner instruction coordinates, bytes hash, and program ID. |
| `simulation.observed_at` | Local fixture time | At most 15 seconds old | Local RPC receipt time plus response slot and digest. |

Normalization derives `evidence_digest` over the complete normalized input,
records `subject_policy_digest`, and records all freshness issues. Those
derived fields are not accepted from a caller.

## Exact bindings

### Implemented fixture bindings

The current runtime enforces all of the following:

1. `policy_digest = SHA256(canonical_json(policy))`.
2. The separately supplied confirmation digest must equal `policy_digest`.
3. `quote.request_digest` binds the policy chain, sell asset, buy asset, exact
   sell amount, and authorized recipient.
4. `quote.raw_response_digest` binds the fixture builder, expected output,
   minimum output, price impact, and expiry.
5. `message.message_sha256` is recomputed from `message.message_base64`.
6. The decoded JSON must be canonically identical to the bound fixture bytes.
7. The chain blockhash must equal the decoded-message blockhash.
8. The quote expected output must equal the simulated output.
9. The simulation message hash must equal the proposal message hash.
10. Fee payer, sole signer, recipient, assets, exact input, minimum output,
    builder, priority fee, programs, and operations are cross-bound between
    policy, quote, message, and simulation.
11. The authorized minimum is:

    ```text
    max(
      human_minimum_receive_atomic,
      floor(reference_expected_receive_atomic
            * (10000 - max_slippage_bps) / 10000)
    )
    ```

12. The nonce semantic binding is the digest of `policy_digest`,
    `confirmation_digest`, and the caller-supplied evidence digest. A nonce
    reused with different semantics is `BLOCK/NONCE_REUSE_MISMATCH`.
13. The local record binds policy, authorization, request, proposal, evidence,
    exact message hash, placeholder tool-schema digest, decision, nonce,
    boundary, and record payload.

The local record uses unkeyed SHA-256 over canonical JSON. It can detect
changes relative to itself; it does not authenticate PayBox, Solana, a quote
provider, Delta, or the origin of any fact.

### Required live binding

`L1` MUST bind one immutable operation graph:

```text
authorized human mandate
  -> policy digest + authorization digest
  -> authenticated PayBox agent-client + wallet + chain
  -> exact prepare request
  -> raw prepare response + normalized quote/route
  -> exact unsigned Solana bytes + SHA-256
  -> independent RPC state + mint/account/ALT data
  -> exact-byte simulation + complete asset deltas
  -> Delta decision/proof + one-use grant
  -> PayBox signing hook consumes the grant for identical bytes
```

Changing any node or expiry MUST require a new evaluation. PayBox MUST NOT
rebuild, re-quote, refresh a blockhash, add an instruction, alter an account,
or change bytes after the grant is issued. If any change is necessary, the
candidate returns to preflight.

## Future authenticated PayBox contract

The following is a required logical contract, not an assertion about current
PayBox tool names.

### Authenticated discovery

Before enabling `L1`, the adapter MUST capture an authenticated MCP
`tools/list` response and record:

- exact MCP server origin and protocol version;
- OAuth issuer/audience and a non-secret hash of the agent-client identity;
- retrieval and local receipt times;
- raw bounded response digest;
- normalized, redacted schema digest;
- each exact tool name, input schema, output schema, annotations, and version;
- whether read, prepare, sign, and broadcast are separate capabilities;
- schema-drift policy and the last reviewed schema digest.

A changed or unknown schema returns `REVIEW`. Examples, defaults, descriptions,
or annotations never override the executable JSON schema.

### Read and prepare roles

The adapter needs two allowlisted roles:

1. **Wallet read:** returns the exact wallet public key, supported chain,
   credential/agent-client fingerprint, and authorization scope without
   releasing any secret or key material.
2. **Swap prepare:** accepts a completely bound exact-input request and returns
   an unsigned candidate without signing or broadcasting.

The prepare request MUST include, directly or through a single request digest:

- policy and authorization digests;
- idempotency key;
- agent-client fingerprint and wallet account;
- CAIP-2 chain and exact CAIP-19 assets;
- exact input atomic amount;
- same-wallet recipient;
- maximum slippage, price impact, network fee, and priority fee;
- permitted route/provider restrictions;
- request creation and expiry times.

The prepare response MUST include:

- provider operation/correlation ID and idempotency status;
- exact observed tool-contract digest;
- wallet and chain identity;
- actual route/provider identity;
- quote request and raw response digests;
- expected output, encoded minimum output, all provider/route fees, price
  impact, observation time, and expiry;
- exact unsigned serialized candidate bytes before any signature;
- message format, byte length, and SHA-256;
- declared signers, fee payer, program IDs, address lookup tables, and route;
- whether prepare reserved, approved, scheduled, or otherwise mutated state;
- raw bounded response digest and local receipt time.

If PayBox exposes only a combined prepare-and-sign tool, does not expose exact
bytes before signing, or may replace the candidate after verification, `L1`
cannot provide a protected pre-sign path.

### Signing boundary

A skill alone cannot enforce the mandate while an agent can call an unguarded
PayBox mutation tool. A partner-grade design requires PayBox to accept a
short-lived, one-use Delta grant and atomically verify:

- PayBox agent-client fingerprint;
- wallet and chain;
- exact tool-contract/schema digest;
- exact serialized-message SHA-256;
- policy, authorization, proposal, evidence, and decision/proof digests;
- expiry, nonce, and unused status.

The grant is consumed only while signing identical bytes. Raw sign and
broadcast paths must be unavailable or must enforce the same hook.

## Independent Solana input contract

PayBox-returned fields are candidate facts, not independent chain evidence.
The deterministic adapter MUST fetch the following directly from an
allowlisted Solana RPC origin. “Independent” means the Guard owns the request
and receives the response without the model or PayBox rewriting it. A
different RPC operator from the route provider is preferred where practical.

| Evidence family | Minimum RPC inputs | Required normalized result |
| --- | --- | --- |
| Network | `getGenesisHash` | Genesis hash, mapped CAIP-2 chain, endpoint identity, receipt time, response digest. |
| Head | `getSlot`, `getBlockHeight` | Commitment, slot, block height, receipt time, response digests. |
| Blockhash | `getLatestBlockhash`, `isBlockhashValid` | Blockhash, last valid block height, validity, safety margin, context slot. |
| Native balance | `getBalance` | Fee-payer lamports at a bound context slot. |
| Token holdings | `getTokenAccountsByOwner` and/or exact account reads | Every wallet-owned account for the USDC mint, program owner, raw atomic amount, delegate/close-authority state, context slot. |
| Mint | `getAccountInfo` | Mint account owner, decimals, supply, mint/freeze authorities, Token-2022 extensions if present, raw account-data digest, context slot. |
| Lookup tables | `getAccountInfo` for every referenced table | Table account, owner, authority, deactivation state, exact indexed addresses, raw data digest, context slot. |
| Fees | `getFeeForMessage` plus decoded compute budget | Base fee, compute-unit price/limit, priority fee method, total fee. |
| Simulation | `simulateTransaction` on the exact candidate | Context slot, error, logs, units, return data, inner instructions, pre/post lamports, pre/post token balances, and complete derived deltas. |

The adapter MUST:

- pin HTTPS origins, methods, commitment, timeouts, and response-size bounds;
- reject redirects and method fallback;
- preserve raw response digests and normalized semantic digests separately;
- record local receipt time when a source does not provide an observation time;
- use `minContextSlot` where supported to avoid moving backwards;
- resolve all v0 address lookup table indexes before decoding;
- derive every signer and account key from exact serialized bytes;
- simulate the same bytes whose hash is proposed for signing;
- preserve all logs and inner instructions needed to detect hidden calls;
- reconcile lamport changes, token changes, fees, rent, wrapped SOL, and created
  or closed accounts without masking residual deltas.

Standard HTTPS JSON-RPC establishes only the responding endpoint and channel.
It does not make a local hash a provider signature or prove that the endpoint
reported canonical chain state. Higher assurance may require multiple RPC
operators, a trusted local node, finalized-state checks, or verifiable proofs.

## Route, quote, and reference evidence

The candidate route source MUST be explicit. It may be PayBox, an aggregator,
or a venue, but it must not be inferred from marketing copy or another MoonPay
product.

For each candidate, retain:

- exact request bytes/normalized request digest;
- route source identity, API/tool version, and correlation ID;
- exact input/output mint identities and atomic amount;
- wallet, recipient, fee payer, slippage mode, and encoded minimum output;
- every route leg, venue, pool/account, program ID, fee, and estimated price
  impact;
- expected output, minimum output, expiration, and context slot/block;
- raw bounded response digest and normalized semantic digest;
- source observation time, when supplied, and local receipt time;
- the exact candidate-message hash produced from that quote.

The independent reference MUST not copy `expected_receive_atomic` from the
candidate quote. It should be a second authenticated quote or a reproducible
on-chain calculation with explicit pool state, decimals, fees, and slot. The
reference-derived minimum remains the floor defined above. A missing,
unavailable, stale, differently scoped, or economically incomparable
reference is `REVIEW`.

Swaps.xyz publicly documents quote/path/action APIs capable of returning
transaction data for supported swap flows. Those docs are useful when
designing an adapter if authenticated PayBox identifies Swaps.xyz as its
provider. They do not establish that relationship by themselves.

## Freshness and error-to-`REVIEW` rules

### Implemented `F1` thresholds

| Fact | Current maximum or rule | Failure |
| --- | --- | --- |
| Collection time | 15 seconds | `REVIEW/COLLECTION_STALE` |
| Quote | 10 seconds and before `expires_at` | `REVIEW/QUOTE_STALE` or `QUOTE_EXPIRED` |
| Wallet | 15 seconds | `REVIEW/WALLET_STALE` |
| Assets/mint | 15 seconds | `REVIEW/ASSET_STALE` |
| Chain | 15 seconds | `REVIEW/CHAIN_STALE` |
| Reference | 10 seconds | `REVIEW/REFERENCE_STALE` |
| Simulation | 15 seconds | `REVIEW/SIMULATION_STALE` |
| Future timestamp | More than 2 seconds ahead | `REVIEW/<FACT>_FUTURE` |
| Simulation slot | Not ahead and no more than 2 slots behind current slot | `REVIEW/SIMULATION_BLOCK_LAG` |
| Blockhash | Valid and at least 20 block heights of remaining margin | `REVIEW/BLOCKHASH_UNSAFE` |
| Lookup table | Resolved; resolution slot cannot be after current slot | Invalid future ordering normalizes to `REVIEW`; unresolved table is `REVIEW` |

### `L1` fail-closed rules

Until live measurements justify tighter source-specific limits, `L1` should
start with the same 10-second quote/reference and 15-second chain/simulation
ceilings. The final candidate expiry is the earliest applicable expiry.

Return `REVIEW` and make signing ineligible for:

- timeout, redirect, non-allowlisted origin/method/tool, non-success response,
  oversized body, malformed JSON, schema drift, or unknown field;
- missing authenticated PayBox schema, wallet fact, exact unsigned bytes,
  route identity, raw response digest, or provider expiry;
- stale/future source time, clock uncertainty, slot regression, RPC
  disagreement, invalid blockhash, or insufficient validity margin;
- unavailable mint, balance, token-account, lookup-table, or fee evidence;
- unsupported Token-2022 extension, route, program, discriminator, account
  layout, instruction, inner call, signer, or transaction version;
- unresolved lookup table or incomplete inner-instruction/log capture;
- simulation failure, missing deltas, or simulation on different bytes;
- candidate mutation, re-quote, blockhash refresh, or tool-schema change after
  evaluation;
- missing, stale, or incomparable independent reference evidence;
- any source-authenticity tier lower than the policy requires.

Return `BLOCK` only when complete accepted evidence proves a constraint
violation, such as a wrong asset, wallet, recipient, signer, amount, minimum
output, excessive fee/impact, prohibited operation, extra asset movement, or
reused nonce with changed semantics.

## Source-authenticity tiers

These tiers describe the strongest origin claim available for an individual
fact. They are separate from freshness and internal hash integrity.

| Tier | Name | What it supports | What it does not support |
| --- | --- | --- | --- |
| `A0` | Synthetic/self-reported | Deterministic fixture testing and local consistency | Any external-source claim |
| `A1` | Transport-authenticated | The adapter received bytes from a pinned HTTPS origin | Provider-signed content, underlying truth, or protection from a compromised endpoint |
| `A2` | Authenticated application context | `A1` plus OAuth/MCP server, agent-client, wallet, scope, and request correlation | Independent authenticity of chain/venue facts embedded in the response |
| `A3` | Source-signed artifact | Provider signature binds request, response, identity, and time | Correctness of the signed assertion |
| `A4` | Independently verifiable state | Fact is verified against trusted consensus/proof or a locally validated node | Human-intent compliance without Delta policy evaluation |

Current fixture facts are `A0`. An authenticated PayBox prepare response would
normally be `A2` for the claim “PayBox returned this candidate.” A standard
TLS RPC response is normally `A1`, even if its contents describe on-chain
state. A SHA-256 digest raises tamper visibility but never raises the source
authenticity tier.

Every normalized fact SHOULD carry:

- `source_id` and `source_type`;
- `authenticity_tier`;
- request and raw-response digests;
- provider observation time, if actually supplied;
- local receipt time;
- slot/block/commitment where applicable;
- adapter and decoder version digests.

## Fixture versus live status

| Capability | `F1` now | Required for `L1` |
| --- | --- | --- |
| Closed mandate and exact authorization digest | Implemented | Reuse |
| Exact USDC/SOL policy identity | Implemented as fixed profile | Verify from live chain facts |
| Authenticated PayBox OAuth/MCP session | Not present | Required |
| Authenticated PayBox `tools/list` | Not captured; offline analyzer only | Required and schema-pinned |
| PayBox wallet read | Synthetic | Required |
| PayBox pre-sign prepare | Placeholder only | Required, non-signing, exact bytes |
| Actual PayBox route/provider | Unknown | Required |
| Real Solana serialized candidate | No; canonical fixture JSON only | Required |
| Direct Solana RPC evidence | No | Required |
| Direct mint/balance/ALT evidence | No | Required |
| Independent quote/reference | Local fixture only | Required |
| Exact-byte network simulation | Synthetic | Required |
| Deterministic `PASS/BLOCK/REVIEW` | Implemented for fixture | Extend with separately versioned schema |
| Local receipt integrity | Implemented, unkeyed SHA-256 | Keep as audit aid, not source proof |
| Local signing-hook contract | Pure local interface hypothesis with exact equality and semantic checks; no provider or cryptographic authenticity | Replace with a PayBox-observed mandatory hook and production Delta proof verification |
| Local hook replay behavior | One-process in-memory demonstration; not durable | Durable atomic cross-process and cross-region consumption at the signing boundary |
| Production Delta proof/grant | Not integrated | Required for enforcement |
| PayBox signing-hook consumption | Not integrated | Required for bypass resistance |
| Signature, broadcast, funds movement | CLI locked; no execution adapter | Remains out of the public evaluation build |

## Expansion questions

### Questions for PayBox

1. What are the exact authenticated MCP tool names, versions, input schemas,
   output schemas, OAuth scopes, and annotations?
2. Are wallet read, swap prepare, sign, and broadcast separate capabilities?
3. Can prepare return exact unsigned Solana bytes before any wallet approval or
   signature, and does prepare mutate or reserve anything?
4. Can PayBox guarantee that the exact bytes evaluated are the exact bytes
   signed, without rebuilding, re-quoting, or refreshing the blockhash?
5. Which provider, aggregator, venues, and Solana programs produce each route?
   Is every route leg and fee exposed?
6. Are v0 messages, all address lookup tables, signer requirements, and
   instruction data returned?
7. Does PayBox expose provider observation/expiry times, raw quote IDs, and
   stable correlation/idempotency IDs?
8. Can PayBox bind a short-lived external Delta proof and atomically consume a
   one-use grant inside its signing boundary?
9. Can raw mutation tools be removed from the agent or made to enforce the same
   grant?
10. Does PayBox sign responses or expose a verifiable audit artifact? If not,
    what application identity can be pinned?
11. Is there a sandbox or Solana testnet path with production-equivalent
    prepare semantics?
12. What are the rate limits, timeouts, retry semantics, idempotency guarantees,
    and typed error taxonomy?

### Questions before broadening the taxonomy

- Which additional Solana swap programs and Token-2022 extensions can be fully
  decoded and simulated without ambiguity?
- Does PayBox support same-chain actions beyond swaps with equally inspectable
  pre-sign bytes?
- For prediction markets, lending, perps, and tokenized equities, which fresh
  venue facts establish position, leverage, liquidation, collateral, and
  settlement constraints?
- For x402 and ecommerce, what authenticated service/item/delivery evidence
  exists before an irreversible payment?
- Which sources can provide independent reference evidence without sharing
  the route provider's failure domain?

## Primary references

- Solana:
  [core transaction model](https://solana.com/docs/core),
  [`getLatestBlockhash`](https://solana.com/docs/rpc/http/getlatestblockhash),
  [`isBlockhashValid`](https://solana.com/docs/rpc/http/isblockhashvalid),
  [`getGenesisHash`](https://solana.com/docs/rpc/http/getgenesishash),
  [`getBalance`](https://solana.com/docs/rpc/http/getbalance),
  [`getTokenAccountsByOwner`](https://solana.com/docs/rpc/http/gettokenaccountsbyowner),
  [`getAccountInfo`](https://solana.com/docs/rpc/http/getaccountinfo),
  [`getFeeForMessage`](https://solana.com/docs/rpc/http/getfeeformessage), and
  [`simulateTransaction`](https://solana.com/docs/rpc/http/simulatetransaction).
- Chain Agnostic Improvement Proposals:
  [CAIP-2 chain IDs](https://standards.chainagnostic.org/CAIPs/caip-2),
  [CAIP-10 account IDs](https://standards.chainagnostic.org/CAIPs/caip-10),
  and [CAIP-19 asset IDs](https://standards.chainagnostic.org/CAIPs/caip-19).
- Swaps.xyz:
  [documentation](https://docs.swaps.xyz/),
  [Swap API overview](https://docs.swaps.xyz/swap-api-reference/overview), and
  [path discovery](https://docs.swaps.xyz/api-reference/get-paths).
- MoonPay:
  [public swap skill](https://github.com/moonpay/skills/blob/main/skills/moonpay-swap-tokens/SKILL.md)
  and
  [PayBox agent-connection model](https://support.moonpay.com/en/articles/669841-how-agent-connections-work-in-paybox).

# Protected PayBox

> Turn one PayBox-shaped on-chain swap into a closed mandate, evaluate one
> exact proposal, and return `PASS`, `BLOCK`, or `REVIEW` before any signing
> boundary.

Protected PayBox is an independent Delta prototype. It is not a MoonPay or
PayBox product, integration, or endorsement.

The current release is credential-free and simulation-only. It cannot contact
PayBox, request a wallet signature, broadcast a transaction, or move funds.

## The first experience

The installable `$protected-paybox` skill starts with one deliberately narrow
action:

```text
Use exactly 5 USDC on Solana Mainnet to buy SOL once.
Receive at least 0.025 SOL, return it to the same wallet, stay below the
slippage, price-impact and fee limits, and do not add an approval, bridge,
transfer or other instruction.
```

The Guard displays the complete mandate and pauses for a separate
authorization message. It then evaluates a fully labeled transaction-shaped
fixture:

```text
PROTECTED PAYBOX · SIMULATED FIXTURE · NO SIGNATURE · NO BROADCAST

BLOCK — The proposed minimum receive is below the user limit recomputed from
the local reference fixture.

Boundary: SIMULATION ONLY · NO PAYBOX CONTACT · NO SIGNATURE · NO TRANSACTION
Receipt: local checksum self-consistent; not signed.
```

The companion `PASS` proves only that the exact local fixture satisfied the
closed local policy. It is not a production Delta proof or PayBox execution.

## Supported surface

| Dimension | Current release |
| --- | --- |
| Action | One same-chain `onchain.swap.exact_in` |
| Chain | Solana Mainnet |
| Sell asset | Native Solana USDC mint |
| Buy asset | SOL |
| Size | Exact atomic amount |
| Recipient | Same wallet only |
| Builder | Swaps.xyz-shaped fixture |
| Limits | Minimum receive, slippage, price impact, network fee, priority fee |
| Message checks | Fee payer, signer set, programs, inner calls, lookup tables, exact bytes |
| Decisions | `PASS`, `BLOCK`, `REVIEW` |
| Evidence | Deterministic local fixtures |
| PayBox OAuth/tools | Offline captured-schema classifier; no OAuth |
| Signature/broadcast | CLI locked; no execution adapter |

The Swaps.xyz profile is based on
[MoonPay's public swap skill](https://github.com/moonpay/skills/blob/main/skills/moonpay-swap-tokens/SKILL.md),
which says MoonPay CLI swaps are built through Swaps.xyz. It is not a claim
that authenticated PayBox uses the same venue.

### Deliberately unsupported

- token approvals, delegation, permits, or additional signatures;
- transfers, arbitrary recipients, bridges, or cross-chain actions;
- exact-output, multi-action, scheduled, or recurring swaps;
- prediction markets, lending, tokenized equities, perpetuals, or leverage;
- x402 and ecommerce;
- live PayBox credential release, signing, or broadcast.

## Why the decision model matters

- `BLOCK` means complete, internally consistent evidence proves that the exact
  proposal violates the mandate.
- `REVIEW` means the Guard could not verify fresh, complete, decoded and
  matching evidence.
- `PASS` means the exact labeled fixture satisfies the local policy.

Missing or stale data never becomes a false policy violation. Unknown Solana
programs, hidden inner calls, unresolved lookup tables, changed bytes and
opaque tool schemas fail closed.

## Run the prototype

Requirements: macOS or Linux and Node.js 22+.

```bash
./run doctor
./run demo --scenario block-minimum-receive
./run demo --scenario pass
./run demo --scenario review-stale
./run inspect-tools \
  --capture "$(pwd)/examples/paybox-tools-list.fixture.json"
```

If Node is not on the login `PATH`, point the runner at an executable:

```bash
PROTECTED_PAYBOX_NODE_BINARY=/absolute/path/to/node ./run demo --scenario pass
```

The runner also checks the Codex runtime cache and the standard ChatGPT macOS
app runtime before asking for a Node path.

Compile a private custom plan:

```bash
./run plan \
  --intent "$(pwd)/examples/solana-25-usdc-intent.json" \
  --details
```

After reviewing the displayed mandate and authorizing it separately, run a
labeled fixture against the saved plan and exact displayed digest:

```bash
./run demo \
  --plan /absolute/path/from-the-plan-command.json \
  --confirm-policy <displayed-policy-digest> \
  --scenario pass
```

That example expresses exactly 25 USDC, at least 0.18 SOL, 1% maximum
slippage, a 0.00005 SOL network-fee cap, a separate 0.00002 SOL priority-fee
cap, and same-wallet settlement. It remains synthetic and does not estimate a
live market price.

The skill pauses for a separate user message before supplying the digest to
the CLI. The local CLI proves only that the supplied digest matches the
unchanged mandate; it cannot prove who authored the chat message or stop an
agent that ignores the skill. Bypass-resistant enforcement still requires a
mandatory Delta check inside PayBox's signing boundary.

The CLI requires absolute paths for input files, rejects symlinks and files
over 1 MiB, and writes optional artifacts as owner-only files.

## Inspect a PayBox tool surface safely

The offline inspector accepts a saved MCP `tools/list` response, bounds and
validates the JSON, redacts value-bearing schema examples, and classifies each
tool as `read`, `prepare`, `sign`, `broadcast`, `combined_write`, or
`unknown`.

```bash
./run inspect-tools \
  --capture /absolute/path/to/tools-list.json \
  --out /absolute/private/paybox-tool-snapshot.json
```

Unknown, preparatory, mutating, destructive, or misleadingly annotated tools
are never marked safe. The checked-in capture is synthetic. Even a real
captured file is recorded as unauthenticated offline input until PayBox
provides an authenticated contract or signed schema.

## What is checked

Deterministic code—not the model—owns:

- closed schema and asset identity validation;
- atomic-unit arithmetic;
- policy construction and authorization digest;
- reference-derived minimum receive;
- fee, price-impact, balance and recipient limits;
- exact fixture message-byte binding;
- decoded top-level and inner program allowlists;
- blockhash, quote, chain and simulation freshness;
- replay/concurrency handling;
- redaction-before-sealing;
- receipt verification.

The model may collect missing limits and explain results. It cannot author
evidence, decide the verdict, or unlock execution.

## Real, simulated and locked

| Surface | Status |
| --- | --- |
| Natural-language workflow | Skill instructions implemented |
| Closed intent and policy | Implemented locally |
| Exact proposal evaluation | Implemented for labeled fixtures |
| Local receipt | Unkeyed SHA-256 self-consistency checksum; not tamper-proof |
| Source authenticity | Not established by fixture hashes |
| Authenticated PayBox `tools/list` | Offline analyzer implemented; live contract not captured |
| Live quote/chain/simulation | Not implemented |
| Private Delta verifier/signature | Not integrated |
| PayBox signing/broadcast | Unreachable |

PayBox publicly documents scoped grants and operation-bound approvals, while
its terms say it does not assess an agent client's intent or correctness.
Protected PayBox makes the proposed missing layer concrete: evaluate the
human mandate against exact pre-sign bytes, then require that decision inside
PayBox's signing boundary.

## Documentation

- [Project plan](docs/PROJECT-PLAN.md)
- [Security boundary](docs/SECURITY-BOUNDARY.md)
- [Claim ledger](docs/CLAIM-LEDGER.md)
- [Sprint log](docs/SPRINT-LOG.md)

Primary external references:

- [PayBox connection and grant model](https://support.moonpay.com/en/articles/669841-how-agent-connections-work-in-paybox)
- [MoonPay Terms, Section 6B](https://www.moonpay.com/legal/terms_of_use_bvi_launchpad)
- [MoonPay swap skill](https://github.com/moonpay/skills/blob/main/skills/moonpay-swap-tokens/SKILL.md)
- [Solana transaction model](https://solana.com/docs/core)
- [Open Wallet Standard policy engine](https://raw.githubusercontent.com/open-wallet-standard/core/main/docs/03-policy-engine.md)

## Security

Do not paste a seed phrase, private key, OAuth token, PayBox client key, or
session key into the skill or CLI. This release does not need credentials.

Report security issues privately rather than opening a public issue with
sensitive data.

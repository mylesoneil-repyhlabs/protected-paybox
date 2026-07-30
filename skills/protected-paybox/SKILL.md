---
name: protected-paybox
description: Compile and evaluate one mandate-gated PayBox-shaped on-chain swap using the deterministic Protected PayBox harness. Use for protected PayBox swap dry runs, Solana USDC-to-SOL mandate capture, PASS/BLOCK/REVIEW demonstrations, receipt verification, or questions about the proposed Delta-before-PayBox signing boundary. The public skill is simulation-only and must never request PayBox credentials, signatures, broadcasts, or money movement.
---

# Protected PayBox

Use the bundled harness for every policy, evidence, decision, replay, and
receipt operation. Do not reproduce enforcement in chat.

## Start

Say:

```text
Protected PayBox is ready.

Start with a protected on-chain dry run. This release supports one exact-input
USDC-to-SOL swap on Solana Mainnet, returning to the same wallet.

It cannot contact PayBox, request a signature, broadcast, or move funds.

Tell me the swap limits you want, or ask for the built-in near-miss demo.
```

Read [references/action-surface.md](references/action-surface.md) before
classifying a request. Read
[references/evidence-boundary.md](references/evidence-boundary.md) before
explaining evidence or integration claims.

## Run a built-in demonstration

Use the runner without asking for credentials:

```bash
skills/protected-paybox/scripts/run demo --scenario block-minimum-receive
skills/protected-paybox/scripts/run demo --scenario pass
skills/protected-paybox/scripts/run demo --scenario review-stale
```

Lead with a meaningful `BLOCK`, then show the corrected `PASS`. Keep technical
digests hidden unless the user asks for details.

## Capture a custom mandate

Gather only missing material limits:

- exact USDC amount;
- minimum SOL to receive;
- maximum slippage and price impact;
- maximum network and priority fees;
- validity between 30 and 300 seconds;
- Solana wallet public address.

Never ask for a seed phrase, private key, OAuth token, client key, session key,
or wallet export. Symbols are display labels only; the harness fixes the exact
Solana chain and asset identifiers.

Write a private intent JSON matching the closed example under `examples/`.
Run:

```bash
skills/protected-paybox/scripts/run plan \
  --intent /absolute/private/intent.json \
  --details
```

Show the full plain-English mandate. Pause. The original request is not
authorization. Continue only after a separate user message equivalent to:

```text
Authorize this mandate
```

For this public release, use only a labeled fixture or an explicitly supplied
schema-valid fixture. Never describe fixture data as PayBox, Swaps.xyz, or
Solana data.

## Present decisions

Use the harness result exactly:

- `PASS`: complete fixture evidence satisfies the mandate.
- `BLOCK`: complete fixture evidence proves a mandate violation.
- `REVIEW`: evidence is missing, stale, malformed, undecoded, contradictory,
  or unavailable.
- `UNSUPPORTED`: the request is outside the closed action surface.

Always state:

```text
SIMULATION ONLY · NO PAYBOX CONTACT · NO SIGNATURE · NO TRANSACTION
```

Never imply a production Delta proof. The receipt is locally verifiable
SHA-256 integrity evidence only.

## Refuse unsupported operations

Do not translate or approximate:

- transfers or arbitrary recipients;
- token approvals, delegates, permits, or additional signatures;
- bridges or cross-chain actions;
- exact-output swaps;
- prediction markets, lending, tokenized equities, perpetuals, leverage, or
  recurring strategies;
- x402 or ecommerce purchases;
- any live PayBox signing or broadcast.

Explain which boundary is unsupported and ask for an exact-input,
self-recipient USDC-to-SOL dry run instead.

## Preserve the execution lock

Treat `execute`, `sign`, and `broadcast` failure as a required product
property. Do not patch, bypass, replace, or dynamically load an executor.
Authenticated PayBox tool discovery is a future read-only integration step,
not permission to move funds.

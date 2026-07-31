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

The CLI binds the supplied digest but cannot authenticate who authored a chat
message. This pause is a required skill workflow, not a bypass-resistant
security boundary. Never claim otherwise.

After that separate message, evaluate a labeled custom fixture using the
saved plan path and the exact displayed policy digest:

```bash
skills/protected-paybox/scripts/run demo \
  --plan /absolute/private/plan.json \
  --confirm-policy <displayed-policy-digest> \
  --scenario pass
```

For this public release, use only a labeled fixture. Never describe fixture
data as PayBox, Swaps.xyz, or Solana data.

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

Never imply a production Delta proof. The receipt is an unkeyed local
self-consistency checksum. It detects changes only when the checksum is not
also recomputed; it is not tamper-proof against an active editor.

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

## Inspect a supplied tool capture

If the user supplies a saved PayBox MCP `tools/list` JSON file, inspect it
offline:

```bash
skills/protected-paybox/scripts/run inspect-tools \
  --capture /absolute/private/tools-list.json \
  --out /absolute/private/paybox-tool-snapshot.json
```

Treat only the harness classification as authoritative. Describe `read`
entries as candidates, not verified-safe provider behavior. Every `prepare`,
`sign`, `broadcast`, `combined_write`, or `unknown` entry requires a mandate
gate. Do not request OAuth tokens or attempt to capture the tool list through
a network call.

## Preserve the execution lock

Treat `execute`, `sign`, and `broadcast` failure as a required product
property. Do not patch, bypass, replace, or dynamically load an executor.
Offline PayBox tool-schema inspection is not permission to move funds.

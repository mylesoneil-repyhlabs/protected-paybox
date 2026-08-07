# Preserved Solana Evidence Contract

## Status

Protected PayBox retains one offline Solana USDC-to-SOL exact-input fixture so
the card-first release does not regress the original swap demonstration. It is
not generalized swap support and it does not contact PayBox, a quote provider,
Solana RPC, a wallet, Delta, or a broadcaster.

## Fixed surface

```text
chain: Solana mainnet fixture
sell: canonical USDC mint fixture
buy: canonical wrapped SOL mint fixture
mode: exact input
operation: one swap only
execution: locked
```

The closed intent includes atomic sell amount, minimum receive, slippage cap,
network-fee cap, price-impact cap, wallet/recipient, permitted builder/programs,
validity, and one-use authorization.

## Evidence groups

- quote facts and exact integer recomputation;
- canonical asset metadata and token program;
- wallet and recipient;
- serialized message bytes plus digest;
- decoded instructions and inner-call visibility;
- blockhash, lookup-table accounts, and freshness;
- simulation success, fee, balance deltas, logs, and errors; and
- explicit self-reported fixture provenance.

The evaluator checks exact binding between intent, decoded transaction, quote,
chain data, and simulation. Symbol strings never substitute for canonical asset
identifiers.

## Decisions

`BLOCK` fixtures include insufficient minimum receive, excessive network fee,
excessive price impact, and wrong recipient.

`REVIEW` fixtures include stale evidence, unknown program, hidden inner call,
and failed simulation.

The public fixture can `PASS` only when every closed local field matches. That
`PASS` is not permission to sign or broadcast.

## Production requirements

A future generalized swap release needs:

- account-confirmed PayBox `request_swap` schema and enabled chain/tool surface;
- supported-chain and asset catalog with canonical addresses and decimals;
- live quote evidence;
- exact unsigned transaction build;
- fresh chain and simulation evidence;
- signed intent and real Delta proof;
- a mandatory PayBox signing/broadcast hook;
- atomic one-use consumption and uncertain-result reconciliation; and
- no raw signing or broadcast path available to the agent.

PayBox's public developer reference describes a generalized MoonX-backed swap
request, but Protected PayBox only discovers that schema and cannot call it.
Until an enforceable adapter satisfies the requirements above, describe this
only as the fixed USDC-to-SOL local fixture.

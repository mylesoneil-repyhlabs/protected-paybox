# Evidence and trust boundary

## Current release

The public harness uses deterministic local fixtures. It does not authenticate
to PayBox, Swaps.xyz, or a Solana RPC endpoint. A fixture `PASS` proves only
that one exact fixture proposal satisfied the local closed policy.

The local receipt:

- binds policy, authorization, proposal, evidence, message bytes, decision,
  nonce, boundary, and expiry;
- detects later mutation by recomputing every binding;
- is not a Delta signature or proof;
- does not authenticate where fixture facts originated.

## Required connected preflight

A future connected mode requires:

1. authenticated PayBox tool schema and wallet/grant fingerprint;
2. exact unsigned Solana message before approval or signing;
3. PayBox builder/venue identity;
4. current balances, mint state, slot, blockhash and fees;
5. independent reference price;
6. fully resolved v0 message and lookup tables;
7. decoded top-level and inner instructions;
8. simulation of identical message bytes;
9. fresh blockhash validity immediately before signing.

Missing or opaque pre-sign bytes must produce `REVIEW`, never `PASS`.

## Source authenticity

OAuth, API keys and TLS can authenticate a channel but do not independently
sign provider facts. Hashes provide tamper evidence after capture, not proof
of original source truth. A finalized on-chain transaction is
consensus-verifiable; a single RPC response remains provider-mediated.

PayBox signing would prove that a wallet signed bytes. It would not prove the
bytes satisfied the human mandate unless Delta is mandatory inside the
signing boundary.

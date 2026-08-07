# Stakeholder Reviews

These are independent synthetic stakeholder reactions used for design pressure.
They are not PayBox, Delta-customer, or user research and must not be presented
as market evidence.

## Candidate review

### Skeptical PayBox product owner

Initial verdict: no-go for a PayBox-facing release; strong internal demo.

Release blockers:

1. Canned CLI/MCP demos silently supplied their own policy digest while the copy
   implied human confirmation.
2. MCP card evaluation had no durable one-use state by default and was
   incorrectly annotated read-only.
3. “Native merchant/amount scope” and “high-frequency merchants” exceeded the
   evidence for a publicly documented Phase 2 product and unranked fixtures.
4. The partner design assumed PayBox would own basket evidence and every
   lifecycle event, with no latency target or authenticated human fallback.

Positive findings:

- exact basket, quantity, fee/tip, destination, recurring, subscription,
  staleness, and tamper checks make Delta's incremental value visible;
- PayBox Phase 2 and MoonAgents Card are separated carefully;
- execution and proof limitations are unusually explicit; and
- the block → corrected pass → incomplete-evidence review sequence is pitchable.

### Delta CTO

Initial verdict: no-go for release wording; conditional go for an internal
simulation after truth and binding fixes. No-go for live enforcement.

Release blockers:

1. A proposed credential expiry could outlive the checkout or authorized
   mandate.
2. Extractor request/response digests were shape-checked but not recomputed, and
   no source artifact existed.
3. MCP secret rejection covered too few key aliases and no credential-shaped
   values while documentation made a broader claim.
4. Matching a digest modeled confirmation but did not enforce human identity or
   authorization.

Additional engineering findings:

- durable MCP one-use state was opt-in;
- tool annotations and mixed modern/legacy protocol state were inaccurate;
- JSON-RPC errors flattened unknown methods into invalid parameters;
- MCP-level different-nonce/cross-process concurrency needed tests; and
- the one-use claim stored an unused record digest.

Positive findings:

- exact minor-unit arithmetic, closed schemas, checkout hashing, proposal
  binding, and deterministic decision semantics are sound demo foundations;
- missing or uncertain evidence fails to `REVIEW`;
- the production design carries forward canonical action, exclusive release,
  one-use lease, journal-before-release, idempotency, and reconciliation; and
- release packaging is allowlisted, deterministic, scanned, and cold tested.

### Target user

Initial verdict: conditional go for a technical partner demo; no-go for the
non-technical mobile persona.

The persona correctly understood all three decisions and did not believe a real
card, order, or payment was involved. Confusion points:

- the product is a local desktop plugin, not a mobile PayBox experience;
- “exact checkout proposal” and an unlabeled `PASS` sounded too live;
- minor-unit amounts were hard to interpret;
- `REVIEW` did not identify the missing field;
- installation lacked a plain permissions summary; and
- diagnostics obscured the core three-command story.

## Mini-sprint fixes

### Product truth and UX

- Canned records now carry `FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION`.
- Custom records say caller-supplied matching digest with unauthenticated
  authorship; copy says modeled confirmation, not human authorization.
- Every card result says `SIMULATED`, “local fixture,” no provider/merchant
  contact, no card, no order, and no money movement.
- “Exact checkout proposal” became “Simulated checkout fixture.”
- Default USD output shows `$30.00 USD` instead of `3000 minor units`.
- Incomplete evidence names the item, missing attribute, and required value.
- Multi-violation results retain and display every failed constraint.
- README identifies the desktop/local boundary and gives a plain permissions
  summary.
- Merchant names are representative commerce archetypes, not a ranked fat-head
  or coverage claim.

### Runtime and evidence

- Credential expiry is bounded by both checkout and mandate expiry.
- The mandate binds an opaque storefront/merchant account reference in addition
  to platform key/domain; credential scope uses that reference.
- Extractor request and response digests are recomputed from the bound solution,
  requested types, missing fields, and returned attributes.
- Documentation explicitly says current fixtures have no source artifact; live
  semantic evidence still requires source provenance.
- Secret ingress checks cover key aliases, PAN-like Luhn values, bearer/JWT/token
  patterns, and private-key headers without echoing values.
- MCP state defaults to a private durable location; same-plan different-nonce
  use converges across separate server processes.
- Per-tool read-only/idempotency annotations now match behavior.
- Modern request metadata remains stateless after a legacy initialize.
- Unknown JSON-RPC methods return `-32601`; invalid tool input returns `-32602`.
- The unused record digest was removed from one-use claim state.

### Partner design

- Merchant/evidence components own basket semantics and an opaque evidence
  digest; PayBox supplies only its authenticated PAN-free credential envelope.
- Delta returns a compact signed release token so PayBox need not receive the
  basket.
- Proposed pilot targets are p95 ≤500 ms, p99 ≤1,000 ms, and a 1,500 ms hard
  deadline with evidence precomputed.
- `REVIEW` or outage blocks autonomous release and may route to a separately
  authenticated passkey approval logged as direct human approval, not a Delta
  `PASS`.
- Lifecycle events may come from PayBox, processor, issuer, or merchant adapter;
  the sandbox pilot must discover the real contract.
- Production address binding requires an opaque saved-address reference or
  keyed digest; the unsalted fixture digest is disclosed as guessable.

## Residual dependencies

Not release defects for the local simulation, but required before a partner
pilot or live claim:

- authenticated PayBox card schema, provider, sandbox, and exclusive hook;
- reviewed source-artifact corpus and live generalized-extractor adapter;
- actual storefront-to-PayBox scope/MID/network-descriptor mapping;
- real signed Delta proof using pinned released dependencies;
- provider idempotency plus authorization/capture/refund reconciliation;
- PCI/data-retention agreement and opaque saved-address handling;
- measured latency/availability and authenticated fallback behavior; and
- end-to-end sandbox authorization plus reversal/refund evidence.

## Re-gate

Final verdicts for the simulation-only partner release:

- skeptical PayBox product owner: `GO`;
- Delta CTO: `GO`;
- target user: `GO` for an assisted desktop/local technical evaluation; and
- all three: `NO-GO` for live PayBox enforcement, mobile/general-user use, or
  any claim that a card, authorization, order, or payment occurred.

The first re-gate found additional adversarial issues:

- a stored `REVIEW` could be promoted to `PASS` without atomically consuming
  the one-use plan;
- top-level evidence collection time was not freshness checked;
- the MCP omitted the modern `resultType` and did not reject unsupported
  protocol versions;
- a cold-release assertion checked the wrong MCP result field;
- item title was displayed but not exact-bound;
- CLI plan creation did not share the MCP's credential-shaped input scanner;
  and
- a PAN-shaped JSON property name was rejected later but echoed by the schema
  error.

The second mini-sprint added atomic temporal promotion with 16-process race
coverage, independent collection freshness, exact item-title binding, modern
MCP version/result semantics, a corrected cold MCP gate, shared CLI/MCP/evidence
secret scanning, and value-plus-property-name no-echo tests.

Final source verification passed 155/155 tests plus metadata, skill, link,
content, shell-syntax, and diff checks. The official plugin and skill validators
also passed. The committed merge, annotated tag, Node 22/24 CI, deterministic
bundle job, and tag-triggered CI passed. A fresh GitHub release download matched
the published digest and passed the full restricted-`PATH`, source-deletion
cold-install gate.

No reviewer reported an unresolved P0 or P1 after the final probe.

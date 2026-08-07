# Tools

## Local CLI

| Command | Purpose | Side effects |
| --- | --- | --- |
| `./run doctor` | Show runtime and locked boundary | None |
| `./run card-merchants` | List representative merchant fixtures | None |
| `./run card-plan --intent <absolute-path>` | Compile and privately save a card plan | Local owner-only file |
| `./run card-demo --merchant doordash --scenario <name>` | Evaluate a labeled fixture | Optional local record |
| `./run card-simulate ...` | Evaluate a saved plan and exact evidence | Private one-use history and optional record |
| `./run demo --scenario <name>` | Run the fixed USDC-to-SOL swap fixture | Optional local record |
| `./run verify --record <absolute-path>` | Verify local record self-consistency | None |
| `./run inspect-tools --capture <absolute-path>` | Classify a saved PayBox tool list without OAuth | Private redacted snapshot |
| `./run execute`, `sign`, `broadcast` | Demonstrate the public execution lock | Always fails |

Relative input paths are rejected. Runtime state is stored in a private
version-independent state directory; callers cannot redirect the canonical
one-use history through CLI options.

## MCP tools

| Tool | Input | Result |
| --- | --- | --- |
| `protected_paybox_capabilities` | none | Exact fixture surface and claim boundary |
| `protected_paybox_card_plan` | closed card intent | Canonical plan and authorization prompt |
| `protected_paybox_card_demo` | merchant, scenario | Fixture `PASS`, `BLOCK`, or `REVIEW` |
| `protected_paybox_card_evaluate` | plan, evidence, digest, nonce | Exact card decision and record |
| `protected_paybox_swap_demo` | scenario | Fixed swap decision and record |
| `protected_paybox_verify_record` | record | Local checksum verification |

Capabilities and record verification are read-only and idempotent. Plan and
canned-demo tools are read-only but not idempotent because they mint fixture
IDs/timestamps. Exact card evaluation is stateful, non-destructive, idempotent
by nonce, and writes private one-use history. All tools are closed world. These
annotations describe the local server; they are not a security substitute for
runtime enforcement.

The server supports:

- stateless `server/discover`, `tools/list`, and `tools/call` for MCP
  `2026-07-28`; and
- legacy `initialize`, `tools/list`, and `tools/call` for retained clients.

## Sensitive-field rejection

The MCP rejects credential-shaped keys at any nesting depth, including PAN,
CVV/CVC, card number, private key, seed phrase, mnemonic, OAuth tokens, client
keys, and client secrets. Error responses identify the prohibited field path
but never echo its value.

## Scenario names

Card:

```text
pass
block-merchant
block-storefront
block-total
block-tip
block-item
block-quantity
block-recurring
block-address
block-subscription
block-credential-expiry
review-stale
review-low-confidence
review-incomplete
review-total-mismatch
review-snapshot-tamper
```

Swap:

```text
pass
block-minimum-receive
block-network-fee
block-price-impact
block-recipient
review-stale
review-unknown-program
review-hidden-inner-call
review-simulation-failed
```

## Result wording

Every card decision carries this boundary:

```text
LOCAL FIXTURE ONLY · NO PAYBOX OR MERCHANT CONTACT · NO CARD CREATED OR AUTHORIZED · NO ORDER PLACED · NO MONEY MOVED
```

The record is not a signed Delta proof. Canned demos are labeled
`FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION`. Custom evaluation records a matching
caller-supplied digest but cannot authenticate the author. `PASS` means only
that the complete local fixture satisfied the displayed closed policy.

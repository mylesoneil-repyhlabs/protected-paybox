# Research

Observation date: 2026-08-07. Public documentation can change; authenticated
provider contracts take precedence over this snapshot.

## PayBox card status

PayBox's homepage describes merchant- and amount-scoped one-time virtual cards.
Its Help Center says payment-card support is coming in a future release and the
FAQ calls it Phase 2. Public sources do not identify the card-tokenization
provider, issuer, processor, network contract, tool schema, supported merchant
list, geography, pre-authorization hook, or lifecycle event schema.

The public MCP endpoint requires OAuth. Unauthenticated discovery does not
reveal the card tool surface.

Sources:

- [PayBox](https://paybox.sh/)
- [Store credentials once](https://support.moonpay.com/en/articles/669779-paybox-store-credentials-once-let-ai-agents-pay-securely)
- [Agent connections](https://support.moonpay.com/en/articles/669841-how-agent-connections-work-in-paybox)
- [PayBox FAQs](https://support.moonpay.com/en/articles/669843-paybox-faqs)
- [PayBox MCP](https://api.paybox.sh/mcp)

Product conclusion: card work is a partner-evaluation simulation until an
authenticated contract and sandbox prove otherwise.

## MoonAgents Card

MoonAgents Card is a separate crypto-funded virtual Mastercard debit product.
MoonPay's product page identifies Baanx as the card-service provider, Monavate
as issuer, and Mastercard as the network. Its Help Center identifies Veriff
identity checks, Solana USDC/XO funding, and no current US availability. The
Help Center describes online use wherever Mastercard is accepted, while also
warning that a merchant or transaction type may be unsupported and that
browser agents entering PAN/CVV are technically possible but not recommended
for everyday use. No exact MCC, merchant, region-by-region, 3DS, or agent-
operated-checkout coverage matrix is published.

Sources:

- [MoonAgents Card product page](https://www.moonpay.com/agents/card)
- [MoonAgents Card Help Center](https://support.moonpay.com/en/articles/629708-moonagents-card-crypto-funded-virtual-payment-cards)

Product conclusion: do not use a reusable MoonAgents PAN in this demo and do not
infer DoorDash coverage from nominal Mastercard acceptance.

## DoorDash and merchant coverage

DoorDash is the right reference journey because restaurant, item, quantity,
modifier, destination, tax, delivery fee, service fee, tip, total, ETA, and
substitution constraints expose Delta's value beyond a merchant/amount grant.

No public evidence reviewed establishes a successful PayBox or MoonAgents
DoorDash payment. The demo therefore uses a synthetic DoorDash-shaped checkout.

“Merchant coverage” requires all five independently verified layers:

1. payment-rail acceptance in the user's region;
2. an agent-operable ordering path;
3. authoritative pre-release checkout evidence;
4. a mandatory Delta credential-release control point; and
5. authorization/capture/refund events for reconciliation.

## Generalized evidence extractor

The Repyh evidence service accepts a `solution` plus requested scalar
attributes and returns a sparse evidence map. Its backend seam is suitable for
a future `paybox-card://authorization/<opaque-id>` resolver.

The existing product-page scraper is not binding payment truth: price is a
floating value and semantic extraction can be model-assisted. Protected PayBox
therefore limits this service to item semantics and requires authenticated
provider/merchant JSON for money and identity.

The current Delta HTTP evidence bridge consumes scalar boolean, integer, and
string values. Initial policies should use scalar aggregates; line-item list
support requires a deliberately versioned API change.

## Swaps

MoonPay CLI documentation identifies swaps.xyz for swap/bridge construction and
separates quote, unsigned transaction build, signing, and broadcast. That is a
clean future Delta control point. PayBox's authenticated tool surface was not
observed, so the current plugin retains only one offline USDC-to-SOL fixture.

## MCP

The local server implements current MCP `2026-07-28` stateless discovery and a
legacy compatibility path.

Sources:

- [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

## Partner questions

1. What exact PayBox card tool and staged-authorization schemas are available?
2. Who tokenizes, issues, processes, and enforces merchant/amount scope?
3. Is scope checked again at network authorization?
4. Can Delta be mandatory before every credential release?
5. What alternate tools could bypass that hook?
6. What are card, region, MCC, merchant, and 3DS restrictions?
7. Which authorization, capture, reversal, refund, and dispute events exist?
8. What are hook latency, availability, idempotency, and timeout semantics?
9. Can PayBox bind the released credential to Delta's proposal digest?
10. Which merchant journeys can be validated end to end in a sandbox?

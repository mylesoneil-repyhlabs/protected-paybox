import { digest } from "../canonical.js";
import { SCHEMAS } from "../constants.js";
import { GuardError } from "../errors.js";
import { representativeMerchant } from "./catalog.js";
import {
  cardSnapshotPayload,
  PAYBOX_CARD_CONTRACT_PLACEHOLDER,
} from "./evidence.js";

const FIXTURE_ITEMS = Object.freeze({
  doordash: {
    item_id: "doordash:demo:veggie-bowl",
    title: "Demo veggie bowl",
    attributes: {
      category: "prepared_meal",
      dietary: "vegetarian",
      contains_alcohol: false,
    },
    solution: "https://doordash.com/store/demo/item/veggie-bowl",
  },
  amazon: {
    item_id: "amazon:demo:usb-c-cable",
    title: "Demo USB-C cable",
    attributes: { category: "electronics_accessory", condition: "new" },
    solution: "https://amazon.com/dp/DEMOUSBCCABLE",
  },
  uber: {
    item_id: "uber:demo:standard-ride",
    title: "Demo standard ride",
    attributes: { category: "ground_transport", service_level: "standard" },
    solution: "https://uber.com/demo/ride/standard",
  },
  instacart: {
    item_id: "instacart:demo:grocery-basket",
    title: "Demo grocery basket",
    attributes: { category: "groceries", contains_alcohol: false },
    solution: "https://instacart.com/store/demo/products/grocery-basket",
  },
  walmart: {
    item_id: "walmart:demo:household-essentials",
    title: "Demo household essentials",
    attributes: { category: "household_essentials", seller: "walmart" },
    solution: "https://walmart.com/ip/demo-household-essentials",
  },
  target: {
    item_id: "target:demo:home-supplies",
    title: "Demo home supplies",
    attributes: { category: "home_supplies", seller: "target" },
    solution: "https://target.com/p/demo-home-supplies",
  },
});

export const CARD_DEMO_SCENARIOS = Object.freeze([
  "pass",
  "block-merchant",
  "block-storefront",
  "block-total",
  "block-tip",
  "block-item",
  "block-quantity",
  "block-recurring",
  "block-address",
  "block-subscription",
  "block-credential-expiry",
  "review-stale",
  "review-low-confidence",
  "review-incomplete",
  "review-total-mismatch",
  "review-snapshot-tamper",
]);

export function buildCardDemoIntent(merchantKey = "doordash", overrides = {}) {
  const merchant = representativeMerchant(merchantKey);
  const fixture = fixtureItem(merchantKey);
  return {
    schema_version: SCHEMAS.CARD_INTENT,
    action_type: "commerce.card.purchase",
    merchant: {
      key: merchant.key,
      display_name: merchant.display_name,
      domain: merchant.domain,
      account_reference: `fixture-${merchant.key}-storefront`,
    },
    items: [
      {
        item_id: fixture.item_id,
        title: fixture.title,
        quantity: 1,
        max_unit_price_minor: "2000",
        required_attributes: { ...fixture.attributes },
      },
    ],
    currency: "USD",
    max_total_minor: "3000",
    max_tax_minor: "250",
    max_tip_minor: "400",
    max_delivery_fee_minor: "400",
    max_service_fee_minor: "250",
    delivery_address_digest: digest("synthetic-private-delivery-address"),
    delivery_postal_code: "10001",
    expires_in_seconds: 300,
    ...overrides,
  };
}

export function buildCardDemoEvidence(
  plan,
  { scenario = "pass", now = new Date() } = {},
) {
  if (!CARD_DEMO_SCENARIOS.includes(scenario)) {
    throw new GuardError("SCENARIO_UNKNOWN", `Unknown card scenario: ${scenario}`);
  }
  const observedAt = new Date(now);
  if (scenario === "review-stale") observedAt.setMinutes(observedAt.getMinutes() - 5);
  const checkoutExpiresAt = new Date(observedAt.getTime() + 120_000);
  const credentialExpiresAt = new Date(observedAt.getTime() + 90_000);
  if (scenario === "block-credential-expiry") {
    credentialExpiresAt.setMinutes(credentialExpiresAt.getMinutes() + 10);
  }
  const estimatedAt = new Date(observedAt.getTime() + 45 * 60_000);
  const policy = plan.policy;
  const exact = policy.basket.exact_items[0];
  const source = fixtureItem(policy.merchant.key);

  const merchant = {
    key: scenario === "block-merchant" ? "different-merchant" : policy.merchant.key,
    display_name:
      scenario === "block-merchant" ? "Different Merchant" : policy.merchant.display_name,
    domain:
      scenario === "block-merchant" ? "different.example.com" : policy.merchant.domain,
    mcc: policy.merchant.key === "uber" ? "4121" : "5812",
    country: "US",
    account_reference:
      scenario === "block-storefront"
        ? "fixture-different-storefront"
        : policy.merchant.account_reference,
  };

  const quantity = scenario === "block-quantity" ? 2 : exact.quantity;
  const unitPrice = scenario === "block-quantity" ? "1000" : "1899";
  const lineTotal = (BigInt(unitPrice) * BigInt(quantity)).toString();
  const attributes = { ...source.attributes };
  const item = {
    item_id:
      scenario === "block-item" ? `${policy.merchant.key}:demo:unapproved-item` : exact.item_id,
    title: scenario === "block-item" ? "Unapproved demo item" : exact.title,
    quantity,
    unit_price_minor: unitPrice,
    line_total_minor: lineTotal,
    solution: source.solution,
    extraction: buildExtraction({
      solution: source.solution,
      attributes,
      confidenceBps: scenario === "review-low-confidence" ? 6000 : 10_000,
      missingAttributes:
        scenario === "review-incomplete" ? [Object.keys(attributes)[0]] : [],
      warnings: [],
    }),
  };

  const subtotal = lineTotal;
  let tax = "160";
  let deliveryFee = "299";
  const serviceFee = "190";
  const otherFee = "0";
  let tip = "300";
  const discount = "200";
  if (scenario === "block-total") deliveryFee = "1299";
  if (scenario === "block-tip") tip = "650";
  let total = (
    BigInt(subtotal) +
    BigInt(tax) +
    BigInt(deliveryFee) +
    BigInt(serviceFee) +
    BigInt(otherFee) +
    BigInt(tip) -
    BigInt(discount)
  ).toString();
  if (scenario === "review-total-mismatch") total = (BigInt(total) + 1n).toString();
  const pricing = {
    currency: policy.money.currency,
    subtotal_minor: subtotal,
    tax_minor: tax,
    delivery_fee_minor: deliveryFee,
    service_fee_minor: serviceFee,
    other_fee_minor: otherFee,
    tip_minor: tip,
    discount_minor: discount,
    total_minor: total,
  };
  const fulfillment = {
    type: "delivery",
    address_digest:
      scenario === "block-address"
        ? digest("different-synthetic-address")
        : policy.fulfillment.address_digest,
    postal_code: policy.fulfillment.postal_code,
    estimated_at: estimatedAt.toISOString(),
  };
  const paymentRequest = {
    credential_type: "one_time_virtual_card",
    merchant_scope: merchant.account_reference,
    amount_minor: total,
    currency: policy.money.currency,
    use_count: 1,
    expires_at: credentialExpiresAt.toISOString(),
    recurring: scenario === "block-recurring",
    merchant_initiated: false,
    card_on_file: false,
    incremental_authorization: false,
    partial_authorization: false,
  };
  const risk = {
    gift_card: false,
    cash_equivalent: false,
    alcohol: false,
    age_restricted: false,
    subscription: scenario === "block-subscription",
  };
  const snapshot = cardSnapshotPayload({
    merchant,
    items: [item],
    pricing,
    fulfillment,
    payment_request: paymentRequest,
    risk,
  });
  const snapshotDigest = digest(snapshot);

  const evidence = {
    schema_version: SCHEMAS.CARD_EVIDENCE,
    mode: "simulated_fixture",
    collected_at: observedAt.toISOString(),
    provenance: {
      authenticity: "SELF_REPORTED_FIXTURE",
      financial_authority: "SELF_REPORTED_FIXTURE",
      paybox_contacted: false,
      merchant_contacted: false,
      network_contacted: false,
      statement:
        "Locally generated partner-evaluation fixture; not PayBox, merchant, issuer, network, or generalized-extractor output.",
    },
    provider_contract: { ...PAYBOX_CARD_CONTRACT_PLACEHOLDER },
    merchant,
    checkout: {
      snapshot_id: `fixture-${policy.merchant.key}-${scenario}`,
      snapshot_sha256: snapshotDigest,
      observed_at: observedAt.toISOString(),
      expires_at: checkoutExpiresAt.toISOString(),
    },
    items: [item],
    pricing,
    fulfillment,
    payment_request: paymentRequest,
    risk,
  };
  if (scenario === "review-snapshot-tamper") {
    evidence.items[0].title = "Tampered after snapshot";
  }
  return evidence;
}

function buildExtraction({
  solution,
  attributes,
  confidenceBps,
  missingAttributes,
  warnings,
}) {
  const request = {
    solution,
    attributes: Object.fromEntries(
      Object.entries(attributes).map(([name, value]) => [
        name,
        { type: evidenceLayerType(value) },
      ]),
    ),
  };
  const response = { ...attributes };
  for (const missing of missingAttributes) delete response[missing];
  return {
    interface: "evidence-layer-ai:/extract-compatible",
    request_digest: digest(request),
    response_digest: digest(response),
    authority: "SELF_REPORTED_FIXTURE",
    confidence_bps: confidenceBps,
    missing_attributes: [...missingAttributes],
    warnings: [...warnings],
    attributes: response,
  };
}

function evidenceLayerType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "integer";
  return "string";
}

function fixtureItem(merchantKey) {
  const item = FIXTURE_ITEMS[merchantKey];
  if (!item) {
    throw new GuardError(
      "MERCHANT_FIXTURE_UNKNOWN",
      `No card item fixture exists for merchant: ${merchantKey}`,
    );
  }
  return { ...item, attributes: { ...item.attributes } };
}

import { randomUUID } from "node:crypto";
import { digest } from "../canonical.js";
import { PUBLIC_BOUNDARY, SCHEMAS } from "../constants.js";
import { GuardError } from "../errors.js";
import {
  validateCardIntent,
  validateCardPlanShape,
} from "./validation.js";

export function createCardPlan(
  input,
  { now = new Date(), id = randomUUID() } = {},
) {
  const intent = validateCardIntent(input);
  const createdAt = new Date(now);
  if (!Number.isFinite(createdAt.getTime())) throw new Error("now must be valid");
  const expiresAt = new Date(
    createdAt.getTime() + intent.expires_in_seconds * 1000,
  );
  const policy = {
    schema_version: SCHEMAS.CARD_POLICY,
    category: "PAYBOX-CARD-PURCHASE",
    action_type: "commerce.card.purchase",
    merchant: { ...intent.merchant },
    basket: {
      exact_items: intent.items.map((item) => ({ ...item })),
      additional_items_allowed: false,
      substitutions_allowed: false,
    },
    money: {
      currency: intent.currency,
      max_total_minor: intent.max_total_minor,
      max_tax_minor: intent.max_tax_minor,
      max_tip_minor: intent.max_tip_minor,
      max_delivery_fee_minor: intent.max_delivery_fee_minor,
      max_service_fee_minor: intent.max_service_fee_minor,
    },
    fulfillment: {
      type: "delivery",
      address_digest: intent.delivery_address_digest,
      postal_code: intent.delivery_postal_code,
    },
    payment: {
      credential_type: "one_time_virtual_card",
      merchant_bound: true,
      amount_bound: true,
      currency_bound: true,
      use_count: 1,
      recurring_allowed: false,
      merchant_initiated_allowed: false,
      card_on_file_allowed: false,
      incremental_authorization_allowed: false,
      partial_authorization_allowed: false,
    },
    prohibitions: {
      gift_cards: true,
      cash_equivalents: true,
      alcohol: true,
      age_restricted_items: true,
      subscriptions: true,
    },
    evidence: {
      critical_financial_authority_required: "MERCHANT_OR_PROVIDER_AUTHENTICATED",
      generalized_extractor_use:
        "NON_FINANCIAL_ITEM_SEMANTICS_ONLY",
      incomplete_or_conflicting_result: "REVIEW",
    },
    authorization: {
      use_count: 1,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
  };
  return {
    schema_version: "protected-paybox.plan.card-purchase.v1",
    plan_id: id,
    created_at: createdAt.toISOString(),
    source_intent_digest: digest(intent),
    intent,
    policy,
    policy_digest: digest(policy),
    status: "AWAITING_AUTHORIZATION",
    boundary: { ...PUBLIC_BOUNDARY },
  };
}

export function validateCardPlan(plan) {
  validateCardPlanShape(plan);
  const intent = validateCardIntent(plan.intent);
  if (digest(intent) !== plan.source_intent_digest) {
    throw new GuardError(
      "PLAN_INTENT_DIGEST_MISMATCH",
      "The card plan intent no longer matches its source digest.",
    );
  }
  const expected = createCardPlan(intent, {
    now: new Date(plan.created_at),
    id: plan.plan_id,
  });
  if (
    plan.policy_digest !== digest(plan.policy) ||
    plan.policy_digest !== expected.policy_digest
  ) {
    throw new GuardError(
      "PLAN_POLICY_DIGEST_MISMATCH",
      "The card policy no longer matches its closed intent.",
    );
  }
  if (digest(plan.boundary) !== digest(PUBLIC_BOUNDARY)) {
    throw new GuardError(
      "PLAN_BOUNDARY_MISMATCH",
      "The card plan execution boundary was changed.",
    );
  }
  return plan;
}

export function formatCardMandate(plan) {
  const policy = plan.policy;
  const items = policy.basket.exact_items
    .map(
      (item) =>
        `${item.quantity} × ${item.title} (≤${formatMinor(item.max_unit_price_minor, policy.money.currency)} each)`,
    )
    .join("; ");
  return [
    "CARD MANDATE CAPTURED · AWAITING YOUR AUTHORIZATION",
    "",
    `Merchant: ${policy.merchant.display_name} (${policy.merchant.domain}); storefront/account ${policy.merchant.account_reference}`,
    `Basket: ${items}`,
    `All-in cap: ${formatMinor(policy.money.max_total_minor, policy.money.currency)}`,
    `Component caps: tax ${formatMinor(policy.money.max_tax_minor, policy.money.currency)}; tip ${formatMinor(policy.money.max_tip_minor, policy.money.currency)}; delivery ${formatMinor(policy.money.max_delivery_fee_minor, policy.money.currency)}; service ${formatMinor(policy.money.max_service_fee_minor, policy.money.currency)}`,
    `Delivery: postal code ${policy.fulfillment.postal_code}; exact private address digest ${policy.fulfillment.address_digest}`,
    "Payment: one use, merchant/amount/currency bound; no recurring, merchant-initiated, card-on-file, incremental, or partial authorization",
    "Forbidden: extra items, substitutions, subscriptions, gift cards, cash equivalents, alcohol, and age-restricted items",
    `Validity: one use; expires ${policy.authorization.expires_at}`,
    "",
    'In an agent chat, send "Authorize this mandate" as a separate message.',
    "This public build evaluates labeled local fixtures only. It cannot request or reveal a card credential, contact PayBox, authorize a card, or place an order.",
  ].join("\n");
}

function formatMinor(value, currency) {
  if (currency !== "USD") return `${currency} ${value} minor units`;
  const amount = BigInt(value);
  return `$${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")} USD`;
}

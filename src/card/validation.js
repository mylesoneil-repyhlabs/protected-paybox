import { assertExactKeys, clone } from "../canonical.js";
import { SCHEMAS } from "../constants.js";
import { GuardError } from "../errors.js";
import { rejectSensitiveInput } from "../sensitive-input.js";
import {
  requireDigest,
  requireIsoTimestamp,
  requireUnsignedIntegerString,
} from "../validation.js";

const DOMAIN_PATTERN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const MERCHANT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{1,127}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const POSTAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{1,15}$/;

const INTENT_KEYS = [
  "schema_version",
  "action_type",
  "merchant",
  "items",
  "currency",
  "max_total_minor",
  "max_tax_minor",
  "max_tip_minor",
  "max_delivery_fee_minor",
  "max_service_fee_minor",
  "delivery_address_digest",
  "delivery_postal_code",
  "expires_in_seconds",
];

export function validateCardIntent(input) {
  rejectSensitiveInput(input, "card intent");
  assertExactKeys(input, INTENT_KEYS, "card intent");
  requireValue(input.schema_version, SCHEMAS.CARD_INTENT, "schema_version");
  requireValue(input.action_type, "commerce.card.purchase", "action_type");
  const merchant = validateMerchant(input.merchant, "card intent.merchant");
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
    throw new GuardError(
      "CARD_ITEMS_INVALID",
      "Card intent items must contain between 1 and 20 exact line items.",
    );
  }
  const seenItems = new Set();
  const items = input.items.map((item, index) => {
    const normalized = validateIntentItem(item, index);
    if (seenItems.has(normalized.item_id)) {
      throw new GuardError(
        "CARD_ITEM_DUPLICATE",
        "Card intent item identifiers must be unique.",
      );
    }
    seenItems.add(normalized.item_id);
    return normalized;
  });
  requireCurrency(input.currency, "card intent.currency");
  for (const field of [
    "max_total_minor",
    "max_tax_minor",
    "max_tip_minor",
    "max_delivery_fee_minor",
    "max_service_fee_minor",
  ]) {
    requireUnsignedIntegerString(input[field], `card intent.${field}`);
  }
  requireDigest(
    input.delivery_address_digest,
    "card intent.delivery_address_digest",
  );
  requirePostal(input.delivery_postal_code, "card intent.delivery_postal_code");
  if (
    !Number.isInteger(input.expires_in_seconds) ||
    input.expires_in_seconds < 30 ||
    input.expires_in_seconds > 900
  ) {
    throw new GuardError(
      "VALIDITY_INVALID",
      "Card mandate validity must be an integer between 30 and 900 seconds.",
    );
  }
  return {
    schema_version: SCHEMAS.CARD_INTENT,
    action_type: "commerce.card.purchase",
    merchant,
    items,
    currency: input.currency,
    max_total_minor: input.max_total_minor,
    max_tax_minor: input.max_tax_minor,
    max_tip_minor: input.max_tip_minor,
    max_delivery_fee_minor: input.max_delivery_fee_minor,
    max_service_fee_minor: input.max_service_fee_minor,
    delivery_address_digest: input.delivery_address_digest,
    delivery_postal_code: input.delivery_postal_code.toUpperCase(),
    expires_in_seconds: input.expires_in_seconds,
  };
}

export function validateMerchant(value, context = "merchant") {
  assertExactKeys(
    value,
    ["key", "display_name", "domain", "account_reference"],
    context,
  );
  if (typeof value.key !== "string" || !MERCHANT_KEY_PATTERN.test(value.key)) {
    throw new GuardError(
      "MERCHANT_KEY_INVALID",
      `${context}.key must be a lowercase stable identifier.`,
    );
  }
  requireBoundedString(value.display_name, `${context}.display_name`, 120);
  if (typeof value.domain !== "string" || !DOMAIN_PATTERN.test(value.domain)) {
    throw new GuardError(
      "MERCHANT_DOMAIN_INVALID",
      `${context}.domain must be a lowercase registrable domain.`,
    );
  }
  requireBoundedString(
    value.account_reference,
    `${context}.account_reference`,
    128,
  );
  return {
    key: value.key,
    display_name: value.display_name,
    domain: value.domain,
    account_reference: value.account_reference,
  };
}

export function validateScalarAttributes(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GuardError(
      "ITEM_ATTRIBUTES_INVALID",
      `${context} must be an object of scalar attributes.`,
    );
  }
  const keys = Object.keys(value);
  if (keys.length > 20) {
    throw new GuardError(
      "ITEM_ATTRIBUTES_INVALID",
      `${context} may contain at most 20 scalar attributes.`,
    );
  }
  const result = {};
  for (const key of keys.sort()) {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(key)) {
      throw new GuardError(
        "ITEM_ATTRIBUTE_NAME_INVALID",
        `${context} contains an invalid attribute name.`,
      );
    }
    const item = value[key];
    const valid =
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isSafeInteger(item)) ||
      (typeof item === "string" && item.length > 0 && item.length <= 256);
    if (!valid) {
      throw new GuardError(
        "ITEM_ATTRIBUTE_VALUE_INVALID",
        `${context}.${key} must be a bounded string, safe integer, or boolean.`,
      );
    }
    result[key] = item;
  }
  return result;
}

export function validateCardPlanShape(plan) {
  assertExactKeys(
    plan,
    [
      "schema_version",
      "plan_id",
      "created_at",
      "source_intent_digest",
      "intent",
      "policy",
      "policy_digest",
      "status",
      "boundary",
    ],
    "card plan",
  );
  requireIsoTimestamp(plan.created_at, "card plan.created_at");
  requireDigest(plan.source_intent_digest, "card plan.source_intent_digest");
  requireDigest(plan.policy_digest, "card plan.policy_digest");
  if (plan.schema_version !== "protected-paybox.plan.card-purchase.v1") {
    throw new GuardError("CARD_PLAN_SCHEMA_INVALID", "Card plan schema is unsupported.");
  }
  if (plan.status !== "AWAITING_AUTHORIZATION") {
    throw new GuardError(
      "PLAN_STATUS_INVALID",
      "Card plan must remain AWAITING_AUTHORIZATION before evaluation.",
    );
  }
  return clone(plan);
}

export function requireCurrency(value, field) {
  if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
    throw new GuardError("CURRENCY_INVALID", `${field} must be an ISO 4217 code.`);
  }
}

export function requirePostal(value, field) {
  if (typeof value !== "string" || !POSTAL_PATTERN.test(value)) {
    throw new GuardError("POSTAL_CODE_INVALID", `${field} is invalid.`);
  }
}

export function requireBoundedString(value, field, maximum = 512) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new GuardError(
      "STRING_INVALID",
      `${field} must be a bounded printable string.`,
    );
  }
  return value;
}

function validateIntentItem(value, index) {
  const context = `card intent.items[${index}]`;
  assertExactKeys(
    value,
    [
      "item_id",
      "title",
      "quantity",
      "max_unit_price_minor",
      "required_attributes",
    ],
    context,
  );
  if (typeof value.item_id !== "string" || !ITEM_ID_PATTERN.test(value.item_id)) {
    throw new GuardError("CARD_ITEM_ID_INVALID", `${context}.item_id is invalid.`);
  }
  requireBoundedString(value.title, `${context}.title`, 200);
  if (!Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 99) {
    throw new GuardError(
      "CARD_ITEM_QUANTITY_INVALID",
      `${context}.quantity must be an integer between 1 and 99.`,
    );
  }
  requireUnsignedIntegerString(
    value.max_unit_price_minor,
    `${context}.max_unit_price_minor`,
  );
  return {
    item_id: value.item_id,
    title: value.title,
    quantity: value.quantity,
    max_unit_price_minor: value.max_unit_price_minor,
    required_attributes: validateScalarAttributes(
      value.required_attributes,
      `${context}.required_attributes`,
    ),
  };
}

function requireValue(actual, expected, field) {
  if (actual !== expected) {
    throw new GuardError(
      "CARD_PROFILE_UNSUPPORTED",
      `${field} must be ${JSON.stringify(expected)}.`,
    );
  }
}

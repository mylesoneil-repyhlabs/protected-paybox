import { assertExactKeys, clone, digest } from "../canonical.js";
import { SCHEMAS } from "../constants.js";
import { GuardError } from "../errors.js";
import { rejectSensitiveInput } from "../sensitive-input.js";
import {
  requireDigest,
  requireIsoTimestamp,
  requireUnsignedIntegerString,
} from "../validation.js";
import {
  requireBoundedString,
  requireCurrency,
  requirePostal,
  validateMerchant,
  validateScalarAttributes,
} from "./validation.js";

const TOP_LEVEL_KEYS = [
  "schema_version",
  "mode",
  "collected_at",
  "provenance",
  "provider_contract",
  "merchant",
  "checkout",
  "items",
  "pricing",
  "fulfillment",
  "payment_request",
  "risk",
];

export const PAYBOX_CARD_CONTRACT_PLACEHOLDER = Object.freeze({
  provider: "paybox",
  card_support_status: "PUBLIC_DOCUMENTATION_PHASE_2",
  tool_name: "unobserved.paybox.card.request_credential",
  authenticated_schema_observed: false,
  contract_digest: digest({
    note: "No authenticated PayBox card tool contract was available for v0.4.0.",
  }),
});

export function normalizeCardEvidence(input, plan, { now = new Date() } = {}) {
  rejectSensitiveInput(input, "card evidence");
  assertExactKeys(input, TOP_LEVEL_KEYS, "card evidence");
  if (input.schema_version !== SCHEMAS.CARD_EVIDENCE) {
    throw new GuardError(
      "CARD_EVIDENCE_SCHEMA_UNSUPPORTED",
      `card evidence schema must be ${SCHEMAS.CARD_EVIDENCE}.`,
    );
  }
  if (input.mode !== "simulated_fixture") {
    throw new GuardError(
      "LIVE_CARD_EVIDENCE_UNAVAILABLE",
      "This release accepts labeled simulated card fixtures only.",
    );
  }
  requireIsoTimestamp(input.collected_at, "card evidence.collected_at");
  validateProvenance(input.provenance);
  validateProviderContract(input.provider_contract);
  const merchant = validateEvidenceMerchant(input.merchant);
  const checkout = validateCheckout(input.checkout);
  const items = validateItems(input.items);
  validateExtractionBindings(items, plan.policy.basket.exact_items);
  const pricing = validatePricing(input.pricing);
  const fulfillment = validateFulfillment(input.fulfillment);
  const paymentRequest = validatePaymentRequest(input.payment_request);
  const risk = validateRisk(input.risk);
  validateArithmetic(items, pricing);

  const snapshotPayload = cardSnapshotPayload({
    merchant,
    items,
    pricing,
    fulfillment,
    payment_request: paymentRequest,
    risk,
  });
  if (digest(snapshotPayload) !== checkout.snapshot_sha256) {
    throw new GuardError(
      "CHECKOUT_SNAPSHOT_DIGEST_MISMATCH",
      "The checkout facts no longer match the bound snapshot digest.",
    );
  }

  const normalized = clone({
    ...input,
    merchant,
    checkout,
    items,
    pricing,
    fulfillment,
    payment_request: paymentRequest,
    risk,
  });
  normalized.subject_policy_digest = plan.policy_digest;
  normalized.freshness_issues = cardFreshnessIssues(normalized, now);
  normalized.review_issues = extractionReviewIssues(normalized.items);
  normalized.evidence_digest = digest({
    schema_version: normalized.schema_version,
    mode: normalized.mode,
    collected_at: normalized.collected_at,
    provenance: normalized.provenance,
    provider_contract: normalized.provider_contract,
    merchant: normalized.merchant,
    checkout: normalized.checkout,
    items: normalized.items,
    pricing: normalized.pricing,
    fulfillment: normalized.fulfillment,
    payment_request: normalized.payment_request,
    risk: normalized.risk,
  });
  return normalized;
}

export function cardSnapshotPayload({
  merchant,
  items,
  pricing,
  fulfillment,
  payment_request,
  risk,
}) {
  return {
    schema_version: SCHEMAS.CARD_CHECKOUT,
    merchant,
    items,
    pricing,
    fulfillment,
    payment_request,
    risk,
  };
}

function validateProvenance(value) {
  assertExactKeys(
    value,
    [
      "authenticity",
      "financial_authority",
      "paybox_contacted",
      "merchant_contacted",
      "network_contacted",
      "statement",
    ],
    "card evidence.provenance",
  );
  if (
    value.authenticity !== "SELF_REPORTED_FIXTURE" ||
    value.financial_authority !== "SELF_REPORTED_FIXTURE" ||
    value.paybox_contacted !== false ||
    value.merchant_contacted !== false ||
    value.network_contacted !== false
  ) {
    throw new GuardError(
      "CARD_PROVENANCE_INVALID",
      "Card fixtures must remain explicitly self-reported and offline.",
    );
  }
  requireBoundedString(value.statement, "card evidence.provenance.statement");
}

function validateProviderContract(value) {
  assertExactKeys(
    value,
    [
      "provider",
      "card_support_status",
      "tool_name",
      "authenticated_schema_observed",
      "contract_digest",
    ],
    "card evidence.provider_contract",
  );
  if (digest(value) !== digest(PAYBOX_CARD_CONTRACT_PLACEHOLDER)) {
    throw new GuardError(
      "PAYBOX_CARD_CONTRACT_UNVERIFIED",
      "The fixture must retain the exact unobserved PayBox Phase 2 contract placeholder.",
    );
  }
}

function validateEvidenceMerchant(value) {
  assertExactKeys(
    value,
    ["key", "display_name", "domain", "mcc", "country", "account_reference"],
    "card evidence.merchant",
  );
  const base = validateMerchant(
    {
      key: value.key,
      display_name: value.display_name,
      domain: value.domain,
      account_reference: value.account_reference,
    },
    "card evidence.merchant",
  );
  if (typeof value.mcc !== "string" || !/^\d{4}$/.test(value.mcc)) {
    throw new GuardError("MCC_INVALID", "card evidence merchant MCC must be four digits.");
  }
  if (typeof value.country !== "string" || !/^[A-Z]{2}$/.test(value.country)) {
    throw new GuardError(
      "COUNTRY_INVALID",
      "card evidence merchant country must be ISO alpha-2.",
    );
  }
  return { ...base, mcc: value.mcc, country: value.country };
}

function validateCheckout(value) {
  assertExactKeys(
    value,
    ["snapshot_id", "snapshot_sha256", "observed_at", "expires_at"],
    "card evidence.checkout",
  );
  requireBoundedString(value.snapshot_id, "card evidence.checkout.snapshot_id", 128);
  requireDigest(value.snapshot_sha256, "card evidence.checkout.snapshot_sha256");
  requireIsoTimestamp(value.observed_at, "card evidence.checkout.observed_at");
  requireIsoTimestamp(value.expires_at, "card evidence.checkout.expires_at");
  return { ...value };
}

function validateItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new GuardError(
      "CARD_ITEMS_INVALID",
      "Card evidence items must contain between 1 and 20 lines.",
    );
  }
  const seen = new Set();
  return value.map((item, index) => {
    const context = `card evidence.items[${index}]`;
    assertExactKeys(
      item,
      [
        "item_id",
        "title",
        "quantity",
        "unit_price_minor",
        "line_total_minor",
        "solution",
        "extraction",
      ],
      context,
    );
    requireBoundedString(item.item_id, `${context}.item_id`, 128);
    requireBoundedString(item.title, `${context}.title`, 200);
    if (seen.has(item.item_id)) {
      throw new GuardError("CARD_ITEM_DUPLICATE", "Card evidence item IDs must be unique.");
    }
    seen.add(item.item_id);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new GuardError(
        "CARD_ITEM_QUANTITY_INVALID",
        `${context}.quantity must be between 1 and 99.`,
      );
    }
    requireUnsignedIntegerString(item.unit_price_minor, `${context}.unit_price_minor`);
    requireUnsignedIntegerString(item.line_total_minor, `${context}.line_total_minor`);
    requireBoundedString(item.solution, `${context}.solution`, 2048);
    const extraction = validateExtraction(item.extraction, `${context}.extraction`);
    return { ...item, extraction };
  });
}

function validateExtraction(value, context) {
  assertExactKeys(
    value,
    [
      "interface",
      "request_digest",
      "response_digest",
      "authority",
      "confidence_bps",
      "missing_attributes",
      "warnings",
      "attributes",
    ],
    context,
  );
  if (value.interface !== "evidence-layer-ai:/extract-compatible") {
    throw new GuardError(
      "EXTRACTOR_INTERFACE_INVALID",
      `${context}.interface is unsupported.`,
    );
  }
  requireDigest(value.request_digest, `${context}.request_digest`);
  requireDigest(value.response_digest, `${context}.response_digest`);
  if (value.authority !== "SELF_REPORTED_FIXTURE") {
    throw new GuardError(
      "EXTRACTOR_AUTHORITY_INVALID",
      `${context}.authority must identify the fixture source.`,
    );
  }
  if (
    !Number.isInteger(value.confidence_bps) ||
    value.confidence_bps < 0 ||
    value.confidence_bps > 10_000
  ) {
    throw new GuardError(
      "EXTRACTOR_CONFIDENCE_INVALID",
      `${context}.confidence_bps must be between 0 and 10000.`,
    );
  }
  const missing = validateStringArray(value.missing_attributes, `${context}.missing_attributes`);
  const warnings = validateStringArray(value.warnings, `${context}.warnings`);
  const attributes = validateScalarAttributes(value.attributes, `${context}.attributes`);
  return { ...value, missing_attributes: missing, warnings, attributes };
}

function validateExtractionBindings(items, expectedItems) {
  const expectedById = new Map(expectedItems.map((item) => [item.item_id, item]));
  for (const item of items) {
    const expected = expectedById.get(item.item_id);
    const requestedValues =
      expected?.required_attributes ?? item.extraction.attributes;
    const requestedAttributes = Object.fromEntries(
      Object.entries(requestedValues).map(([name, value]) => [
        name,
        { type: evidenceLayerType(value) },
      ]),
    );
    const requestedNames = new Set(Object.keys(requestedAttributes));
    const suppliedNames = new Set([
      ...Object.keys(item.extraction.attributes),
      ...item.extraction.missing_attributes,
    ]);
    if (
      requestedNames.size !== suppliedNames.size ||
      [...requestedNames].some((name) => !suppliedNames.has(name))
    ) {
      throw new GuardError(
        "EXTRACTOR_ATTRIBUTE_SET_MISMATCH",
        "Extractor returned or omitted an attribute outside the bound request.",
      );
    }
    if (
      digest({ solution: item.solution, attributes: requestedAttributes }) !==
      item.extraction.request_digest
    ) {
      throw new GuardError(
        "EXTRACTOR_REQUEST_DIGEST_MISMATCH",
        "Extractor request digest does not bind the item solution and requested attributes.",
      );
    }
    if (digest(item.extraction.attributes) !== item.extraction.response_digest) {
      throw new GuardError(
        "EXTRACTOR_RESPONSE_DIGEST_MISMATCH",
        "Extractor response digest does not bind the returned attributes.",
      );
    }
  }
}

function evidenceLayerType(value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "integer";
  return "string";
}

function validatePricing(value) {
  const fields = [
    "subtotal_minor",
    "tax_minor",
    "delivery_fee_minor",
    "service_fee_minor",
    "other_fee_minor",
    "tip_minor",
    "discount_minor",
    "total_minor",
  ];
  assertExactKeys(value, ["currency", ...fields], "card evidence.pricing");
  requireCurrency(value.currency, "card evidence.pricing.currency");
  for (const field of fields) {
    requireUnsignedIntegerString(value[field], `card evidence.pricing.${field}`);
  }
  return { ...value };
}

function validateFulfillment(value) {
  assertExactKeys(
    value,
    ["type", "address_digest", "postal_code", "estimated_at"],
    "card evidence.fulfillment",
  );
  if (value.type !== "delivery") {
    throw new GuardError(
      "FULFILLMENT_UNSUPPORTED",
      "This release supports delivery card fixtures only.",
    );
  }
  requireDigest(value.address_digest, "card evidence.fulfillment.address_digest");
  requirePostal(value.postal_code, "card evidence.fulfillment.postal_code");
  requireIsoTimestamp(value.estimated_at, "card evidence.fulfillment.estimated_at");
  return { ...value, postal_code: value.postal_code.toUpperCase() };
}

function validatePaymentRequest(value) {
  assertExactKeys(
    value,
    [
      "credential_type",
      "merchant_scope",
      "amount_minor",
      "currency",
      "use_count",
      "expires_at",
      "recurring",
      "merchant_initiated",
      "card_on_file",
      "incremental_authorization",
      "partial_authorization",
    ],
    "card evidence.payment_request",
  );
  if (value.credential_type !== "one_time_virtual_card") {
    throw new GuardError(
      "CARD_CREDENTIAL_TYPE_UNSUPPORTED",
      "Only a simulated one-time virtual card request is modeled.",
    );
  }
  requireBoundedString(value.merchant_scope, "card evidence.payment_request.merchant_scope", 128);
  requireUnsignedIntegerString(value.amount_minor, "card evidence.payment_request.amount_minor");
  requireCurrency(value.currency, "card evidence.payment_request.currency");
  if (!Number.isInteger(value.use_count) || value.use_count < 1 || value.use_count > 100) {
    throw new GuardError(
      "CARD_USE_COUNT_INVALID",
      "Card credential use count must be an integer between 1 and 100.",
    );
  }
  requireIsoTimestamp(value.expires_at, "card evidence.payment_request.expires_at");
  for (const field of [
    "recurring",
    "merchant_initiated",
    "card_on_file",
    "incremental_authorization",
    "partial_authorization",
  ]) {
    if (typeof value[field] !== "boolean") {
      throw new GuardError("CARD_PAYMENT_FLAG_INVALID", `${field} must be boolean.`);
    }
  }
  return { ...value };
}

function validateRisk(value) {
  const fields = [
    "gift_card",
    "cash_equivalent",
    "alcohol",
    "age_restricted",
    "subscription",
  ];
  assertExactKeys(value, fields, "card evidence.risk");
  for (const field of fields) {
    if (typeof value[field] !== "boolean") {
      throw new GuardError("CARD_RISK_FLAG_INVALID", `risk.${field} must be boolean.`);
    }
  }
  return { ...value };
}

function validateArithmetic(items, pricing) {
  const lineSubtotal = items.reduce(
    (sum, item) => sum + BigInt(item.line_total_minor),
    0n,
  );
  for (const item of items) {
    if (
      BigInt(item.line_total_minor) !==
      BigInt(item.unit_price_minor) * BigInt(item.quantity)
    ) {
      throw new GuardError(
        "CARD_LINE_TOTAL_INCONSISTENT",
        "A line total does not equal unit price multiplied by quantity.",
      );
    }
  }
  if (lineSubtotal !== BigInt(pricing.subtotal_minor)) {
    throw new GuardError(
      "CARD_SUBTOTAL_INCONSISTENT",
      "Checkout subtotal does not equal the sum of line totals.",
    );
  }
  const computed =
    lineSubtotal +
    BigInt(pricing.tax_minor) +
    BigInt(pricing.delivery_fee_minor) +
    BigInt(pricing.service_fee_minor) +
    BigInt(pricing.other_fee_minor) +
    BigInt(pricing.tip_minor) -
    BigInt(pricing.discount_minor);
  if (computed < 0n || computed !== BigInt(pricing.total_minor)) {
    throw new GuardError(
      "CARD_TOTAL_INCONSISTENT",
      "Checkout total does not reconcile to subtotal, tax, fees, tip, and discounts.",
    );
  }
}

function cardFreshnessIssues(value, now) {
  const current = new Date(now).getTime();
  if (!Number.isFinite(current)) throw new Error("now must be valid");
  const issues = [];
  const observed = Date.parse(value.checkout.observed_at);
  if (current - observed > 60_000 || observed - current > 5_000) {
    issues.push({ code: "CARD_CHECKOUT_STALE" });
  }
  if (current >= Date.parse(value.checkout.expires_at)) {
    issues.push({ code: "CARD_CHECKOUT_EXPIRED" });
  }
  if (current >= Date.parse(value.payment_request.expires_at)) {
    issues.push({ code: "CARD_CREDENTIAL_REQUEST_EXPIRED" });
  }
  const collected = Date.parse(value.collected_at);
  if (current - collected > 60_000) {
    issues.push({ code: "CARD_EVIDENCE_STALE" });
  }
  if (collected - current > 5_000) {
    issues.push({ code: "CARD_EVIDENCE_FUTURE" });
  }
  return issues;
}

function extractionReviewIssues(items) {
  const issues = [];
  for (const item of items) {
    if (item.extraction.confidence_bps < 9_000) {
      issues.push({
        code: "ITEM_EVIDENCE_LOW_CONFIDENCE",
        reason: "A required item attribute has low-confidence extracted evidence.",
      });
    }
    if (item.extraction.missing_attributes.length > 0) {
      issues.push({
        code: "ITEM_EVIDENCE_INCOMPLETE",
        reason: "A required item attribute is missing from extracted evidence.",
      });
    }
    if (item.extraction.warnings.length > 0) {
      issues.push({
        code: "ITEM_EVIDENCE_WARNING",
        reason: "The generalized extractor reported an ambiguity or warning.",
      });
    }
  }
  return issues;
}

function validateStringArray(value, field) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new GuardError("STRING_ARRAY_INVALID", `${field} must be a bounded array.`);
  }
  return value.map((item, index) =>
    requireBoundedString(item, `${field}[${index}]`, 256),
  );
}

import { digest, isDigest } from "../canonical.js";
import { DECISIONS } from "../constants.js";
import { asGuardError } from "../errors.js";
import { normalizeCardEvidence } from "./evidence.js";
import { validateCardPlan } from "./policy.js";

export function evaluateCardProposal({
  plan,
  confirmationDigest,
  evidence,
  nonce,
  now = new Date(),
}) {
  validateCardPlan(plan);
  const base = {
    plan,
    confirmation: {
      supplied_digest: safeConfirmationDigest(confirmationDigest),
      supplied_was_valid_digest: isDigest(confirmationDigest),
      matched: confirmationDigest === plan.policy_digest,
    },
    nonce,
    normalizedEvidence: null,
    checks: [],
  };
  if (confirmationDigest !== plan.policy_digest) {
    return finish(
      base,
      DECISIONS.BLOCK,
      "POLICY_CONFIRMATION_MISMATCH",
      "The authorization does not match the displayed card mandate.",
      "Review and authorize the unchanged mandate again.",
    );
  }
  if (new Date(now).getTime() >= Date.parse(plan.policy.authorization.expires_at)) {
    return finish(
      base,
      DECISIONS.BLOCK,
      "MANDATE_EXPIRED",
      "The authorized card mandate has expired.",
      "Create and authorize a fresh mandate.",
    );
  }

  let normalized;
  try {
    normalized = normalizeCardEvidence(evidence, plan, { now });
  } catch (error) {
    const typed = asGuardError(error, "CARD_EVIDENCE_INVALID");
    return finish(
      base,
      DECISIONS.REVIEW,
      typed.code,
      safeCardEvidenceReason(typed.code),
      "Refresh a complete, internally consistent checkout evidence bundle.",
    );
  }
  const result = { ...base, normalizedEvidence: normalized };
  result.proposal = buildCardProposal(normalized);

  if (normalized.freshness_issues.length > 0) {
    return finish(
      result,
      DECISIONS.REVIEW,
      normalized.freshness_issues[0].code,
      "Fresh checkout and payment-request evidence was not available.",
      "Refresh the checkout and evaluate a newly scoped credential request.",
    );
  }
  if (normalized.review_issues.length > 0) {
    const review = normalized.review_issues[0];
    return finish(
      result,
      DECISIONS.REVIEW,
      review.code,
      review.reason,
      "Obtain complete, unambiguous product evidence and evaluate again.",
    );
  }

  const policy = plan.policy;
  const failures = [];
  const checked = [
    "merchant identity",
    "exact basket",
    "item attributes",
    "minor-unit arithmetic",
    "tax, fee, tip, and total caps",
    "delivery destination",
    "credential scope",
    "prohibited transaction flags",
    "checkout snapshot binding",
  ];

  checkEqual(
    normalized.merchant.key,
    policy.merchant.key,
    "CARD_MERCHANT_MISMATCH",
    "The checkout merchant differs from the authorized merchant.",
    failures,
  );
  checkEqual(
    normalized.merchant.domain,
    policy.merchant.domain,
    "CARD_MERCHANT_DOMAIN_MISMATCH",
    "The checkout domain differs from the authorized merchant domain.",
    failures,
  );
  checkEqual(
    normalized.merchant.account_reference,
    policy.merchant.account_reference,
    "CARD_MERCHANT_REFERENCE_MISMATCH",
    "The checkout storefront or merchant account differs from the mandate.",
    failures,
  );
  checkEqual(
    normalized.pricing.currency,
    policy.money.currency,
    "CARD_CURRENCY_MISMATCH",
    "The checkout currency differs from the authorized currency.",
    failures,
  );
  checkMaximum(
    normalized.pricing.total_minor,
    policy.money.max_total_minor,
    "CARD_TOTAL_EXCEEDED",
    "The all-in checkout total exceeds the authorized cap.",
    failures,
  );
  checkMaximum(
    normalized.pricing.tax_minor,
    policy.money.max_tax_minor,
    "CARD_TAX_EXCEEDED",
    "Checkout tax exceeds the authorized cap.",
    failures,
  );
  checkMaximum(
    normalized.pricing.tip_minor,
    policy.money.max_tip_minor,
    "CARD_TIP_EXCEEDED",
    "The checkout tip exceeds the authorized cap.",
    failures,
  );
  checkMaximum(
    normalized.pricing.delivery_fee_minor,
    policy.money.max_delivery_fee_minor,
    "CARD_DELIVERY_FEE_EXCEEDED",
    "The delivery fee exceeds the authorized cap.",
    failures,
  );
  checkMaximum(
    normalized.pricing.service_fee_minor,
    policy.money.max_service_fee_minor,
    "CARD_SERVICE_FEE_EXCEEDED",
    "The service fee exceeds the authorized cap.",
    failures,
  );
  checkEqual(
    normalized.fulfillment.address_digest,
    policy.fulfillment.address_digest,
    "CARD_DELIVERY_ADDRESS_MISMATCH",
    "The delivery address differs from the private authorized destination.",
    failures,
  );
  checkEqual(
    normalized.fulfillment.postal_code,
    policy.fulfillment.postal_code,
    "CARD_DELIVERY_POSTAL_MISMATCH",
    "The delivery postal code differs from the mandate.",
    failures,
  );

  inspectBasket(normalized.items, policy.basket.exact_items, failures);
  inspectPaymentRequest(normalized, policy, failures);
  inspectRisk(normalized.risk, policy.prohibitions, failures);

  result.checks = checked;
  if (failures.length > 0) {
    result.violations = failures;
    return finish(
      result,
      DECISIONS.BLOCK,
      failures[0].code,
      failures[0].reason,
      "Change the checkout or authorize a new mandate. This request is not eligible for credential release.",
    );
  }
  return finish(
    result,
    DECISIONS.PASS,
    "SIMULATED_CARD_PURCHASE_PASS",
    "Every displayed card-purchase constraint passed for this exact local fixture.",
    null,
  );
}

function buildCardProposal(evidence) {
  return {
    kind: "simulated_paybox_card_credential_request",
    checkout_snapshot_sha256: evidence.checkout.snapshot_sha256,
    evidence_digest: evidence.evidence_digest,
    merchant: {
      key: evidence.merchant.key,
      domain: evidence.merchant.domain,
      account_reference: evidence.merchant.account_reference,
    },
    payment: { ...evidence.payment_request },
  };
}

function inspectBasket(actualItems, expectedItems, failures) {
  if (actualItems.length !== expectedItems.length) {
    failures.push({
      code: "CARD_BASKET_SIZE_MISMATCH",
      reason: "The checkout contains missing or additional line items.",
    });
  }
  const actualById = new Map(actualItems.map((item) => [item.item_id, item]));
  for (const expected of expectedItems) {
    const actual = actualById.get(expected.item_id);
    if (!actual) {
      failures.push({
        code: "CARD_REQUIRED_ITEM_MISSING",
        reason: `Required item ${expected.title} is missing from the checkout.`,
      });
      continue;
    }
    checkEqual(
      actual.title,
      expected.title,
      "CARD_ITEM_TITLE_MISMATCH",
      `The title for ${expected.title} differs from the mandate.`,
      failures,
    );
    checkEqual(
      actual.quantity,
      expected.quantity,
      "CARD_ITEM_QUANTITY_MISMATCH",
      `The quantity for ${expected.title} differs from the mandate.`,
      failures,
    );
    checkMaximum(
      actual.unit_price_minor,
      expected.max_unit_price_minor,
      "CARD_ITEM_PRICE_EXCEEDED",
      `The unit price for ${expected.title} exceeds its authorized cap.`,
      failures,
    );
    for (const [attribute, expectedValue] of Object.entries(
      expected.required_attributes,
    )) {
      if (!(attribute in actual.extraction.attributes)) {
        failures.push({
          code: "CARD_ITEM_ATTRIBUTE_MISSING",
          reason: `Required attribute ${attribute} is unavailable for ${expected.title}.`,
        });
        continue;
      }
      checkEqual(
        actual.extraction.attributes[attribute],
        expectedValue,
        "CARD_ITEM_ATTRIBUTE_MISMATCH",
        `Attribute ${attribute} for ${expected.title} violates the mandate.`,
        failures,
      );
    }
  }
  const expectedIds = new Set(expectedItems.map((item) => item.item_id));
  if (actualItems.some((item) => !expectedIds.has(item.item_id))) {
    failures.push({
      code: "CARD_ADDITIONAL_ITEM_PROHIBITED",
      reason: "The checkout contains an item that was not authorized.",
    });
  }
}

function inspectPaymentRequest(evidence, policy, failures) {
  const request = evidence.payment_request;
  checkEqual(
    request.credential_type,
    policy.payment.credential_type,
    "CARD_CREDENTIAL_TYPE_MISMATCH",
    "The requested credential type differs from the mandate.",
    failures,
  );
  checkEqual(
    request.merchant_scope,
    policy.merchant.account_reference,
    "CARD_CREDENTIAL_MERCHANT_SCOPE_MISMATCH",
    "The credential request is not bound to the authorized merchant.",
    failures,
  );
  const maximumExpiry = Math.min(
    Date.parse(policy.authorization.expires_at),
    Date.parse(evidence.checkout.expires_at),
  );
  if (Date.parse(request.expires_at) > maximumExpiry) {
    failures.push({
      code: "CARD_CREDENTIAL_EXPIRY_EXCEEDED",
      reason:
        "The requested credential remains valid beyond the checkout or mandate expiry.",
    });
  }
  checkEqual(
    request.amount_minor,
    evidence.pricing.total_minor,
    "CARD_CREDENTIAL_AMOUNT_MISMATCH",
    "The credential amount is not bound to the exact checkout total.",
    failures,
  );
  checkEqual(
    request.currency,
    policy.money.currency,
    "CARD_CREDENTIAL_CURRENCY_MISMATCH",
    "The credential currency differs from the mandate.",
    failures,
  );
  checkEqual(
    request.use_count,
    policy.payment.use_count,
    "CARD_CREDENTIAL_USE_COUNT_MISMATCH",
    "The credential request permits more than one use.",
    failures,
  );
  for (const [field, allowed] of [
    ["recurring", policy.payment.recurring_allowed],
    ["merchant_initiated", policy.payment.merchant_initiated_allowed],
    ["card_on_file", policy.payment.card_on_file_allowed],
    ["incremental_authorization", policy.payment.incremental_authorization_allowed],
    ["partial_authorization", policy.payment.partial_authorization_allowed],
  ]) {
    if (request[field] === true && allowed !== true) {
      failures.push({
        code: `CARD_${field.toUpperCase()}_PROHIBITED`,
        reason: `The payment request enables prohibited ${field.replaceAll("_", " ")}.`,
      });
    }
  }
}

function inspectRisk(risk, prohibitions, failures) {
  for (const [field, policyField] of [
    ["gift_card", "gift_cards"],
    ["cash_equivalent", "cash_equivalents"],
    ["alcohol", "alcohol"],
    ["age_restricted", "age_restricted_items"],
    ["subscription", "subscriptions"],
  ]) {
    if (risk[field] === true && prohibitions[policyField] === true) {
      failures.push({
        code: `CARD_${field.toUpperCase()}_PROHIBITED`,
        reason: `The checkout contains prohibited ${field.replaceAll("_", " ")} content.`,
      });
    }
  }
}

function finish(base, outcome, code, reason, recovery) {
  return { ...base, decision: { outcome, code, reason, recovery } };
}

function checkEqual(actual, expected, code, reason, failures) {
  if (actual !== expected) failures.push({ code, reason });
}

function checkMaximum(actual, maximum, code, reason, failures) {
  if (BigInt(actual) > BigInt(maximum)) failures.push({ code, reason });
}

function safeConfirmationDigest(value) {
  return isDigest(value)
    ? value
    : digest({
        supplied_confirmation_fingerprint:
          typeof value === "string" ? value : "missing-confirmation",
      });
}

function safeCardEvidenceReason(code) {
  const reasons = {
    CHECKOUT_SNAPSHOT_DIGEST_MISMATCH:
      "The checkout facts do not match their bound snapshot digest.",
    CARD_LINE_TOTAL_INCONSISTENT:
      "A checkout line has internally inconsistent quantity and price facts.",
    CARD_SUBTOTAL_INCONSISTENT:
      "The checkout subtotal does not equal its line items.",
    CARD_TOTAL_INCONSISTENT:
      "The checkout total does not reconcile to subtotal, tax, fees, tip, and discounts.",
    UNKNOWN_FIELD:
      "The card evidence contains a field outside the closed schema.",
    LIVE_CARD_EVIDENCE_UNAVAILABLE:
      "Live card evidence is not enabled in this release.",
  };
  return reasons[code] ?? "The card evidence bundle could not be verified completely.";
}

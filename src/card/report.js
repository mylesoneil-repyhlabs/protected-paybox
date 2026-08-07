import { verifyRecord } from "../receipt.js";

export function formatCardDecision(record, { details = false } = {}) {
  const policy = record.plan.policy;
  const evidence = record.evidence;
  const decision = record.decision;
  const items = policy.basket.exact_items
    .map((item) => `${item.quantity} × ${item.title}`)
    .join("; ");
  const lines = [
    "PROTECTED PAYBOX · CARD PARTNER-EVALUATION FIXTURE",
    `LOCAL FIXTURE ONLY · NO PAYBOX OR ${policy.merchant.display_name.toUpperCase()} CONTACT · NO CARD CREATED OR AUTHORIZED · NO ORDER PLACED · NO MONEY MOVED`,
    "",
    "Mandate",
    `${policy.merchant.display_name} (${policy.merchant.domain}): ${items}.`,
    `All-in cap: ${formatMinor(policy.money.max_total_minor, policy.money.currency)}; one use; exact private delivery destination.`,
    authorizationStatement(record.authorization_mode),
    "",
    "Simulated checkout fixture",
  ];
  if (evidence) {
    lines.push(
      `${evidence.merchant.display_name}; ${formatMinor(evidence.pricing.total_minor, evidence.pricing.currency)}; snapshot ${evidence.checkout.snapshot_id}.`,
      `Simulated credential envelope: ${evidence.payment_request.merchant_scope}; ${formatMinor(evidence.payment_request.amount_minor, evidence.payment_request.currency)}; use count ${evidence.payment_request.use_count}.`,
    );
  } else {
    lines.push("No checkout proposal was evaluated.");
  }
  lines.push("", `SIMULATED ${decision.outcome} — ${decisionDisplay(record)}`);
  lines.push(
    decision.outcome === "PASS"
      ? "This fixture result is not permission to pay."
      : "Nothing can proceed from this result.",
  );
  const reviewDetail = evidenceReviewDetail(record);
  if (reviewDetail) lines.push(reviewDetail);
  if (record.violations?.length > 1) {
    lines.push(
      "All violated constraints:",
      ...record.violations.map((violation) => `- ${violation.reason}`),
    );
  }
  if (decision.recovery) lines.push(`Recovery: ${decision.recovery}`);
  if (evidence) {
    lines.push(
      record.checks.length > 0
        ? `Checked: ${record.checks.join(", ")} at ${evidence.collected_at}.`
        : `Evidence reviewed at ${evidence.collected_at}; no policy check was treated as complete.`,
    );
  }
  lines.push(
    `Boundary: ${record.boundary.statement}`,
    "PayBox card status: public Help Center documentation says card support is Phase 2; no authenticated card tool schema was observed.",
    `Receipt: ${verifyRecord(record).verified ? "local checksum self-consistent; not signed" : "checksum verification failed"}.`,
  );
  if (details) {
    lines.push(
      "",
      "Technical details",
      `Policy digest: ${record.plan.policy_digest}`,
      `Checkout snapshot: ${record.proposal?.checkout_snapshot_sha256 ?? "unavailable"}`,
      `Evidence digest: ${record.evidence?.evidence_digest ?? "unavailable"}`,
      `Receipt digest: ${record.receipt.receipt_digest}`,
      `Record digest: ${record.record_digest}`,
    );
  }
  return lines.join("\n");
}

function authorizationStatement(mode) {
  return mode === "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION"
    ? "Authorization model: fixture auto-bound to its own digest; no user authorization occurred."
    : "Confirmation model: caller supplied a matching digest; chat authorship was not authenticated.";
}

function decisionDisplay(record) {
  if (
    record.decision.code === "CARD_TOTAL_EXCEEDED" &&
    record.evidence?.pricing?.total_minor
  ) {
    const overage = (
      BigInt(record.evidence.pricing.total_minor) -
      BigInt(record.plan.policy.money.max_total_minor)
    ).toString();
    return `${formatMinor(overage, record.plan.policy.money.currency)} over the authorized total cap.`;
  }
  return record.decision.reason;
}

function evidenceReviewDetail(record) {
  if (record.decision.code !== "ITEM_EVIDENCE_INCOMPLETE") return null;
  for (const item of record.evidence?.items ?? []) {
    const missing = item.extraction?.missing_attributes?.[0];
    if (!missing) continue;
    const required = record.plan.policy.basket.exact_items.find(
      (candidate) => candidate.item_id === item.item_id,
    )?.required_attributes?.[missing];
    return `Missing evidence: ${item.title} has no verified ${missing}${required === undefined ? "" : `; required value is ${JSON.stringify(required)}`}.`;
  }
  return null;
}

function formatMinor(value, currency) {
  if (currency !== "USD") return `${currency} ${value} minor units`;
  const amount = BigInt(value);
  const whole = amount / 100n;
  const cents = (amount % 100n).toString().padStart(2, "0");
  return `$${whole}.${cents} USD`;
}

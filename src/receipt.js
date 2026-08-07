import { randomUUID } from "node:crypto";
import { digest, isDigest } from "./canonical.js";
import { PUBLIC_BOUNDARY, SCHEMAS } from "./constants.js";
import { sanitize } from "./sanitize.js";

export function createRecord(evaluation, { now = new Date() } = {}) {
  const evidence = evaluation.normalizedEvidence;
  const requestBindingDigest =
    evaluation.requestBindingDigest ??
    digest({
      policy_digest: evaluation.plan.policy_digest,
      confirmation_digest: evaluation.confirmation.supplied_digest,
      evidence_digest: evidence?.evidence_digest ?? digest("no-evidence"),
    });
  const base = sanitize({
    schema_version: SCHEMAS.RECORD,
    generated_at: new Date(now).toISOString(),
    mode: evidence?.mode ?? "early_stop",
    authorization_mode: evaluation.authorizationMode ?? "UNSPECIFIED",
    plan: {
      plan_id: evaluation.plan.plan_id,
      source_intent_digest: evaluation.plan.source_intent_digest,
      policy: evaluation.plan.policy,
      policy_digest: evaluation.plan.policy_digest,
    },
    confirmation: evaluation.confirmation,
    request_binding_digest: requestBindingDigest,
    proposal: evaluation.proposal ?? (evidence
      ? {
          tool_contract: evidence.tool_contract,
          message: evidence.message,
          authorized_minimum_receive_atomic:
            evaluation.authorized_minimum_receive_atomic ?? null,
        }
      : null),
    evidence,
    checks: evaluation.checks,
    violations: evaluation.violations ?? [],
    decision: evaluation.decision,
    nonce_digest: digest(evaluation.nonce ?? "missing-nonce"),
    boundary: { ...PUBLIC_BOUNDARY },
    execution: {
      status:
        evaluation.decision.outcome === "PASS"
          ? "SIMULATION_ELIGIBLE_ONLY"
          : "NOT_ELIGIBLE",
      signature_requested: false,
      transaction_broadcast: false,
      funds_moved: false,
    },
  });
  const bindings = deriveBindings(base);
  const receipt = {
    schema_version: SCHEMAS.RECEIPT,
    receipt_id: randomUUID(),
    issued_at: new Date(now).toISOString(),
    verifier: {
      name: "Protected PayBox local checksum verifier",
      algorithm: "SHA-256 over canonical JSON",
      production_delta_proof: false,
    },
    bindings,
    receipt_digest: digest({
      schema_version: SCHEMAS.RECEIPT,
      issued_at: new Date(now).toISOString(),
      bindings,
    }),
  };
  const recordWithoutDigest = { ...base, receipt };
  return {
    ...recordWithoutDigest,
    record_digest: digest(recordWithoutDigest),
  };
}

export function verifyRecord(record) {
  if (!record || typeof record !== "object") {
    return { verified: false, reason: "Record is not an object." };
  }
  const { record_digest: suppliedRecordDigest, ...withoutRecordDigest } =
    record;
  if (!isDigest(suppliedRecordDigest)) {
    return { verified: false, reason: "Record digest is missing or invalid." };
  }
  if (digest(withoutRecordDigest) !== suppliedRecordDigest) {
    return { verified: false, reason: "Record content no longer matches its digest." };
  }
  if (digest(record.plan?.policy) !== record.plan?.policy_digest) {
    return {
      verified: false,
      reason: "The recorded policy does not match its claimed digest.",
    };
  }
  if (record.receipt?.schema_version !== SCHEMAS.RECEIPT) {
    return { verified: false, reason: "Receipt schema is unsupported." };
  }
  const {
    schema_version,
    receipt_id: _receiptId,
    issued_at,
    verifier: _verifier,
    bindings,
    receipt_digest: suppliedReceiptDigest,
  } = record.receipt;
  const expectedReceiptDigest = digest({
    schema_version,
    issued_at,
    bindings,
  });
  if (expectedReceiptDigest !== suppliedReceiptDigest) {
    return { verified: false, reason: "Receipt digest is invalid." };
  }
  const base = {
    ...record,
  };
  delete base.receipt;
  delete base.record_digest;
  const expectedBindings = deriveBindings(base);
  if (digest(expectedBindings) !== digest(bindings)) {
    return {
      verified: false,
      reason: "Receipt bindings no longer match the underlying content.",
    };
  }
  return {
    verified: true,
    outcome: record.decision.outcome,
    receipt_digest: suppliedReceiptDigest,
    statement:
      "Local checksum is self-consistent. It is unkeyed and is not a production Delta signature or PayBox execution receipt.",
  };
}

function deriveBindings(base) {
  return {
    policy_digest: digest(base.plan.policy),
    authorization_digest: digest({
      source_intent_digest: base.plan.source_intent_digest,
      policy_digest: base.plan.policy_digest,
      confirmation: base.confirmation,
      authorization_mode: base.authorization_mode,
    }),
    request_binding_digest: base.request_binding_digest,
    proposal_digest: digest(base.proposal),
    evidence_digest: digest(base.evidence),
    message_sha256: base.proposal?.message?.message_sha256 ?? digest("no-message"),
    checkout_snapshot_sha256:
      base.proposal?.checkout_snapshot_sha256 ?? digest("no-checkout-snapshot"),
    tool_schema_digest:
      base.proposal?.tool_contract?.schema_digest ?? digest("no-tool-schema"),
    decision_digest: digest(base.decision),
    nonce_digest: base.nonce_digest,
    boundary_digest: digest(base.boundary),
    record_payload_digest: digest(base),
  };
}

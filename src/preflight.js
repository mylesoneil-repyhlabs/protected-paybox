import path from "node:path";
import { digest, isDigest } from "./canonical.js";
import { evaluateProposal } from "./evaluator.js";
import { GuardError } from "./errors.js";
import { createRecord, verifyRecord } from "./receipt.js";
import {
  assertPrivateRegularFile,
  ensurePrivateDirectory,
  fileExists,
  readJsonFile,
  writePrivateJsonOnce,
} from "./io.js";

const inflight = new Map();
const NONCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;
const AUTHORIZATION_MODES = new Set([
  "CALLER_SUPPLIED_DIGEST_UNAUTHENTICATED",
  "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION",
]);

export async function runPreflight({
  plan,
  confirmationDigest,
  evidence,
  nonce,
  now = new Date(),
  historyDirectory = null,
  evaluator = evaluateProposal,
  authorizationMode = "CALLER_SUPPLIED_DIGEST_UNAUTHENTICATED",
}) {
  if (!AUTHORIZATION_MODES.has(authorizationMode)) {
    throw new GuardError(
      "AUTHORIZATION_MODE_INVALID",
      "The preflight authorization mode is unsupported.",
    );
  }
  if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) {
    const evaluation = earlyDecision({
      plan,
      confirmationDigest,
      nonce: "invalid-nonce",
      outcome: "BLOCK",
      code: "NONCE_INVALID",
      reason:
        "The one-use nonce must be 16–128 safe characters and was rejected before evaluation.",
      recovery: "Create a fresh nonce and run a new simulation.",
      authorizationMode,
    });
    return {
      record: createRecord(evaluation, { now }),
      replayed: false,
    };
  }

  const nonceDigest = digest(nonce);
  const previous = inflight.get(nonceDigest) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const current = previous.then(async () => {
    try {
      return await runSerialized({
        plan,
        confirmationDigest,
        evidence,
        nonce,
        now,
        historyDirectory,
        evaluator,
        authorizationMode,
      });
    } finally {
      release();
    }
  });
  inflight.set(nonceDigest, gate);
  try {
    return await current;
  } finally {
    if (inflight.get(nonceDigest) === gate) inflight.delete(nonceDigest);
  }
}

async function runSerialized(input) {
  const {
    plan,
    confirmationDigest,
    evidence,
    nonce,
    now,
    historyDirectory,
    evaluator,
    authorizationMode,
  } = input;

  // Authorization is deliberately checked before replay storage.
  if (confirmationDigest !== plan.policy_digest) {
    const evaluation = evaluator(input);
    evaluation.authorizationMode = authorizationMode;
    return {
      record: createRecord(evaluation, { now }),
      replayed: false,
    };
  }

  // Re-evaluate before consulting history so an expired mandate or evidence
  // that has become stale can never inherit a historical PASS.
  const evaluation = evaluator(input);
  evaluation.authorizationMode = authorizationMode;
  if (evaluation.decision.code === "MANDATE_EXPIRED") {
    return { record: createRecord(evaluation, { now }), replayed: false };
  }

  let semanticDigest;
  try {
    semanticDigest = digest({
      policy_digest: plan.policy_digest,
      confirmation_digest: confirmationDigest,
      evidence_digest: digest(evidence),
    });
  } catch {
    return { record: createRecord(evaluation, { now }), replayed: false };
  }
  evaluation.requestBindingDigest = semanticDigest;
  let record = createRecord(evaluation, { now });
  let replayed = false;

  if (historyDirectory) {
    await ensurePrivateDirectory(historyDirectory);
    const storedPath = storagePath(historyDirectory, nonce);
    if (await fileExists(storedPath)) {
      const stored = await readStoredNonceRecord(storedPath);
      return resolveStoredRecord({
        stored,
        semanticDigest,
        currentRecord: record,
        historyDirectory,
        plan,
        confirmationDigest,
        nonce,
        now,
        authorizationMode,
      });
    }

    if (record.decision.outcome === "PASS") {
      const planUse = await claimPlanUse({
        historyDirectory,
        plan,
        confirmationDigest,
        nonce,
        semanticDigest,
        record,
        now,
        authorizationMode,
      });
      if (planUse.record.decision.outcome !== "PASS") return planUse;
      record = planUse.record;
      replayed = planUse.replayed;
    }

    const created = await writePrivateJsonOnce(storedPath, {
      semantic_digest: semanticDigest,
      record,
    });
    if (!created) {
      const stored = await readStoredNonceRecord(storedPath);
      return resolveStoredRecord({
        stored,
        semanticDigest,
        currentRecord: record,
        historyDirectory,
        plan,
        confirmationDigest,
        nonce,
        now,
        authorizationMode,
      });
    }
  }
  return { record, replayed };
}

async function claimPlanUse({
  historyDirectory,
  plan,
  confirmationDigest,
  nonce,
  semanticDigest,
  record,
  now,
  authorizationMode,
}) {
  const usePath = planUsePath(historyDirectory, plan.policy_digest);
  const claim = {
    policy_digest: plan.policy_digest,
    nonce_digest: digest(nonce),
    request_binding_digest: semanticDigest,
    pass_record: record,
  };
  if (await writePrivateJsonOnce(usePath, claim)) {
    return { record, replayed: false };
  }

  await assertPrivateRegularFile(usePath);
  const stored = await readJsonFile(usePath, "stored plan-use claim");
  const keys =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? Object.keys(stored).sort()
      : [];
  if (
    keys.join(",") !==
      "nonce_digest,pass_record,policy_digest,request_binding_digest" ||
    stored.policy_digest !== plan.policy_digest ||
    ![stored.nonce_digest, stored.request_binding_digest]
      .every((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) ||
    stored.pass_record?.decision?.outcome !== "PASS" ||
    stored.pass_record?.plan?.policy_digest !== stored.policy_digest ||
    stored.pass_record?.nonce_digest !== stored.nonce_digest ||
    stored.pass_record?.request_binding_digest !== stored.request_binding_digest ||
    verifyRecord(stored.pass_record).verified !== true
  ) {
    throw new GuardError(
      "PLAN_USE_RECORD_INVALID",
      "Stored one-use plan state failed its structure check.",
    );
  }
  if (
    stored.nonce_digest === claim.nonce_digest &&
    stored.request_binding_digest === claim.request_binding_digest
  ) {
    return { record: stored.pass_record, replayed: true };
  }
  const evaluation = earlyDecision({
    plan,
    confirmationDigest,
    nonce,
    outcome: "BLOCK",
    code: "PLAN_ALREADY_USED",
    reason:
      "This one-use mandate already produced a PASS for another proposal attempt.",
    recovery: "Create and separately authorize a new mandate.",
    authorizationMode,
  });
  return {
    record: createRecord(evaluation, { now }),
    replayed: false,
  };
}

async function readStoredNonceRecord(storedPath) {
  await assertPrivateRegularFile(storedPath);
  const stored = await readJsonFile(storedPath, "stored nonce record");
  const keys =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? Object.keys(stored).sort()
      : [];
  if (
    keys.length !== 2 ||
    keys[0] !== "record" ||
    keys[1] !== "semantic_digest" ||
    typeof stored.semantic_digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(stored.semantic_digest) ||
    stored.record?.request_binding_digest !== stored.semantic_digest ||
    verifyRecord(stored.record).verified !== true
  ) {
    throw new GuardError(
      "HISTORY_RECORD_INVALID",
      "Stored nonce history failed its structure or integrity check.",
    );
  }
  return stored;
}

async function resolveStoredRecord({
  stored,
  semanticDigest,
  currentRecord,
  historyDirectory,
  plan,
  confirmationDigest,
  nonce,
  now,
  authorizationMode,
}) {
  if (stored.semantic_digest !== semanticDigest) {
    const evaluation = earlyDecision({
      plan,
      confirmationDigest,
      nonce,
      outcome: "BLOCK",
      code: "NONCE_REUSE_MISMATCH",
      reason:
        "This one-use nonce is already bound to different proposal semantics.",
      recovery: "Create a new nonce. The stored proposal cannot be replaced.",
      authorizationMode,
    });
    return {
      record: createRecord(evaluation, { now }),
      replayed: false,
    };
  }
  if (
    stored.record?.decision?.outcome !== currentRecord.decision.outcome ||
    stored.record?.decision?.code !== currentRecord.decision.code
  ) {
    if (
      stored.record?.decision?.outcome === "REVIEW" &&
      currentRecord.decision.outcome === "PASS"
    ) {
      return claimPlanUse({
        historyDirectory,
        plan,
        confirmationDigest,
        nonce,
        semanticDigest,
        record: currentRecord,
        now,
        authorizationMode,
      });
    }
    if (
      stored.record?.decision?.outcome === "PASS" &&
      currentRecord.decision.outcome === "PASS"
    ) {
      return { record: stored.record, replayed: true };
    }
    return { record: currentRecord, replayed: false };
  }
  return { record: stored.record, replayed: true };
}

function storagePath(directory, nonce) {
  return path.join(directory, `${digest(nonce)}.json`);
}

function planUsePath(directory, policyDigest) {
  return path.join(directory, `plan-use-${digest(policyDigest)}.json`);
}

function earlyDecision({
  plan,
  confirmationDigest,
  nonce,
  outcome,
  code,
  reason,
  recovery,
  authorizationMode = "UNSPECIFIED",
}) {
  return {
    plan,
    confirmation: {
      supplied_digest: isDigest(confirmationDigest)
        ? confirmationDigest
        : digest({
            supplied_confirmation_fingerprint:
              typeof confirmationDigest === "string"
                ? confirmationDigest
                : "missing-confirmation",
          }),
      supplied_was_valid_digest: isDigest(confirmationDigest),
      matched: confirmationDigest === plan.policy_digest,
    },
    nonce,
    normalizedEvidence: null,
    checks: [],
    violations: [],
    authorizationMode,
    decision: { outcome, code, reason, recovery },
  };
}

export function assertExecutionLocked() {
  throw new GuardError(
    "PUBLIC_EXECUTION_LOCKED",
    "Protected PayBox cannot request a signature, broadcast a transaction, or move funds.",
  );
}

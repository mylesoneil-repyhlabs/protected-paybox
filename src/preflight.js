import path from "node:path";
import { digest } from "./canonical.js";
import { evaluateProposal } from "./evaluator.js";
import { GuardError } from "./errors.js";
import { createRecord } from "./receipt.js";
import {
  ensurePrivateDirectory,
  fileExists,
  readJsonFile,
  writePrivateJson,
} from "./io.js";

const inflight = new Map();
const NONCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;

export async function runPreflight({
  plan,
  confirmationDigest,
  evidence,
  nonce,
  now = new Date(),
  historyDirectory = null,
}) {
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
  } = input;

  // Authorization is deliberately checked before replay storage.
  if (confirmationDigest !== plan.policy_digest) {
    const evaluation = evaluateProposal(input);
    return {
      record: createRecord(evaluation, { now }),
      replayed: false,
    };
  }

  const semanticDigest = digest({
    policy_digest: plan.policy_digest,
    confirmation_digest: confirmationDigest,
    evidence_message_digest: evidence?.message?.message_sha256 ?? null,
    wallet_account: evidence?.wallet?.account ?? null,
    chain_id: evidence?.chain?.chain_id ?? null,
  });

  if (historyDirectory) {
    await ensurePrivateDirectory(historyDirectory);
    const storedPath = storagePath(historyDirectory, nonce);
    if (await fileExists(storedPath)) {
      const stored = await readJsonFile(storedPath, "stored nonce record");
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
        });
        return {
          record: createRecord(evaluation, { now }),
          replayed: false,
        };
      }
      return { record: stored.record, replayed: true };
    }
  }

  const evaluation = evaluateProposal(input);
  const record = createRecord(evaluation, { now });
  if (historyDirectory) {
    await writePrivateJson(storagePath(historyDirectory, nonce), {
      semantic_digest: semanticDigest,
      record,
    });
  }
  return { record, replayed: false };
}

function storagePath(directory, nonce) {
  return path.join(directory, `${digest(nonce)}.json`);
}

function earlyDecision({
  plan,
  confirmationDigest,
  nonce,
  outcome,
  code,
  reason,
  recovery,
}) {
  return {
    plan,
    confirmation: {
      supplied_digest:
        typeof confirmationDigest === "string"
          ? confirmationDigest
          : digest("missing-confirmation"),
      matched: confirmationDigest === plan.policy_digest,
    },
    nonce,
    normalizedEvidence: null,
    checks: [],
    decision: { outcome, code, reason, recovery },
  };
}

export function assertExecutionLocked() {
  throw new GuardError(
    "PUBLIC_EXECUTION_LOCKED",
    "Protected PayBox cannot request a signature, broadcast a transaction, or move funds.",
  );
}

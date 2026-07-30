import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDemoEvidence, buildDemoIntent } from "../src/fixtures.js";
import { createPlan } from "../src/policy.js";
import { assertExecutionLocked, runPreflight } from "../src/preflight.js";

const NOW = new Date("2026-07-30T12:00:00Z");

async function temporaryHistory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "protected-paybox-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("exact nonce replay returns one stored record", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-replay" });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const input = {
    plan,
    confirmationDigest: plan.policy_digest,
    evidence,
    nonce: "replay-nonce-00001",
    now: NOW,
    historyDirectory,
  };
  const first = await runPreflight(input);
  const second = await runPreflight(input);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.record.record_digest, first.record.record_digest);
});

test("nonce reuse with changed semantics blocks", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-mismatch" });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const common = {
    plan,
    confirmationDigest: plan.policy_digest,
    nonce: "mismatch-nonce-001",
    now: NOW,
    historyDirectory,
  };
  await runPreflight({ ...common, evidence });
  const changed = structuredClone(evidence);
  changed.message.message_sha256 = "0".repeat(64);
  const result = await runPreflight({ ...common, evidence: changed });
  assert.equal(result.record.decision.code, "NONCE_REUSE_MISMATCH");
  assert.equal(result.record.decision.outcome, "BLOCK");
});

test("confirmation is checked before replay lookup", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-auth" });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const nonce = "auth-before-replay-01";
  await runPreflight({
    plan,
    confirmationDigest: plan.policy_digest,
    evidence,
    nonce,
    now: NOW,
    historyDirectory,
  });
  const invalid = await runPreflight({
    plan,
    confirmationDigest: "0".repeat(64),
    evidence,
    nonce,
    now: NOW,
    historyDirectory,
  });
  assert.equal(invalid.replayed, false);
  assert.equal(invalid.record.decision.code, "POLICY_CONFIRMATION_MISMATCH");
});

test("50 concurrent identical attempts converge on one record", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-concurrent" });
  const input = {
    plan,
    confirmationDigest: plan.policy_digest,
    evidence: buildDemoEvidence(plan, { now: NOW }),
    nonce: "concurrent-nonce-001",
    now: NOW,
    historyDirectory,
  };
  const results = await Promise.all(
    Array.from({ length: 50 }, () => runPreflight(input)),
  );
  assert.equal(new Set(results.map((item) => item.record.record_digest)).size, 1);
  assert.equal(results.filter((item) => item.replayed === false).length, 1);
});

test("invalid nonce blocks without echoing it", async () => {
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-bad-nonce" });
  const result = await runPreflight({
    plan,
    confirmationDigest: plan.policy_digest,
    evidence: buildDemoEvidence(plan, { now: NOW }),
    nonce: "short",
    now: NOW,
  });
  assert.equal(result.record.decision.code, "NONCE_INVALID");
  assert.equal(JSON.stringify(result.record).includes("short"), false);
});

test("public sign, broadcast and execute boundary always throws", () => {
  assert.throws(
    () => assertExecutionLocked(),
    (error) => error.code === "PUBLIC_EXECUTION_LOCKED",
  );
});

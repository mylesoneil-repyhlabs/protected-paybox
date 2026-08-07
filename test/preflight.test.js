import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
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

test("nonce binding includes quote, reference, simulation, and timestamps", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-full-bind" });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const common = {
    plan,
    confirmationDigest: plan.policy_digest,
    nonce: "full-evidence-nonce-01",
    now: NOW,
    historyDirectory,
  };
  await runPreflight({ ...common, evidence });
  for (const mutate of [
    (changed) => { changed.quote.price_impact_bps = 1_000; },
    (changed) => { changed.reference.expected_receive_atomic = "999999999"; },
    (changed) => { changed.simulation.network_fee_atomic = "999999"; },
    (changed) => {
      changed.quote.observed_at = new Date(NOW.getTime() + 1_000).toISOString();
    },
  ]) {
    const changed = structuredClone(evidence);
    mutate(changed);
    const result = await runPreflight({ ...common, evidence: changed });
    assert.equal(result.record.decision.outcome, "BLOCK");
    assert.equal(result.record.decision.code, "NONCE_REUSE_MISMATCH");
  }
});

test("expired mandate never replays a historical PASS", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-expiry" });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const common = {
    plan,
    confirmationDigest: plan.policy_digest,
    evidence,
    nonce: "expired-replay-nonce-1",
    historyDirectory,
  };
  const first = await runPreflight({ ...common, now: NOW });
  assert.equal(first.record.decision.outcome, "PASS");
  const expired = await runPreflight({
    ...common,
    now: new Date(NOW.getTime() + 121_000),
  });
  assert.equal(expired.replayed, false);
  assert.equal(expired.record.decision.outcome, "BLOCK");
  assert.equal(expired.record.decision.code, "MANDATE_EXPIRED");
});

test("stale evidence never replays a historical PASS", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), { now: NOW, id: "plan-stale" });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const common = {
    plan,
    confirmationDigest: plan.policy_digest,
    evidence,
    nonce: "stale-replay-nonce-01",
    historyDirectory,
  };
  await runPreflight({ ...common, now: NOW });
  const stale = await runPreflight({
    ...common,
    now: new Date(NOW.getTime() + 20_000),
  });
  assert.equal(stale.replayed, false);
  assert.equal(stale.record.decision.outcome, "REVIEW");
  assert.equal(stale.record.decision.code, "COLLECTION_STALE");
});

test("valid record transplant cannot satisfy another history binding", async (t) => {
  const historyA = await temporaryHistory(t);
  const historyB = await temporaryHistory(t);
  const planA = createPlan(buildDemoIntent(), { now: NOW, id: "plan-a" });
  const planB = createPlan(
    buildDemoIntent({
      sell_amount_atomic: "25000000",
      minimum_receive_atomic: "180000000",
    }),
    { now: NOW, id: "plan-b" },
  );
  const inputA = {
    plan: planA,
    confirmationDigest: planA.policy_digest,
    evidence: buildDemoEvidence(planA, { now: NOW }),
    nonce: "transplant-nonce-a1",
    now: NOW,
    historyDirectory: historyA,
  };
  const inputB = {
    plan: planB,
    confirmationDigest: planB.policy_digest,
    evidence: buildDemoEvidence(planB, { now: NOW }),
    nonce: "transplant-nonce-b1",
    now: NOW,
    historyDirectory: historyB,
  };
  await runPreflight(inputA);
  await runPreflight(inputB);
  const fileA = path.join(
    historyA,
    (await readdir(historyA)).find(
      (name) => name.endsWith(".json") && !name.startsWith("plan-use-"),
    ),
  );
  const fileB = path.join(
    historyB,
    (await readdir(historyB)).find(
      (name) => name.endsWith(".json") && !name.startsWith("plan-use-"),
    ),
  );
  const storedA = JSON.parse(await readFile(fileA, "utf8"));
  const storedB = JSON.parse(await readFile(fileB, "utf8"));
  storedB.record = storedA.record;
  await writeFile(fileB, `${JSON.stringify(storedB, null, 2)}\n`, {
    mode: 0o600,
  });
  await assert.rejects(
    runPreflight(inputB),
    (error) => error.code === "HISTORY_RECORD_INVALID",
  );
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

test("separate processes atomically converge on one nonce binding", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const gatePath = path.join(historyDirectory, "start.gate");
  const worker = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "fixtures",
    "preflight-worker.mjs",
  );
  const runs = Array.from({ length: 16 }, (_, index) =>
    runWorker(worker, historyDirectory, index % 2 === 0 ? "base" : "changed", gatePath),
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await writeFile(gatePath, "go\n", { mode: 0o600 });
  const results = await Promise.all(runs);
  const durableRecords = results.filter(
    (result) => result.code !== "NONCE_REUSE_MISMATCH",
  );
  assert.ok(durableRecords.length > 0);
  assert.equal(
    new Set(durableRecords.map((result) => result.record_digest)).size,
    1,
  );
  assert.ok(
    results
      .filter((result) => result.code === "NONCE_REUSE_MISMATCH")
      .every((result) => result.outcome === "BLOCK"),
  );
  const historyFiles = (await readdir(historyDirectory)).filter((name) =>
    name.endsWith(".json") && !name.startsWith("plan-use-"),
  );
  assert.equal(historyFiles.length, 1);
  const stored = JSON.parse(
    await readFile(path.join(historyDirectory, historyFiles[0]), "utf8"),
  );
  assert.equal(stored.record.record_digest, durableRecords[0].record_digest);
});

test("one-use plan cannot PASS twice under different nonces", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), {
    now: NOW,
    id: "one-use-plan",
  });
  const common = {
    plan,
    confirmationDigest: plan.policy_digest,
    evidence: buildDemoEvidence(plan, { now: NOW }),
    now: NOW,
    historyDirectory,
  };
  const first = await runPreflight({
    ...common,
    nonce: "one-use-first-nonce",
  });
  const second = await runPreflight({
    ...common,
    nonce: "one-use-second-nonce",
  });
  assert.equal(first.record.decision.outcome, "PASS");
  assert.equal(second.record.decision.outcome, "BLOCK");
  assert.equal(second.record.decision.code, "PLAN_ALREADY_USED");
});

test("a temporal REVIEW promotion durably consumes the plan exactly once", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const plan = createPlan(buildDemoIntent(), {
    now: NOW,
    id: "temporal-review-promotion",
  });
  const common = {
    plan,
    confirmationDigest: plan.policy_digest,
    evidence: buildDemoEvidence(plan, { now: NOW }),
    nonce: "temporal-review-nonce-01",
    historyDirectory,
  };

  const review = await runPreflight({
    ...common,
    now: new Date(NOW.getTime() - 3_000),
  });
  assert.equal(review.record.decision.outcome, "REVIEW");
  assert.equal(review.record.decision.code, "COLLECTION_STALE_FUTURE");

  const promoted = await runPreflight({ ...common, now: NOW });
  assert.equal(promoted.record.decision.outcome, "PASS");
  assert.equal(promoted.replayed, false);

  const exactReplay = await runPreflight({ ...common, now: NOW });
  assert.equal(exactReplay.record.decision.outcome, "PASS");
  assert.equal(exactReplay.replayed, true);
  assert.equal(exactReplay.record.record_digest, promoted.record.record_digest);

  const competing = await runPreflight({
    ...common,
    nonce: "temporal-competing-nonce-01",
    now: NOW,
  });
  assert.equal(competing.record.decision.outcome, "BLOCK");
  assert.equal(competing.record.decision.code, "PLAN_ALREADY_USED");
});

test("separate processes converge on one temporal REVIEW promotion", async (t) => {
  const historyDirectory = await temporaryHistory(t);
  const worker = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "fixtures",
    "preflight-worker.mjs",
  );
  const plan = createPlan(buildDemoIntent(), {
    now: NOW,
    id: "cross-process-plan",
  });
  const evidence = buildDemoEvidence(plan, { now: NOW });
  const nonce = "cross-process-temporal-nonce-01";
  const review = await runPreflight({
    plan,
    confirmationDigest: plan.policy_digest,
    evidence,
    nonce,
    now: new Date(NOW.getTime() - 3_000),
    historyDirectory,
  });
  assert.equal(review.record.decision.outcome, "REVIEW");

  const promotionGate = path.join(historyDirectory, "promotion.gate");
  const promotions = Array.from({ length: 16 }, () =>
    runWorker(worker, historyDirectory, "base", promotionGate, nonce),
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await writeFile(promotionGate, "go\n", { mode: 0o600 });
  const promoted = await Promise.all(promotions);
  assert.ok(promoted.every((result) => result.outcome === "PASS"));
  assert.equal(new Set(promoted.map((result) => result.record_digest)).size, 1);
  assert.equal(promoted.filter((result) => result.replayed === false).length, 1);

  const competitionGate = path.join(historyDirectory, "competition.gate");
  const competitors = Array.from({ length: 16 }, (_, index) =>
    runWorker(
      worker,
      historyDirectory,
      "base",
      competitionGate,
      `cross-process-competing-nonce-${String(index).padStart(2, "0")}`,
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await writeFile(competitionGate, "go\n", { mode: 0o600 });
  const blocked = await Promise.all(competitors);
  assert.ok(
    blocked.every(
      (result) =>
        result.outcome === "BLOCK" && result.code === "PLAN_ALREADY_USED",
    ),
  );
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

function runWorker(worker, historyDirectory, variant, gatePath, nonce) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [worker, historyDirectory, variant, gatePath, ...(nonce ? [nonce] : [])],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`preflight worker exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`preflight worker returned invalid JSON: ${stdout}`, {
          cause: error,
        }));
      }
    });
  });
}

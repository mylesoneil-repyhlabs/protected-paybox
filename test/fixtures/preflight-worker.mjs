import { existsSync } from "node:fs";
import { buildDemoEvidence, buildDemoIntent } from "../../src/fixtures.js";
import { createPlan } from "../../src/policy.js";
import { runPreflight } from "../../src/preflight.js";

const [historyDirectory, variant, gatePath] = process.argv.slice(2);
const now = new Date("2026-07-30T12:00:00Z");
const plan = createPlan(buildDemoIntent(), {
  now,
  id: "cross-process-plan",
});
const evidence = buildDemoEvidence(plan, { now });
if (variant === "changed") evidence.quote.price_impact_bps = 1_000;

while (!existsSync(gatePath)) {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

const result = await runPreflight({
  plan,
  confirmationDigest: plan.policy_digest,
  evidence,
  nonce: "cross-process-nonce-01",
  now,
  historyDirectory,
});

process.stdout.write(JSON.stringify({
  outcome: result.record.decision.outcome,
  code: result.record.decision.code,
  record_digest: result.record.record_digest,
  replayed: result.replayed,
}));

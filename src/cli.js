#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { digest } from "./canonical.js";
import {
  PRODUCT_NAME,
  PUBLIC_BOUNDARY,
  SCHEMAS,
  VERSION,
} from "./constants.js";
import { asGuardError, GuardError } from "./errors.js";
import { buildDemoEvidence, buildDemoIntent } from "./fixtures.js";
import {
  readJsonFile,
  writePrivateJson,
  writePrivateText,
} from "./io.js";
import { createPlan, formatMandate, validatePlan } from "./policy.js";
import { assertExecutionLocked, runPreflight } from "./preflight.js";
import { formatDecision, renderHtml } from "./report.js";
import { verifyRecord } from "./receipt.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_RUNTIME = path.join(ROOT, ".protected-paybox-runtime");

main().catch((error) => {
  const typed = asGuardError(error);
  process.stderr.write(`${typed.code}: ${typed.message}\n`);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", ...tokens] = process.argv.slice(2);
  const options = parseOptions(tokens);
  switch (command) {
    case "version":
      print(options.json ? { name: PRODUCT_NAME, version: VERSION } : `${PRODUCT_NAME} v${VERSION}`);
      return;
    case "doctor":
      await doctor(options);
      return;
    case "plan":
      await planCommand(options);
      return;
    case "demo":
      await demoCommand(options);
      return;
    case "simulate":
      await simulateCommand(options);
      return;
    case "verify":
      await verifyCommand(options);
      return;
    case "execute":
    case "sign":
    case "broadcast":
      assertExecutionLocked();
      return;
    case "help":
    case "--help":
    case "-h":
      print(helpText());
      return;
    default:
      throw new GuardError("COMMAND_UNKNOWN", `Unknown command: ${command}`);
  }
}

async function doctor(options) {
  noUnknownOptions(options, ["json"]);
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  const result = {
    product: PRODUCT_NAME,
    version: VERSION,
    node: process.versions.node,
    node_supported: major >= 22,
    schemas: SCHEMAS,
    execution_locked: PUBLIC_BOUNDARY.execution_available === false,
    paybox_contacted: false,
    network_contacted: false,
    ready: major >= 22,
  };
  print(options.json ? result : [
    `${PRODUCT_NAME} v${VERSION}`,
    `Node ${result.node}: ${result.node_supported ? "ready" : "unsupported"}`,
    "Mode: credential-free simulated fixture",
    "Execution: compile-time locked",
    "PayBox/network contact: none",
  ].join("\n"));
}

async function planCommand(options) {
  noUnknownOptions(options, ["intent", "out", "json", "details"]);
  requireOption(options, "intent");
  const intent = await readJsonFile(
    path.resolve(options.intent),
    "intent file",
  );
  const plan = createPlan(intent);
  const outputDirectory = path.resolve(options.out ?? path.join(DEFAULT_RUNTIME, "plans"));
  const outputPath = path.join(outputDirectory, `${plan.plan_id}.json`);
  await writePrivateJson(outputPath, plan);
  if (options.json) {
    print({ plan_path: outputPath, plan });
    return;
  }
  print(formatMandate(plan));
  if (options.details) {
    print(`\nPlan: ${outputPath}\nPolicy digest: ${plan.policy_digest}`);
  }
}

async function demoCommand(options) {
  noUnknownOptions(options, [
    "scenario",
    "json",
    "details",
    "out",
    "history",
    "plan",
    "confirm-policy",
  ]);
  const scenario = options.scenario ?? "pass";
  const allowed = new Set([
    "pass",
    "block-minimum-receive",
    "block-network-fee",
    "block-price-impact",
    "block-recipient",
    "review-stale",
    "review-unknown-program",
    "review-hidden-inner-call",
    "review-simulation-failed",
  ]);
  if (!allowed.has(scenario)) {
    throw new GuardError(
      "SCENARIO_UNKNOWN",
      `Unknown scenario: ${scenario}`,
    );
  }
  const now = new Date();
  let plan;
  let confirmationDigest;
  if (options.plan) {
    requireOption(options, "confirm-policy");
    plan = await readJsonFile(path.resolve(options.plan), "plan file");
    validateLoadedPlan(plan);
    confirmationDigest = options["confirm-policy"];
  } else {
    if (options["confirm-policy"]) {
      throw new GuardError(
        "OPTION_INVALID",
        "--confirm-policy is accepted only with a saved --plan.",
      );
    }
    plan = createPlan(buildDemoIntent(), {
      now,
      id: `demo-${digest(`${scenario}-${now.toISOString()}`).slice(0, 20)}`,
    });
    confirmationDigest = plan.policy_digest;
  }
  const evidence = buildDemoEvidence(plan, { scenario, now });
  const result = await runPreflight({
    plan,
    confirmationDigest,
    evidence,
    nonce: `demo-${scenario}-${digest(now.toISOString()).slice(0, 24)}`,
    now,
    historyDirectory: options.history
      ? path.resolve(options.history)
      : null,
  });
  await persistRecord(result.record, options.out);
  if (options.json) print({ ...result, verification: verifyRecord(result.record) });
  else print(formatDecision(result.record, { details: options.details === true }));
}

async function simulateCommand(options) {
  noUnknownOptions(options, [
    "plan",
    "evidence",
    "confirm-policy",
    "nonce",
    "json",
    "details",
    "out",
    "history",
  ]);
  for (const required of ["plan", "evidence", "confirm-policy", "nonce"]) {
    requireOption(options, required);
  }
  const plan = await readJsonFile(path.resolve(options.plan), "plan file");
  validateLoadedPlan(plan);
  const evidence = await readJsonFile(
    path.resolve(options.evidence),
    "evidence file",
  );
  const result = await runPreflight({
    plan,
    confirmationDigest: options["confirm-policy"],
    evidence,
    nonce: options.nonce,
    historyDirectory: options.history
      ? path.resolve(options.history)
      : path.join(DEFAULT_RUNTIME, "history"),
  });
  await persistRecord(result.record, options.out);
  if (options.json) print({ ...result, verification: verifyRecord(result.record) });
  else print(formatDecision(result.record, { details: options.details === true }));
}

async function verifyCommand(options) {
  noUnknownOptions(options, ["record", "json"]);
  requireOption(options, "record");
  const record = await readJsonFile(path.resolve(options.record), "record file");
  const result = verifyRecord(record);
  print(options.json ? result : `${result.verified ? "VERIFIED" : "INVALID"} — ${result.statement ?? result.reason}`);
  if (!result.verified) process.exitCode = 2;
}

async function persistRecord(record, output) {
  if (!output) return null;
  const directory = path.resolve(output);
  const base = `${record.generated_at.replaceAll(":", "-")}-${record.decision.outcome.toLowerCase()}`;
  const jsonPath = path.join(directory, `${base}.json`);
  const htmlPath = path.join(directory, `${base}.html`);
  await writePrivateJson(jsonPath, record);
  await writePrivateText(htmlPath, renderHtml(record));
  return { jsonPath, htmlPath };
}

function validateLoadedPlan(plan) {
  validatePlan(plan);
}

function parseOptions(tokens) {
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      throw new GuardError(
        "ARGUMENT_INVALID",
        `Unexpected positional argument: ${token}`,
      );
    }
    const key = token.slice(2);
    if (!key || Object.hasOwn(options, key)) {
      throw new GuardError(
        "ARGUMENT_INVALID",
        `Invalid or duplicate option: ${token}`,
      );
    }
    const next = tokens[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function noUnknownOptions(options, allowed) {
  const unknown = Object.keys(options).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new GuardError(
      "OPTION_UNKNOWN",
      `Unsupported option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`,
    );
  }
}

function requireOption(options, key) {
  if (typeof options[key] !== "string" || options[key].length === 0) {
    throw new GuardError("OPTION_REQUIRED", `--${key} is required.`);
  }
}

function print(value) {
  process.stdout.write(
    typeof value === "string" ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`,
  );
}

function helpText() {
  return `${PRODUCT_NAME} v${VERSION}

Usage:
  ./run doctor [--json]
  ./run plan --intent /absolute/intent.json [--out /private/directory] [--details]
  ./run demo --scenario pass|block-minimum-receive|review-stale [--details] [--out /private/directory]
  ./run demo --plan /absolute/plan.json --confirm-policy <digest> --scenario pass
  ./run simulate --plan /absolute/plan.json --evidence /absolute/evidence.json --confirm-policy <digest> --nonce <one-use-nonce>
  ./run verify --record /absolute/record.json

Public execution is locked. The commands execute, sign, and broadcast always fail closed.`;
}

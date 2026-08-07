#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
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
import { listRepresentativeMerchants } from "./card/catalog.js";
import { evaluateCardProposal } from "./card/evaluator.js";
import {
  buildCardDemoEvidence,
  buildCardDemoIntent,
  CARD_DEMO_SCENARIOS,
} from "./card/fixtures.js";
import {
  createCardPlan,
  formatCardMandate,
  validateCardPlan,
} from "./card/policy.js";
import { buildPayboxToolSnapshot } from "./paybox-discovery.js";
import {
  PayboxConnection,
  summarizePayboxSnapshot,
} from "./paybox-connection.js";
import { assertExecutionLocked, runPreflight } from "./preflight.js";
import { formatDecision, renderHtml } from "./report.js";
import { verifyRecord } from "./receipt.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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
    case "card-merchants":
      await cardMerchantsCommand(options);
      return;
    case "card-plan":
      await cardPlanCommand(options);
      return;
    case "card-demo":
      await cardDemoCommand(options);
      return;
    case "card-simulate":
      await cardSimulateCommand(options);
      return;
    case "simulate":
      await simulateCommand(options);
      return;
    case "verify":
      await verifyCommand(options);
      return;
    case "inspect-tools":
      await inspectToolsCommand(options);
      return;
    case "paybox-connect":
      await payboxConnectCommand(options);
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
    paybox_oauth_available: PUBLIC_BOUNDARY.paybox_oauth_available === true,
    authenticated_tool_discovery_available:
      PUBLIC_BOUNDARY.authenticated_tool_discovery_available === true,
    remote_paybox_tool_calls_available:
      PUBLIC_BOUNDARY.remote_paybox_tool_calls_available === true,
    paybox_contacted: false,
    network_contacted: false,
    ready: major >= 22,
  };
  print(options.json ? result : [
    `${PRODUCT_NAME} v${VERSION}`,
    `Node ${result.node}: ${result.node_supported ? "ready" : "unsupported"}`,
    "Mode: session-only PayBox OAuth discovery plus local fixtures",
    "Remote PayBox tools: locked; authenticated tools/list only after explicit connect",
    "Execution: locked; no payment, signing, swap, or broadcast adapter",
    "PayBox/network contact during doctor: none",
  ].join("\n"));
}

async function cardMerchantsCommand(options) {
  noUnknownOptions(options, ["json"]);
  const merchants = listRepresentativeMerchants();
  if (options.json) {
    print({
      merchants,
      boundary:
        "Representative fixtures only; no live PayBox card or merchant coverage claim.",
    });
    return;
  }
  print([
    "REPRESENTATIVE CARD FIXTURES · NOT LIVE MERCHANT COVERAGE",
    "",
    ...merchants.map(
      (merchant) =>
        `${merchant.display_name} · ${merchant.archetype} · ${merchant.status}`,
    ),
  ].join("\n"));
}

async function cardPlanCommand(options) {
  noUnknownOptions(options, ["intent", "out", "json", "details"]);
  requireOption(options, "intent");
  const intent = await readJsonFile(options.intent, "card intent file");
  const plan = createCardPlan(intent);
  const outputDirectory = path.resolve(
    options.out ?? path.join(runtimeRoot(), "card-plans"),
  );
  const outputPath = path.join(outputDirectory, `${plan.plan_id}.json`);
  await writePrivateJson(outputPath, plan);
  if (options.json) {
    print({ plan_path: outputPath, plan });
    return;
  }
  print(formatCardMandate(plan));
  if (options.details) {
    print(`\nPlan: ${outputPath}\nPolicy digest: ${plan.policy_digest}`);
  }
}

async function cardDemoCommand(options) {
  noUnknownOptions(options, [
    "merchant",
    "scenario",
    "json",
    "details",
    "out",
    "plan",
    "confirm-policy",
  ]);
  const merchant = options.merchant ?? "doordash";
  const scenario = options.scenario ?? "pass";
  if (!CARD_DEMO_SCENARIOS.includes(scenario)) {
    throw new GuardError("SCENARIO_UNKNOWN", `Unknown card scenario: ${scenario}`);
  }
  const now = new Date();
  let plan;
  let confirmationDigest;
  if (options.plan) {
    requireOption(options, "confirm-policy");
    plan = await readJsonFile(options.plan, "card plan file");
    validateCardPlan(plan);
    confirmationDigest = options["confirm-policy"];
  } else {
    if (options["confirm-policy"]) {
      throw new GuardError(
        "OPTION_INVALID",
        "--confirm-policy is accepted only with a saved --plan.",
      );
    }
    plan = createCardPlan(buildCardDemoIntent(merchant), {
      now,
      id: `card-demo-${digest(`${merchant}-${scenario}-${now.toISOString()}`).slice(0, 20)}`,
    });
    confirmationDigest = plan.policy_digest;
  }
  const evidence = buildCardDemoEvidence(plan, { scenario, now });
  const result = await runPreflight({
    plan,
    confirmationDigest,
    evidence,
    nonce: `card-demo-${merchant}-${scenario}-${digest(now.toISOString()).slice(0, 24)}`,
    now,
    historyDirectory: options.plan
      ? path.join(runtimeRoot(), "card-history")
      : null,
    evaluator: evaluateCardProposal,
    authorizationMode: options.plan
      ? "CALLER_SUPPLIED_DIGEST_UNAUTHENTICATED"
      : "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION",
  });
  await persistRecord(result.record, options.out);
  if (options.json) print({ ...result, verification: verifyRecord(result.record) });
  else print(formatDecision(result.record, { details: options.details === true }));
}

async function cardSimulateCommand(options) {
  noUnknownOptions(options, [
    "plan",
    "evidence",
    "confirm-policy",
    "nonce",
    "json",
    "details",
    "out",
  ]);
  for (const required of ["plan", "evidence", "confirm-policy", "nonce"]) {
    requireOption(options, required);
  }
  const plan = await readJsonFile(options.plan, "card plan file");
  validateCardPlan(plan);
  const evidence = await readJsonFile(options.evidence, "card evidence file");
  const result = await runPreflight({
    plan,
    confirmationDigest: options["confirm-policy"],
    evidence,
    nonce: options.nonce,
    historyDirectory: path.join(runtimeRoot(), "card-history"),
    evaluator: evaluateCardProposal,
  });
  await persistRecord(result.record, options.out);
  if (options.json) print({ ...result, verification: verifyRecord(result.record) });
  else print(formatDecision(result.record, { details: options.details === true }));
}

async function planCommand(options) {
  noUnknownOptions(options, ["intent", "out", "json", "details"]);
  requireOption(options, "intent");
  const intent = await readJsonFile(
    options.intent,
    "intent file",
  );
  const plan = createPlan(intent);
  const outputDirectory = path.resolve(
    options.out ?? path.join(runtimeRoot(), "plans"),
  );
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
    plan = await readJsonFile(options.plan, "plan file");
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
    historyDirectory: options.plan
      ? path.join(runtimeRoot(), "history")
      : null,
    authorizationMode: options.plan
      ? "CALLER_SUPPLIED_DIGEST_UNAUTHENTICATED"
      : "FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION",
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
  ]);
  for (const required of ["plan", "evidence", "confirm-policy", "nonce"]) {
    requireOption(options, required);
  }
  const plan = await readJsonFile(options.plan, "plan file");
  validateLoadedPlan(plan);
  const evidence = await readJsonFile(
    options.evidence,
    "evidence file",
  );
  const result = await runPreflight({
    plan,
    confirmationDigest: options["confirm-policy"],
    evidence,
    nonce: options.nonce,
    historyDirectory: path.join(runtimeRoot(), "history"),
  });
  await persistRecord(result.record, options.out);
  if (options.json) print({ ...result, verification: verifyRecord(result.record) });
  else print(formatDecision(result.record, { details: options.details === true }));
}

async function verifyCommand(options) {
  noUnknownOptions(options, ["record", "json"]);
  requireOption(options, "record");
  const record = await readJsonFile(options.record, "record file");
  const result = verifyRecord(record);
  print(options.json ? result : `${result.verified ? "VERIFIED" : "INVALID"} — ${result.statement ?? result.reason}`);
  if (!result.verified) process.exitCode = 2;
}

async function inspectToolsCommand(options) {
  noUnknownOptions(options, ["capture", "out", "json"]);
  requireOption(options, "capture");
  const capture = await readJsonFile(
    options.capture,
    "captured tools/list file",
  );
  const snapshot = buildPayboxToolSnapshot(capture);
  let outputPath = null;
  if (options.out) {
    outputPath = path.resolve(options.out);
    await writePrivateJson(outputPath, snapshot);
  }
  if (options.json) {
    print({ snapshot_path: outputPath, snapshot });
    return;
  }
  const safeCandidates = snapshot.tools
    .filter((tool) => tool.safe_read_only_candidate)
    .map((tool) => tool.name);
  const gated = snapshot.tools
    .filter((tool) => tool.requires_mandate_gate)
    .map((tool) => `${tool.name} (${tool.classification})`);
  print([
    "PAYBOX TOOL SURFACE · OFFLINE CAPTURE ANALYSIS",
    "",
    `Tools: ${snapshot.tool_count}`,
    `Read-only candidates: ${safeCandidates.join(", ") || "none"}`,
    `Mandate-gated or unknown: ${gated.join(", ") || "none"}`,
    `Snapshot digest: ${snapshot.snapshot_digest}`,
    outputPath ? `Private snapshot: ${outputPath}` : null,
    "",
    "Boundary: no OAuth, PayBox request, signature, broadcast, or transaction.",
    "Classification is conservative static analysis, not proof of provider behavior.",
  ].filter(Boolean).join("\n"));
}

async function payboxConnectCommand(options) {
  noUnknownOptions(options, ["timeout", "out", "json"]);
  const timeoutSeconds = options.timeout === undefined
    ? 300
    : Number(options.timeout);
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 60 ||
    timeoutSeconds > 600
  ) {
    throw new GuardError(
      "OPTION_INVALID",
      "--timeout must be an integer from 60 through 600 seconds.",
    );
  }
  let requestedSnapshotPath = null;
  if (options.out !== undefined) {
    if (typeof options.out !== "string" || !path.isAbsolute(options.out)) {
      throw new GuardError(
        "ABSOLUTE_PATH_REQUIRED",
        "Authenticated tool snapshot path must be absolute.",
      );
    }
    requestedSnapshotPath = path.resolve(options.out);
  }
  const connection = new PayboxConnection();
  let revocationReported = false;
  try {
    const started = await connection.begin({
      timeoutMs: timeoutSeconds * 1_000,
    });
    process.stderr.write([
      "PAYBOX SESSION-ONLY AUTHORIZATION",
      "Open this URL in your browser and approve only on PayBox:",
      started.authorization_url,
      "",
      `Registered PayBox client: ${started.registered_client_name}`,
      "This client is already registered. Its mcp bearer has the authority of every selected grant.",
      "Select no credential if PayBox permits; otherwise select one least-sensitive evaluation credential, require human approval for every operation, and grant no raw secrets.",
      "Protected PayBox will only fetch initialize and tools/list. It cannot call a PayBox financial tool.",
      "",
    ].join("\n"));
    const authorized = await connection.waitForAuthorization();
    if (authorized.phase !== "connected") {
      throw new GuardError(
        authorized.reason_code ?? "PAYBOX_OAUTH_FAILED",
        authorized.message ?? "PayBox authorization was not completed.",
      );
    }
    const discovered = await connection.syncTools();
    let snapshotPath = null;
    if (requestedSnapshotPath) {
      snapshotPath = requestedSnapshotPath;
      await writePrivateJson(snapshotPath, discovered.snapshot);
    }
    const disconnected = await connection.disconnect();
    revocationReported = true;
    const result = {
      authenticated_discovery_completed: true,
      final_connection_state: "disconnected",
      connection_lifetime: "one command; token discarded before this result",
      scope: "mcp",
      snapshot_path: snapshotPath,
      snapshot: summarizePayboxSnapshot(discovered.snapshot),
      local_token_discarded: disconnected.local_token_discarded,
      registered_client_names_requiring_manual_revocation:
        disconnected.registered_client_names_requiring_manual_revocation,
      server_side_client_revoked: false,
      manual_revocation_next_step: disconnected.next_step,
      remote_tool_calls_available: false,
      money_moved: false,
    };
    print(options.json ? result : [
      "PAYBOX AUTHENTICATED CAPABILITY DISCOVERY COMPLETE",
      `Tools discovered: ${result.snapshot.tool_count}`,
      `Snapshot digest: ${result.snapshot.snapshot_digest}`,
      snapshotPath ? `Private snapshot: ${snapshotPath}` : null,
      "Final connection: disconnected; the memory-only token was discarded",
      `Server-side client: still registered; ${disconnected.next_step}`,
      "Remote PayBox tool calls: disabled",
      "No credential requested · no signature · no payment · no swap · no money moved",
    ].filter(Boolean).join("\n"));
  } finally {
    const disconnected = await connection.disconnect();
    if (
      !revocationReported &&
      disconnected.registered_client_names_requiring_manual_revocation.length > 0
    ) {
      process.stderr.write(
        `PAYBOX MANUAL REVOCATION REQUIRED: ${disconnected.next_step}\n`,
      );
    }
  }
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

function runtimeRoot() {
  const markerPath = path.join(ROOT, ".protected-paybox-install.json");
  if (!existsSync(markerPath)) {
    return path.join(ROOT, ".protected-paybox-runtime");
  }

  const markerMetadata = lstatSync(markerPath);
  if (markerMetadata.isSymbolicLink() || !markerMetadata.isFile()) {
    throw new GuardError(
      "MANAGED_INSTALL_INVALID",
      "Managed install marker must be a regular non-symlink file.",
    );
  }
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    throw new GuardError(
      "MANAGED_INSTALL_INVALID",
      "Managed install marker is malformed.",
    );
  }
  const versionsRoot = path.dirname(ROOT);
  if (
    marker?.schema_version !== "protected-paybox.managed-install.v1" ||
    marker?.product !== "protected-paybox" ||
    marker?.version !== VERSION ||
    path.basename(ROOT) !== `v${VERSION}` ||
    path.basename(versionsRoot) !== "versions"
  ) {
    throw new GuardError(
      "MANAGED_INSTALL_INVALID",
      "Managed install identity does not match this runtime.",
    );
  }
  const productRoot = realpathSync(path.dirname(versionsRoot));
  const stateRoot = path.join(productRoot, "state");
  if (!existsSync(stateRoot)) {
    throw new GuardError(
      "MANAGED_STATE_INVALID",
      "Managed state directory is missing.",
    );
  }
  const stateMetadata = lstatSync(stateRoot);
  if (stateMetadata.isSymbolicLink() || !stateMetadata.isDirectory()) {
    throw new GuardError(
      "MANAGED_STATE_INVALID",
      "Managed state must be a real directory.",
    );
  }
  return realpathSync(stateRoot);
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
  ./run card-merchants [--json]
  ./run card-plan --intent /absolute/card-intent.json [--out /private/directory] [--details]
  ./run card-demo --merchant doordash --scenario pass|block-total|review-stale [--details]
  ./run card-demo --plan /absolute/card-plan.json --confirm-policy <digest> --scenario pass
  ./run card-simulate --plan /absolute/card-plan.json --evidence /absolute/card-evidence.json --confirm-policy <digest> --nonce <one-use-nonce>
  ./run verify --record /absolute/record.json
  ./run inspect-tools --capture /absolute/tools-list.json [--out /private/snapshot.json]
  ./run paybox-connect [--timeout 300] [--out /absolute/private/paybox-tools.json]

PayBox connection is session-only OAuth plus authenticated tool discovery. Public execution is locked; execute, sign, broadcast, and every upstream PayBox tool call fail closed.`;
}

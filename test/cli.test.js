import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cli = path.join(root, "src", "cli.js");

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "protected-paybox-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("CLI version matches package metadata", async () => {
  const packageMetadata = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const { stdout } = await execFileAsync(process.execPath, [cli, "version"]);
  assert.equal(stdout.trim(), `Protected PayBox v${packageMetadata.version}`);
});

test("custom fixture requires a saved plan and exact separate confirmation", async (t) => {
  const outputDirectory = await temporaryDirectory(t);
  const intentPath = path.join(root, "examples", "solana-25-usdc-intent.json");
  const planned = await execFileAsync(process.execPath, [
    cli,
    "plan",
    "--intent",
    intentPath,
    "--out",
    outputDirectory,
    "--json",
  ]);
  const { plan_path: planPath, plan } = JSON.parse(planned.stdout);
  assert.equal((await lstat(planPath)).mode & 0o077, 0);

  await assert.rejects(
    execFileAsync(process.execPath, [
      cli,
      "demo",
      "--plan",
      planPath,
      "--scenario",
      "pass",
    ]),
    /--confirm-policy is required/,
  );

  const evaluated = await execFileAsync(process.execPath, [
    cli,
    "demo",
    "--plan",
    planPath,
    "--confirm-policy",
    plan.policy_digest,
    "--scenario",
    "pass",
    "--json",
  ]);
  const result = JSON.parse(evaluated.stdout);
  assert.equal(result.record.decision.outcome, "PASS");
  assert.equal(
    result.record.plan.policy.economics.exact_sell_amount_display,
    "25",
  );

  const repeated = await execFileAsync(process.execPath, [
    cli,
    "demo",
    "--plan",
    planPath,
    "--confirm-policy",
    plan.policy_digest,
    "--scenario",
    "pass",
    "--json",
  ]);
  const repeatedResult = JSON.parse(repeated.stdout);
  assert.equal(repeatedResult.record.decision.outcome, "BLOCK");
  assert.equal(repeatedResult.record.decision.code, "PLAN_ALREADY_USED");
});

test("offline tool inspection writes a private, redacted snapshot", async (t) => {
  const outputDirectory = await temporaryDirectory(t);
  const capturePath = path.join(
    root,
    "examples",
    "paybox-tools-list.fixture.json",
  );
  const snapshotPath = path.join(outputDirectory, "snapshot.json");
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "inspect-tools",
    "--capture",
    capturePath,
    "--out",
    snapshotPath,
  ]);
  assert.match(stdout, /OFFLINE CAPTURE ANALYSIS/);
  assert.match(stdout, /sign_and_broadcast_transaction \(combined_write\)/);
  assert.match(stdout, /no OAuth, PayBox request, signature, broadcast/i);
  assert.equal((await lstat(snapshotPath)).mode & 0o077, 0);
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  assert.equal(snapshot.source.provider_authenticated, false);
  assert.equal(snapshot.risk_summary.combined_write, 1);
});

test("removed custom auto-authorization option is rejected", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [
      cli,
      "demo",
      "--intent",
      path.join(root, "examples", "solana-25-usdc-intent.json"),
    ]),
    /Unsupported option: intent/,
  );
});

test("relative input paths are rejected instead of silently resolved", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        cli,
        "inspect-tools",
        "--capture",
        "examples/paybox-tools-list.fixture.json",
      ],
      { cwd: root },
    ),
    /must be an absolute path/,
  );
});

test("caller cannot redirect the canonical one-use history store", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [
      cli,
      "demo",
      "--history",
      path.join(os.tmpdir(), "alternate-protected-paybox-history"),
    ]),
    /Unsupported option: history/,
  );
});

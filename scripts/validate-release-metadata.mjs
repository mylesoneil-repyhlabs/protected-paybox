#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;

function assert(condition, message) {
  if (!condition) throw new Error(`Release metadata error: ${message}`);
}

async function text(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

async function json(relativePath) {
  return JSON.parse(await text(relativePath));
}

const packageJson = await json("package.json");
assert(
  packageJson.name === "protected-paybox",
  "package name must be protected-paybox.",
);
assert(
  /^\d+\.\d+\.\d+$/.test(packageJson.version),
  "package version must be release SemVer.",
);
assert(
  packageJson.private === true,
  "package must remain private so it cannot be published to npm.",
);
assert(
  packageJson.type === "module",
  "package type must remain module.",
);
assert(
  packageJson.engines?.node === ">=22",
  "Node engine must remain >=22.",
);
assert(
  !packageJson.dependencies &&
    !packageJson.devDependencies &&
    !packageJson.optionalDependencies,
  "public release must remain dependency-free.",
);

const expectedScripts = {
  test: "node --test test/*.test.js",
  doctor: "node src/cli.js doctor",
  "check:skill": "node scripts/validate-skill.mjs",
  "check:links": "node scripts/check-local-links.mjs",
  "check:release": "node scripts/validate-release-metadata.mjs",
  "check:content": "node scripts/scan-release-content.mjs . --source-tree",
  "conformance:hook": "node --test test/paybox-hook-contract.test.js",
  "release:bundle": "bash scripts/build-release-bundle.sh HEAD",
};
for (const [name, command] of Object.entries(expectedScripts)) {
  assert(
    packageJson.scripts?.[name] === command,
    `package script ${name} must be ${command}.`,
  );
}

assert(
  (await text(".nvmrc")).trim() === "22",
  ".nvmrc must match the Node 22 release floor.",
);

const constantsSource = await text("src/constants.js");
const escapedVersion = packageJson.version.replaceAll(".", "\\.");
assert(
  new RegExp(`VERSION = "${escapedVersion}"`).test(constantsSource),
  "CLI version constant must match package.json.",
);
for (const lockedBoundary of [
  "paybox_oauth_used: false",
  "paybox_contacted: false",
  "private_delta_used: false",
  "signature_requested: false",
  "transaction_broadcast: false",
  "funds_moved: false",
  "execution_available: false",
]) {
  assert(
    constantsSource.includes(lockedBoundary),
    `public boundary must retain ${lockedBoundary}.`,
  );
}

const ci = await text(".github/workflows/ci.yml");
for (const pinnedAction of [
  "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
  "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
]) {
  assert(
    ci.includes(pinnedAction),
    `CI must pin ${pinnedAction} by immutable commit SHA.`,
  );
}
assert(
  !/uses:\s+actions\/(?:checkout|setup-node)@v\d+/i.test(ci),
  "CI actions must not use mutable major-version tags.",
);

const readme = await text("README.md");
for (const requiredClaim of [
  "# Protected PayBox",
  "credential-free and simulation-only",
  "cannot prove who authored the chat message",
  "mandatory Delta check inside PayBox's signing boundary",
  "Unkeyed SHA-256 self-consistency checksum",
  "Live quote/chain/simulation",
  "PayBox signing/broadcast",
]) {
  assert(
    readme.includes(requiredClaim),
    `README must include the current boundary phrase: ${requiredClaim}`,
  );
}

const skill = await text("skills/protected-paybox/SKILL.md");
assert(
  /^name:\s*protected-paybox\s*$/m.test(skill),
  "skill identity must remain protected-paybox.",
);
assert(
  /cannot prevent an agent from bypassing/i.test(skill),
  "skill must disclose that it is not the enforcement boundary.",
);

const productionComposition = await text(
  "src/integration/production-composition.js",
);
assert(
  productionComposition.includes("PUBLIC_EXECUTION_LOCKED"),
  "production composition must preserve its explicit lock.",
);

const hookSchema = await json("config/paybox-signing-hook.v1.schema.json");
assert(
  hookSchema.$schema === "https://json-schema.org/draft/2020-12/schema",
  "signing-hook contract must use the pinned JSON Schema draft.",
);
assert(
  hookSchema.additionalProperties === false,
  "signing-hook envelope must reject unknown top-level properties.",
);
assert(
  hookSchema.properties?.schema_version?.const ===
    "protected-paybox.paybox-signing-hook.v1" &&
    constantsSource.includes(
      'PAYBOX_SIGNING_HOOK: "protected-paybox.paybox-signing-hook.v1"',
    ),
  "signing-hook schema identity must match the runtime constant.",
);

for (const requiredPath of [
  "docs/CLAIM-LEDGER.md",
  "docs/PAYBOX-SIGNING-HOOK-CONFORMANCE.md",
  "docs/PROJECT-PLAN.md",
  "docs/SECURITY-BOUNDARY.md",
  "docs/SOLANA-EVIDENCE-CONTRACT.md",
  "docs/SPRINT-LOG.md",
  "examples/paybox-tools-list.fixture.json",
  "scripts/build-release-bundle.sh",
  "scripts/install-managed-copy.mjs",
  "scripts/validate-release-bundle.sh",
  "test/install.test.js",
  "test/paybox-hook-contract.test.js",
  "test/release-content-scan.test.js",
]) {
  await access(path.join(ROOT, requiredPath));
}

for (const executable of [
  "install",
  "run",
  "scripts/build-release-bundle.sh",
  "scripts/validate-release-bundle.sh",
  "skills/protected-paybox/scripts/run",
]) {
  await access(path.join(ROOT, executable), constants.X_OK);
}

process.stdout.write(
  `Release metadata is coherent for protected-paybox v${packageJson.version}.\n`,
);

#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const INSTALL_SCHEMA = "protected-paybox.managed-install.v1";
const PRODUCT = "protected-paybox";
const SKILL_NAME = "protected-paybox";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MARKER_NAME = ".protected-paybox-install.json";
const NODE_PATH_NAME = ".protected-paybox-node";
const COPY_ENTRIES = Object.freeze([
  ".codex-plugin",
  ".mcp.json",
  "README.md",
  "config",
  "docs",
  "examples/card",
  "examples/paybox-tools-list.fixture.json",
  "examples/solana-25-usdc-intent.json",
  "examples/solana-usdc-to-sol-intent.json",
  "install",
  "package.json",
  "run",
  "schemas",
  "scripts/check-local-links.mjs",
  "scripts/install-managed-copy.mjs",
  "scripts/scan-release-content.mjs",
  "scripts/validate-skill.mjs",
  "skills/protected-paybox/SKILL.md",
  "skills/protected-paybox/agents/openai.yaml",
  "skills/protected-paybox/references/action-surface.md",
  "skills/protected-paybox/references/evidence-boundary.md",
  "skills/protected-paybox/scripts/run",
  "src",
]);
const REQUIRED_MANAGED_FILES = Object.freeze([
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "package.json",
  "run",
  "schemas/card-purchase-taxonomy.json",
  "skills/protected-paybox/SKILL.md",
  "skills/protected-paybox/scripts/run",
  "config/paybox-signing-hook.v1.schema.json",
  "docs/CLAIM-LEDGER.md",
  "docs/PAYBOX-SIGNING-HOOK-CONFORMANCE.md",
  "docs/PROJECT-PLAN.md",
  "docs/SECURITY-BOUNDARY.md",
  "docs/SOLANA-EVIDENCE-CONTRACT.md",
  "docs/SPRINT-LOG.md",
  "scripts/check-local-links.mjs",
  "scripts/scan-release-content.mjs",
  "src/cli.js",
  "src/mcp-server.js",
  "src/paybox-connection.js",
  "src/paybox-mcp-client.js",
  "src/paybox-oauth.js",
  "src/constants.js",
  "src/integration/paybox-hook-contract.js",
  "src/integration/production-composition.js",
]);

function fail(message) {
  throw new Error(`Managed install error: ${message}`);
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function normalizeAbsolute(input, label) {
  if (
    typeof input !== "string" ||
    !path.isAbsolute(input) ||
    path.resolve(input) !== input ||
    input === path.parse(input).root
  ) {
    fail(`${label} must be a safe normalized absolute path.`);
  }
  return input;
}

function assertRealDirectory(directory, label) {
  if (!existsSync(directory)) fail(`${label} does not exist.`);
  const metadata = lstatSync(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail(`${label} must be a real directory, not a symlink.`);
  }
}

function ensureRealDirectory(directory, label, { privateMode = false } = {}) {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true, mode: privateMode ? 0o700 : 0o755 });
  }
  assertRealDirectory(directory, label);
  if (privateMode) chmodSync(directory, 0o700);
}

function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath.split(path.sep).includes("..")
  ) {
    fail("payload contains an unsafe relative path.");
  }
}

function assertOutside(sourceRoot, destination, label) {
  const relative = path.relative(sourceRoot, destination);
  if (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  ) {
    fail(`${label} must be outside the source release.`);
  }
}

function resolveThroughExistingAncestor(destination) {
  const suffix = [];
  let existing = destination;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      fail("destination path has no existing ancestor.");
    }
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(realpathSync(existing), ...suffix);
}

function copyEntry(sourceRoot, destinationRoot, relativePath, files) {
  assertSafeRelativePath(relativePath);
  const sourcePath = path.join(sourceRoot, relativePath);
  const destinationPath = path.join(destinationRoot, relativePath);
  if (!existsSync(sourcePath)) {
    fail(`source payload is missing ${relativePath}.`);
  }
  const metadata = lstatSync(sourcePath);
  if (metadata.isSymbolicLink()) {
    fail(`source payload contains a symlink at ${relativePath}.`);
  }
  if (metadata.isDirectory()) {
    mkdirSync(destinationPath, { recursive: true, mode: 0o700 });
    chmodSync(destinationPath, 0o700);
    for (const child of readdirSync(sourcePath).sort()) {
      copyEntry(
        sourceRoot,
        destinationRoot,
        path.join(relativePath, child),
        files,
      );
    }
    return;
  }
  if (!metadata.isFile()) {
    fail(`source payload contains an unsupported file at ${relativePath}.`);
  }
  mkdirSync(path.dirname(destinationPath), { recursive: true, mode: 0o700 });
  copyFileSync(sourcePath, destinationPath);
  chmodSync(destinationPath, metadata.mode & 0o111 ? 0o700 : 0o600);
  files.push({
    path: relativePath.split(path.sep).join("/"),
    sha256: sha256(destinationPath),
  });
}

function collectSourceEntry(sourceRoot, relativePath, files) {
  assertSafeRelativePath(relativePath);
  const sourcePath = path.join(sourceRoot, relativePath);
  if (!existsSync(sourcePath)) {
    fail(`source payload is missing ${relativePath}.`);
  }
  const metadata = lstatSync(sourcePath);
  if (metadata.isSymbolicLink()) {
    fail(`source payload contains a symlink at ${relativePath}.`);
  }
  if (metadata.isDirectory()) {
    for (const child of readdirSync(sourcePath).sort()) {
      collectSourceEntry(sourceRoot, path.join(relativePath, child), files);
    }
    return;
  }
  if (!metadata.isFile()) {
    fail(`source payload contains an unsupported file at ${relativePath}.`);
  }
  files.push({
    path: relativePath.split(path.sep).join("/"),
    sha256: sha256(sourcePath),
  });
}

function collectSourceFiles(sourceRoot) {
  assertRealDirectory(sourceRoot, "source release");
  if (realpathSync(sourceRoot) !== sourceRoot) {
    fail("source release path must not resolve through a symlink.");
  }
  const files = [];
  for (const entry of COPY_ENTRIES) {
    collectSourceEntry(sourceRoot, entry, files);
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function collectManagedFiles(managedRoot, relativePath = "", files = []) {
  const directory = relativePath
    ? path.join(managedRoot, relativePath)
    : managedRoot;
  for (const child of readdirSync(directory).sort()) {
    if (!relativePath && (child === MARKER_NAME || child === NODE_PATH_NAME)) {
      continue;
    }
    const childRelative = relativePath
      ? path.join(relativePath, child)
      : child;
    assertSafeRelativePath(childRelative);
    const childPath = path.join(managedRoot, childRelative);
    const metadata = lstatSync(childPath);
    if (metadata.isSymbolicLink()) {
      fail(`managed payload contains a symlink at ${childRelative}.`);
    }
    if (metadata.isDirectory()) {
      collectManagedFiles(managedRoot, childRelative, files);
    } else if (metadata.isFile()) {
      files.push(childRelative.split(path.sep).join("/"));
    } else {
      fail(`managed payload contains an unsupported entry at ${childRelative}.`);
    }
  }
  return files;
}

function writeNodePath(managedRoot, nodeBinary) {
  normalizeAbsolute(nodeBinary, "Node.js executable");
  const canonicalNode = realpathSync(nodeBinary);
  const nodePathFile = path.join(managedRoot, NODE_PATH_NAME);
  if (existsSync(nodePathFile) && lstatSync(nodePathFile).isSymbolicLink()) {
    fail("refusing to replace a symlinked Node.js path file.");
  }
  const temporary = `${nodePathFile}.update.${process.pid}`;
  if (existsSync(temporary)) fail("temporary Node.js path file already exists.");
  writeFileSync(temporary, `${canonicalNode}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  renameSync(temporary, nodePathFile);
  chmodSync(nodePathFile, 0o600);
}

function readMarker(managedRoot, expectedVersion) {
  if (!VERSION_PATTERN.test(expectedVersion)) fail("release version is invalid.");
  assertRealDirectory(managedRoot, "managed version");
  const markerPath = path.join(managedRoot, MARKER_NAME);
  if (!existsSync(markerPath) || lstatSync(markerPath).isSymbolicLink()) {
    fail("managed version marker is missing or unsafe.");
  }
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    fail("managed version marker is malformed.");
  }
  if (
    marker?.schema_version !== INSTALL_SCHEMA ||
    marker?.product !== PRODUCT ||
    marker?.version !== expectedVersion ||
    !Array.isArray(marker?.files)
  ) {
    fail("managed version identity does not match this release.");
  }
  return marker;
}

function verifyManaged(managedRoot, expectedVersion) {
  const marker = readMarker(managedRoot, expectedVersion);
  const markerPaths = new Set();
  for (const file of marker.files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    ) {
      fail("managed version marker contains an invalid file entry.");
    }
    const relativePath = file.path.split("/").join(path.sep);
    assertSafeRelativePath(relativePath);
    if (markerPaths.has(file.path)) {
      fail("managed version marker contains a duplicate file.");
    }
    markerPaths.add(file.path);
    const filePath = path.join(managedRoot, relativePath);
    if (!existsSync(filePath)) {
      fail(`managed version is missing ${file.path}.`);
    }
    const metadata = lstatSync(filePath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      fail(`managed version file is unsafe at ${file.path}.`);
    }
    if (sha256(filePath) !== file.sha256) {
      fail(`managed version integrity check failed at ${file.path}.`);
    }
  }

  for (const requiredPath of REQUIRED_MANAGED_FILES) {
    if (!markerPaths.has(requiredPath)) {
      fail(`managed version marker does not bind ${requiredPath}.`);
    }
  }
  const actualPaths = collectManagedFiles(managedRoot);
  const boundPaths = [...markerPaths].sort();
  if (
    actualPaths.length !== boundPaths.length ||
    actualPaths.some((file, index) => file !== boundPaths[index])
  ) {
    fail("managed version contains a file outside the allowlisted manifest.");
  }

  const nodePathFile = path.join(managedRoot, NODE_PATH_NAME);
  if (
    !existsSync(nodePathFile) ||
    lstatSync(nodePathFile).isSymbolicLink() ||
    !lstatSync(nodePathFile).isFile()
  ) {
    fail("managed Node.js path is missing or unsafe.");
  }
  const savedNode = readFileSync(nodePathFile, "utf8").trim();
  if (!path.isAbsolute(savedNode)) {
    fail("managed Node.js path is not absolute.");
  }

  let packageMetadata;
  try {
    packageMetadata = JSON.parse(
      readFileSync(path.join(managedRoot, "package.json"), "utf8"),
    );
  } catch {
    fail("managed package metadata is malformed.");
  }
  if (
    packageMetadata?.name !== PRODUCT ||
    packageMetadata?.version !== expectedVersion
  ) {
    fail("managed package metadata does not match this release.");
  }
  const skillHeader = readFileSync(
    path.join(managedRoot, "skills", SKILL_NAME, "SKILL.md"),
    "utf8",
  );
  if (!/^name:\s*protected-paybox\s*$/m.test(skillHeader)) {
    fail("managed skill identity is invalid.");
  }
  return marker;
}

function verifySourceMatchesManaged(managedRoot, sourceRoot, version) {
  const marker = verifyManaged(managedRoot, version);
  const sourceFiles = collectSourceFiles(sourceRoot);
  if (sourceFiles.length !== marker.files.length) {
    fail("managed version does not match the source release payload.");
  }
  for (let index = 0; index < sourceFiles.length; index += 1) {
    if (
      sourceFiles[index].path !== marker.files[index].path ||
      sourceFiles[index].sha256 !== marker.files[index].sha256
    ) {
      fail("managed version does not match the source release payload.");
    }
  }
}

function createManagedCopy(sourceRoot, staging, version, nodeBinary) {
  if (!VERSION_PATTERN.test(version)) fail("release version is invalid.");
  assertOutside(sourceRoot, staging, "managed destination");
  if (existsSync(staging)) fail("managed staging destination already exists.");
  mkdirSync(staging, { mode: 0o700 });
  const files = [];
  for (const entry of COPY_ENTRIES) {
    copyEntry(sourceRoot, staging, entry, files);
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  writeFileSync(
    path.join(staging, MARKER_NAME),
    `${JSON.stringify({
      schema_version: INSTALL_SCHEMA,
      product: PRODUCT,
      version,
      files,
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  writeNodePath(staging, nodeBinary);
  verifyManaged(staging, version);
}

function runDoctor(managedRoot, nodeBinary, expectedVersion) {
  let result;
  try {
    const output = execFileSync(path.join(managedRoot, "run"), [
      "doctor",
      "--json",
    ], {
      encoding: "utf8",
      env: {
        ...process.env,
        PROTECTED_PAYBOX_NODE_BINARY: nodeBinary,
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    result = JSON.parse(output);
  } catch {
    fail("managed copy failed its offline doctor check.");
  }
  if (
    result?.ready !== true ||
    result?.version !== expectedVersion ||
    result?.execution_locked !== true ||
    result?.paybox_contacted !== false ||
    result?.network_contacted !== false
  ) {
    fail("managed copy doctor did not confirm the protected connection boundary.");
  }
}

function semverParts(version) {
  if (!VERSION_PATTERN.test(version)) fail("release version is invalid.");
  return version.split(".").map(Number);
}

function compareSemver(left, right) {
  const a = semverParts(left);
  const b = semverParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function verifyOlderTarget(target, versionsRoot, currentVersion) {
  if (!lstatSync(target).isSymbolicLink()) {
    fail("existing skill is not a verified Protected PayBox symlink.");
  }
  let resolved;
  try {
    resolved = realpathSync(target);
  } catch {
    fail("existing skill symlink is broken.");
  }
  const relative = path.relative(versionsRoot, resolved);
  const parts = relative.split(path.sep);
  if (
    parts.length !== 3 ||
    !/^v\d+\.\d+\.\d+$/.test(parts[0]) ||
    parts[1] !== "skills" ||
    parts[2] !== SKILL_NAME
  ) {
    fail("existing skill is not a managed Protected PayBox version.");
  }
  const oldVersion = parts[0].slice(1);
  if (compareSemver(oldVersion, currentVersion) >= 0) {
    fail("existing skill is not an older Protected PayBox version.");
  }
  const oldManagedRoot = path.join(versionsRoot, parts[0]);
  verifyManaged(oldManagedRoot, oldVersion);
  if (realpathSync(path.join(oldManagedRoot, "skills", SKILL_NAME)) !== resolved) {
    fail("existing skill target is not bound to its managed version.");
  }
}

function atomicSkillLink(source, target) {
  const temporary = `${target}.install.${process.pid}`;
  if (existsSync(temporary) || lstatExists(temporary)) {
    fail("temporary skill-install path already exists.");
  }
  try {
    symlinkSync(source, temporary);
    renameSync(temporary, target);
  } finally {
    if (lstatExists(temporary)) rmSync(temporary);
  }
}

function lstatExists(filePath) {
  try {
    lstatSync(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function installRelease(
  sourceInput,
  version,
  nodeInput,
  skillsRootInput,
  dataRootInput,
  upgradeText,
) {
  const sourceRoot = normalizeAbsolute(
    path.resolve(sourceInput),
    "source release",
  );
  const nodeBinary = normalizeAbsolute(nodeInput, "Node.js executable");
  const requestedSkillsRoot = normalizeAbsolute(
    skillsRootInput,
    "skills directory",
  );
  const requestedDataRoot = normalizeAbsolute(dataRootInput, "data directory");
  if (!VERSION_PATTERN.test(version)) fail("release version is invalid.");
  if (!["true", "false"].includes(upgradeText)) {
    fail("upgrade flag is invalid.");
  }
  collectSourceFiles(sourceRoot);
  assertOutside(sourceRoot, requestedDataRoot, "data directory");
  assertOutside(sourceRoot, requestedSkillsRoot, "skills directory");
  assertOutside(
    sourceRoot,
    resolveThroughExistingAncestor(requestedDataRoot),
    "data directory",
  );
  assertOutside(
    sourceRoot,
    resolveThroughExistingAncestor(requestedSkillsRoot),
    "skills directory",
  );

  ensureRealDirectory(requestedDataRoot, "data directory");
  const dataRoot = realpathSync(requestedDataRoot);
  assertOutside(sourceRoot, dataRoot, "data directory");
  const deltaRoot = path.join(dataRoot, "delta");
  ensureRealDirectory(deltaRoot, "managed delta directory", {
    privateMode: true,
  });
  const productRoot = path.join(deltaRoot, "protected-paybox");
  const stateRoot = path.join(productRoot, "state");
  const versionsRoot = path.join(productRoot, "versions");
  ensureRealDirectory(productRoot, "managed product directory", {
    privateMode: true,
  });
  ensureRealDirectory(stateRoot, "managed state directory", {
    privateMode: true,
  });
  ensureRealDirectory(versionsRoot, "managed versions directory", {
    privateMode: true,
  });
  const managedRoot = path.join(versionsRoot, `v${version}`);
  const managedSkill = path.join(managedRoot, "skills", SKILL_NAME);

  if (lstatExists(managedRoot)) {
    if (lstatSync(managedRoot).isSymbolicLink()) {
      fail(`refusing to use a symlinked managed version: ${managedRoot}`);
    }
    verifySourceMatchesManaged(managedRoot, sourceRoot, version);
    writeNodePath(managedRoot, nodeBinary);
    verifyManaged(managedRoot, version);
  } else {
    const staging = path.join(
      versionsRoot,
      `.v${version}.install.${process.pid}`,
    );
    try {
      createManagedCopy(sourceRoot, staging, version, nodeBinary);
      runDoctor(staging, nodeBinary, version);
      renameSync(staging, managedRoot);
    } finally {
      if (lstatExists(staging)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  }
  chmodSync(managedRoot, 0o700);
  runDoctor(managedRoot, nodeBinary, version);

  ensureRealDirectory(
    path.dirname(requestedSkillsRoot),
    "skills parent directory",
  );
  ensureRealDirectory(requestedSkillsRoot, "skills directory");
  const skillsRoot = realpathSync(requestedSkillsRoot);
  assertOutside(sourceRoot, skillsRoot, "skills directory");
  const target = path.join(skillsRoot, SKILL_NAME);
  let action = "Installed";
  if (lstatExists(target)) {
    let sameTarget = false;
    if (lstatSync(target).isSymbolicLink()) {
      try {
        sameTarget = realpathSync(target) === realpathSync(managedSkill);
      } catch {
        sameTarget = false;
      }
    }
    if (sameTarget) {
      action = "Already installed";
    } else if (upgradeText === "true") {
      verifyOlderTarget(target, versionsRoot, version);
      atomicSkillLink(managedSkill, target);
      action = "Upgraded";
    } else {
      fail(
        `refusing to replace the existing skill path: ${target}. ` +
        "Use --upgrade only for a verified older Protected PayBox install.",
      );
    }
  } else {
    atomicSkillLink(managedSkill, target);
  }

  process.stdout.write([
    `${action} Protected PayBox at ${target}`,
    `Managed copy: ${managedRoot}`,
    "Mode: session-only PayBox OAuth discovery plus local mandate fixtures.",
    "Remote PayBox calls, credential use, signatures, payments, swaps, broadcasts, and transaction execution remain disabled.",
    "Start a new chat and ask: Use $protected-paybox to connect my PayBox account safely and audit its authenticated tool surface.",
    "",
  ].join("\n"));
}

try {
  const [operation, ...argumentsList] = process.argv.slice(2);
  if (operation === "install" && argumentsList.length === 6) {
    installRelease(...argumentsList);
  } else if (operation === "verify" && argumentsList.length === 2) {
    verifyManaged(...argumentsList);
  } else {
    fail(
      "usage: install-managed-copy.mjs install <source> <version> <node> <skills-root> <data-root> <true|false> | verify <managed-root> <version>",
    );
  }
} catch (error) {
  process.stderr.write(`${error?.message ?? error}\n`);
  process.exitCode = 1;
}

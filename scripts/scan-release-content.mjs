#!/usr/bin/env node

import {
  lstat,
  readdir,
  readFile,
  realpath,
} from "node:fs/promises";
import path from "node:path";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;
const FORBIDDEN_FILE_NAMES = new Set([
  ".ds_store",
  ".env",
  ".protected-paybox-node",
]);
const FORBIDDEN_EXTENSIONS = new Set([
  ".jwk",
  ".key",
  ".p12",
  ".pem",
  ".pfx",
]);
const FORBIDDEN_PATH_PARTS = new Set([
  ".git",
  ".protected-paybox-runtime",
  "__macosx",
  "artifacts",
  "coverage",
  "credentials",
  "node_modules",
  "tmp",
]);
const SOURCE_TREE_SKIP = new Set([
  ".git",
  ".protected-paybox-runtime",
  "artifacts",
  "coverage",
  "node_modules",
]);

function fail(message) {
  throw new Error(`Release content scan failed: ${message}`);
}

function isPlaceholder(value) {
  const normalized = value.trim().replace(/^["']|["']$/g, "");
  return (
    normalized.length === 0 ||
    normalized.includes("${") ||
    normalized.includes("<") ||
    /^(?:dummy|example|fixture|placeholder|redacted|replace|test|your|x{4,})\b/i.test(
      normalized,
    )
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scanText(relativePath, text) {
  const privateKeyPattern = new RegExp(
    `${escapeRegExp("-----BEGIN ")}(?:EC |OPENSSH |RSA )?${escapeRegExp(
      "PRIVATE KEY-----",
    )}`,
  );
  if (privateKeyPattern.test(text)) {
    fail(`${relativePath} contains private-key material.`);
  }

  const providerPrefixes = [
    ["gh", "p_"].join(""),
    ["github_", "pat_"].join(""),
    ["sk-", "proj-"].join(""),
    ["sk-", "ant-api"].join(""),
    ["sk_", "live_"].join(""),
    ["sk_", "test_"].join(""),
    ["rk_", "live_"].join(""),
    ["rk_", "test_"].join(""),
    ["xox", "b-"].join(""),
    ["xox", "p-"].join(""),
    ["xox", "a-"].join(""),
  ];
  for (const prefix of providerPrefixes) {
    const tokenPattern = new RegExp(
      `\\b${escapeRegExp(prefix)}[A-Za-z0-9_-]{20,}\\b`,
      "g",
    );
    if (tokenPattern.test(text)) {
      fail(`${relativePath} contains a provider-token-shaped value.`);
    }
  }

  const bearerPattern = /\bBearer\s+([A-Za-z0-9._~+/=-]{24,})\b/gi;
  for (const match of text.matchAll(bearerPattern)) {
    if (!isPlaceholder(match[1])) {
      fail(`${relativePath} contains a bearer-token-shaped value.`);
    }
  }

  const jwtPattern =
    /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g;
  if (jwtPattern.test(text)) {
    fail(`${relativePath} contains a JWT-shaped value.`);
  }

  const credentialAssignmentPattern =
    /\b(?:PAYBOX|MOONPAY|COINBASE|CDP|OPENAI|GITHUB)_(?:API_?|OAUTH_?|CLIENT_?|PRIVATE_?|SESSION_?|ACCESS_?|REFRESH_?)?(?:KEY|SECRET|TOKEN)\s*[:=]\s*([^\s,;]+)/gi;
  for (const match of text.matchAll(credentialAssignmentPattern)) {
    if (!isPlaceholder(match[1])) {
      fail(`${relativePath} contains a credential-shaped assignment.`);
    }
  }

  const credentialJsonPattern =
    /["'](?:access[_-]?token|api[_-]?key|api[_-]?secret|bearer[_-]?token|client[_-]?key|client[_-]?secret|id[_-]?token|oauth[_-]?token|private[_-]?key|refresh[_-]?token|seed[_-]?phrase|session[_-]?(?:key|token)|wallet[_-]?secret)["']\s*:\s*["']([^"']{16,})["']/gi;
  for (const match of text.matchAll(credentialJsonPattern)) {
    if (!isPlaceholder(match[1])) {
      fail(`${relativePath} contains a credential-shaped JSON value.`);
    }
  }

  const oauthFormPattern =
    /\b(?:access_token|client_secret|refresh_token|session_token)\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{16,})/gi;
  for (const match of text.matchAll(oauthFormPattern)) {
    if (!isPlaceholder(match[1])) {
      fail(`${relativePath} contains an OAuth-secret-shaped value.`);
    }
  }
}

async function collectFiles(
  root,
  relativePath = "",
  { sourceTree = false } = {},
) {
  const target = relativePath === "" ? root : path.join(root, relativePath);
  const metadata = await lstat(target);
  if (metadata.isSymbolicLink()) {
    fail(`${relativePath || "."} is a symlink.`);
  }
  if (metadata.isDirectory()) {
    const files = [];
    for (const entry of (await readdir(target)).sort()) {
      if (
        sourceTree &&
        relativePath === "" &&
        SOURCE_TREE_SKIP.has(entry)
      ) {
        continue;
      }
      const child = relativePath === "" ? entry : path.join(relativePath, entry);
      files.push(...(await collectFiles(root, child, { sourceTree })));
    }
    return files;
  }
  if (!metadata.isFile()) fail(`${relativePath} is not a regular file.`);
  return [{ relativePath, size: metadata.size }];
}

const input = process.argv[2];
const mode = process.argv[3];
if (
  mode !== undefined &&
  mode !== "--managed-install" &&
  mode !== "--source-tree"
) {
  fail("unsupported scan mode.");
}
if (process.argv.length > (mode ? 4 : 3)) {
  fail("unexpected command-line arguments.");
}
const managedInstall = mode === "--managed-install";
const sourceTree = mode === "--source-tree";
if (!input) fail("provide a release root.");

const resolvedInput = path.resolve(input);
const inputMetadata = await lstat(resolvedInput);
if (!inputMetadata.isDirectory() || inputMetadata.isSymbolicLink()) {
  fail("release root must be a real directory.");
}
const root = await realpath(resolvedInput);

const files = await collectFiles(root, "", { sourceTree });
let payloadBytes = 0;
for (const file of files) {
  const normalizedPath = file.relativePath.split(path.sep).join("/");
  const lowerPath = normalizedPath.toLowerCase();
  const pathParts = lowerPath.split("/");
  const basename = pathParts.at(-1);
  const extension = path.extname(basename);

  if (
    pathParts.some((part) => FORBIDDEN_PATH_PARTS.has(part)) ||
    (FORBIDDEN_FILE_NAMES.has(basename) &&
      !(managedInstall && basename === ".protected-paybox-node")) ||
    basename.startsWith(".env.") ||
    FORBIDDEN_EXTENSIONS.has(extension) ||
    /(?:^|\/)(?:api_key|client_key|credential|secret)[^/]*\.json$/i.test(
      normalizedPath,
    )
  ) {
    fail(`${normalizedPath} has a credential- or runtime-shaped path.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    fail(`${normalizedPath} exceeds the ${MAX_FILE_BYTES}-byte file limit.`);
  }
  payloadBytes += file.size;
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    fail(`payload exceeds the ${MAX_PAYLOAD_BYTES}-byte aggregate limit.`);
  }

  const contents = await readFile(path.join(root, file.relativePath));
  if (contents.includes(0)) {
    fail(`${normalizedPath} contains binary data; release files must be text.`);
  }
  scanText(normalizedPath, contents.toString("utf8"));
}

process.stdout.write(
  `Release content scan passed: ${files.length} text files, ${payloadBytes} bytes.\n`,
);

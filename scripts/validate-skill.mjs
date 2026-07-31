#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skillDirectory = path.join(root, "skills", "protected-paybox");
const skillPath = path.join(skillDirectory, "SKILL.md");
const allowedFrontmatterKeys = new Set(["name", "description"]);

const source = await fs.readFile(skillPath, "utf8");
const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
if (!match) fail("SKILL.md must begin with YAML frontmatter.");

const frontmatter = Object.fromEntries(
  match[1].split("\n").map((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) fail(`Malformed frontmatter line: ${line}`);
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }),
);

for (const key of Object.keys(frontmatter)) {
  if (!allowedFrontmatterKeys.has(key)) fail(`Unsupported frontmatter key: ${key}`);
}
if (frontmatter.name !== "protected-paybox") {
  fail("Skill name must be protected-paybox.");
}
if (
  !frontmatter.description ||
  frontmatter.description.length > 1_024 ||
  /[<>]/.test(frontmatter.description)
) {
  fail("Skill description must be non-empty, at most 1,024 characters, and contain no angle brackets.");
}

for (const relativePath of [
  "agents/openai.yaml",
  "references/action-surface.md",
  "references/evidence-boundary.md",
  "scripts/run",
]) {
  const absolutePath = path.join(skillDirectory, relativePath);
  const stat = await fs.lstat(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${relativePath} must be a regular non-symlink file.`);
  }
}

process.stdout.write("Skill is valid.\n");

function fail(message) {
  process.stderr.write(`Skill validation failed: ${message}\n`);
  process.exit(1);
}

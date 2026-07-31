import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SCANNER = path.join(ROOT, "scripts", "scan-release-content.mjs");

async function scanFixture(t, contents, fileName = "fixture.txt") {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "protected-paybox-content-scan-"),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.dirname(path.join(directory, fileName)), {
    recursive: true,
  });
  await writeFile(path.join(directory, fileName), contents, "utf8");
  return execFileAsync(process.execPath, [SCANNER, directory]);
}

test("release scanner accepts explicit placeholders", async (t) => {
  const payload = JSON.stringify({
    [(["access", "token"].join("_"))]: "REDACTED",
    [(["client", "secret"].join("_"))]: "example-value",
  });
  const result = await scanFixture(t, payload);
  assert.match(result.stdout, /Release content scan passed/);
});

test("release scanner rejects OAuth and provider secret forms", async (t) => {
  const secret = "a".repeat(40);
  const cases = [
    `PAYBOX_${["ACCESS", "TOKEN"].join("_")}=${secret}`,
    `PAYBOX_${["REFRESH", "TOKEN"].join("_")}=${secret}`,
    JSON.stringify({ [["access", "token"].join("_")]: secret }),
    JSON.stringify({ [["refresh", "token"].join("_")]: secret }),
    JSON.stringify({ [["client", "secret"].join("_")]: secret }),
    JSON.stringify({ [["session", "token"].join("_")]: secret }),
    `${["access", "token"].join("_")}=${secret}`,
  ];

  for (const [index, payload] of cases.entries()) {
    await assert.rejects(
      scanFixture(t, payload, `case-${index}.txt`),
      /Release content scan failed/,
    );
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL = path.join(ROOT, "install");
const PACKAGE_VERSION = JSON.parse(
  await readFile(path.join(ROOT, "package.json"), "utf8"),
).version;
const DOWNLOAD_PAYLOAD = Object.freeze([
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
  "skills/protected-paybox",
  "src",
]);

function installEnvironment(home, overrides = {}) {
  return {
    ...process.env,
    HOME: home,
    CODEX_HOME: "",
    XDG_DATA_HOME: "",
    PROTECTED_PAYBOX_NODE_BINARY: process.execPath,
    PATH: "/usr/bin:/bin",
    ...overrides,
  };
}

function managedHarness(home, dataRoot = path.join(home, ".local", "share"), version = PACKAGE_VERSION) {
  return path.join(
    dataRoot,
    "delta",
    "protected-paybox",
    "versions",
    `v${version}`,
  );
}

function installedSkill(home, codexHome = "") {
  return codexHome
    ? path.join(codexHome, "skills", "protected-paybox")
    : path.join(home, ".agents", "skills", "protected-paybox");
}

async function copyDownloadedRelease(destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of DOWNLOAD_PAYLOAD) {
    await cp(path.join(ROOT, entry), path.join(destination, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
}

function olderVersion(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (patch > 0) return `${major}.${minor}.${patch - 1}`;
  if (minor > 0) return `${major}.${minor - 1}.0`;
  if (major > 0) return `${major - 1}.0.0`;
  throw new Error("A version newer than 0.0.0 is required for this test.");
}

test("fresh install creates a private managed copy and atomic skill link", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "protected-paybox-home-"));
  try {
    const { stdout, stderr } = await execFileAsync(INSTALL, [], {
      env: installEnvironment(home),
      timeout: 20_000,
    });
    const harness = managedHarness(home);
    const target = installedSkill(home);
    assert.match(stdout, /Installed Protected PayBox/);
    assert.match(stdout, /session-only PayBox OAuth discovery/i);
    assert.match(stdout, /Remote PayBox calls.*payments.*execution remain disabled/s);
    assert.equal(stderr, "");
    assert.equal(
      await realpath(target),
      await realpath(path.join(harness, "skills", "protected-paybox")),
    );
    assert.notEqual(
      await realpath(target),
      await realpath(path.join(ROOT, "skills", "protected-paybox")),
    );
    const marker = JSON.parse(
      await readFile(
        path.join(harness, ".protected-paybox-install.json"),
        "utf8",
      ),
    );
    assert.equal(marker.product, "protected-paybox");
    assert.equal(marker.version, PACKAGE_VERSION);
    assert.ok(marker.files.length > 20);
    assert.equal((await lstat(harness)).mode & 0o777, 0o700);
    assert.equal(
      (await lstat(path.join(harness, ".protected-paybox-node"))).mode & 0o777,
      0o600,
    );
    await access(
      path.join(harness, "config", "paybox-signing-hook.v1.schema.json"),
    );
    await access(
      path.join(harness, "src", "integration", "production-composition.js"),
    );
    const linkCheck = await execFileAsync(
      process.execPath,
      [path.join(harness, "scripts", "check-local-links.mjs"), harness],
      { timeout: 20_000 },
    );
    assert.match(linkCheck.stdout, /Local documentation links are valid/);
    await assert.rejects(access(path.join(harness, "test")));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("CODEX_HOME selects its skills directory", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "protected-paybox-codex-"));
  const codexHome = path.join(home, "codex-home");
  try {
    await execFileAsync(INSTALL, [], {
      env: installEnvironment(home, { CODEX_HOME: codexHome }),
      timeout: 20_000,
    });
    assert.equal(
      await realpath(installedSkill(home, codexHome)),
      await realpath(
        path.join(
          managedHarness(home),
          "skills",
          "protected-paybox",
        ),
      ),
    );
    await assert.rejects(access(installedSkill(home)));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("restricted PATH discovers bundled Codex Node and saves its absolute path", async () => {
  const home = await mkdtemp(
    path.join(os.tmpdir(), "protected-paybox-runtime-"),
  );
  try {
    const bundledNode = path.join(
      home,
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "bin",
      "node",
    );
    await mkdir(path.dirname(bundledNode), { recursive: true });
    await symlink(process.execPath, bundledNode);
    const { stdout, stderr } = await execFileAsync(INSTALL, [], {
      env: installEnvironment(home, {
        PROTECTED_PAYBOX_NODE_BINARY: "",
      }),
      timeout: 20_000,
    });
    assert.match(stdout, /Installed Protected PayBox/);
    assert.equal(stderr, "");
    assert.equal(
      (
        await readFile(
          path.join(managedHarness(home), ".protected-paybox-node"),
          "utf8",
        )
      ).trim(),
      await realpath(process.execPath),
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("installed skill survives deletion of the downloaded release and runs doctor", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "protected-paybox-download-"),
  );
  const home = path.join(temporaryRoot, "home");
  const release = path.join(temporaryRoot, "download");
  const xdgData = path.join(temporaryRoot, "data");
  try {
    await mkdir(home, { recursive: true });
    await copyDownloadedRelease(release);
    await execFileAsync(path.join(release, "install"), [], {
      env: installEnvironment(home, { XDG_DATA_HOME: xdgData }),
      timeout: 20_000,
    });
    const target = installedSkill(home);
    await rm(release, { recursive: true, force: true });
    await assert.rejects(access(release));
    const { stdout, stderr } = await execFileAsync(
      path.join(target, "scripts", "run"),
      ["doctor"],
      {
        env: {
          HOME: home,
          PATH: "/usr/bin:/bin",
        },
        timeout: 20_000,
      },
    );
    assert.match(stdout, /Mode: session-only PayBox OAuth discovery plus local fixtures/);
    assert.match(stdout, /Execution: locked; no payment, signing, swap, or broadcast adapter/);
    assert.match(stdout, /PayBox\/network contact during doctor: none/);
    assert.equal(stderr, "");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("same release is idempotent and preserves other managed versions", async () => {
  const home = await mkdtemp(
    path.join(os.tmpdir(), "protected-paybox-idempotent-"),
  );
  try {
    const otherVersion = path.join(
      path.dirname(managedHarness(home)),
      "v0.0.0",
    );
    await mkdir(otherVersion, { recursive: true });
    await writeFile(path.join(otherVersion, "keep"), "preserved\n", "utf8");
    await execFileAsync(INSTALL, [], {
      env: installEnvironment(home),
      timeout: 20_000,
    });
    const harness = managedHarness(home);
    const target = installedSkill(home);
    const planned = await execFileAsync(
      path.join(target, "scripts", "run"),
      [
        "plan",
        "--intent",
        path.join(harness, "examples", "solana-25-usdc-intent.json"),
        "--json",
      ],
      {
        env: {
          HOME: home,
          PATH: "/usr/bin:/bin",
        },
        timeout: 20_000,
      },
    );
    const plannedResult = JSON.parse(planned.stdout);
    assert.match(
      plannedResult.plan_path,
      /protected-paybox\/state\/plans\//,
    );
    assert.equal(
      (await lstat(path.join(path.dirname(harness), "..", "state"))).mode &
        0o777,
      0o700,
    );
    const firstLink = await readlink(installedSkill(home));
    const { stdout } = await execFileAsync(INSTALL, [], {
      env: installEnvironment(home),
      timeout: 20_000,
    });
    assert.match(stdout, /Already installed Protected PayBox/);
    assert.equal(await readlink(installedSkill(home)), firstLink);
    assert.equal(
      await readFile(path.join(otherVersion, "keep"), "utf8"),
      "preserved\n",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("tampered or unverified managed versions are refused", async (t) => {
  await t.test("unverified marker", async () => {
    const home = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-unverified-"),
    );
    try {
      const harness = managedHarness(home);
      await mkdir(harness, { recursive: true });
      await writeFile(
        path.join(harness, ".protected-paybox-install.json"),
        "{}\n",
        "utf8",
      );
      await assert.rejects(
        execFileAsync(INSTALL, [], {
          env: installEnvironment(home),
          timeout: 20_000,
        }),
        /managed version identity does not match this release/,
      );
      await assert.rejects(access(installedSkill(home)));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  await t.test("post-install file tamper", async () => {
    const home = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-tamper-"),
    );
    try {
      await execFileAsync(INSTALL, [], {
        env: installEnvironment(home),
        timeout: 20_000,
      });
      await writeFile(
        path.join(managedHarness(home), "README.md"),
        "tampered\n",
        "utf8",
      );
      await assert.rejects(
        execFileAsync(INSTALL, [], {
          env: installEnvironment(home),
          timeout: 20_000,
        }),
        /managed version integrity check failed at README\.md/,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

test("symlinked source and managed roots plus unsafe paths are refused", async (t) => {
  await t.test("source ancestor symlink", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-source-link-"),
    );
    const release = path.join(temporaryRoot, "release");
    const releaseLink = path.join(temporaryRoot, "release-link");
    const home = path.join(temporaryRoot, "home");
    try {
      await mkdir(home, { recursive: true });
      await copyDownloadedRelease(release);
      await symlink(release, releaseLink);
      await assert.rejects(
        execFileAsync(path.join(releaseLink, "install"), [], {
          env: installEnvironment(home),
          timeout: 20_000,
        }),
        /symlinked Protected PayBox source directory/,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  await t.test("managed product symlink", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-managed-link-"),
    );
    const home = path.join(temporaryRoot, "home");
    const dataRoot = path.join(temporaryRoot, "data");
    const outside = path.join(temporaryRoot, "outside");
    try {
      await mkdir(home, { recursive: true });
      await mkdir(path.join(dataRoot, "delta"), { recursive: true });
      await mkdir(outside, { recursive: true });
      await symlink(outside, path.join(dataRoot, "delta", "protected-paybox"));
      await assert.rejects(
        execFileAsync(INSTALL, [], {
          env: installEnvironment(home, { XDG_DATA_HOME: dataRoot }),
          timeout: 20_000,
        }),
        /managed product directory must be a real directory, not a symlink/,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  await t.test("managed delta symlink", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-delta-link-"),
    );
    const home = path.join(temporaryRoot, "home");
    const dataRoot = path.join(temporaryRoot, "data");
    const outside = path.join(temporaryRoot, "outside");
    try {
      await mkdir(home, { recursive: true });
      await mkdir(dataRoot, { recursive: true });
      await mkdir(outside, { recursive: true });
      await symlink(outside, path.join(dataRoot, "delta"));
      await assert.rejects(
        execFileAsync(INSTALL, [], {
          env: installEnvironment(home, { XDG_DATA_HOME: dataRoot }),
          timeout: 20_000,
        }),
        /managed delta directory must be a real directory, not a symlink/,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  await t.test("relative data path", async () => {
    const home = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-relative-"),
    );
    try {
      await assert.rejects(
        execFileAsync(INSTALL, [], {
          env: installEnvironment(home, { XDG_DATA_HOME: "relative-data" }),
          timeout: 20_000,
        }),
        /XDG_DATA_HOME must be a safe absolute directory/,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  await t.test("data path resolving through an ancestor into source", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-data-ancestor-"),
    );
    const release = path.join(temporaryRoot, "release");
    const releaseAlias = path.join(temporaryRoot, "release-alias");
    const home = path.join(temporaryRoot, "home");
    const insideData = path.join(release, "managed-data");
    try {
      await mkdir(home, { recursive: true });
      await copyDownloadedRelease(release);
      await mkdir(insideData);
      await symlink(release, releaseAlias);
      await assert.rejects(
        execFileAsync(path.join(release, "install"), [], {
          env: installEnvironment(home, {
            XDG_DATA_HOME: path.join(releaseAlias, "managed-data"),
          }),
          timeout: 20_000,
        }),
        /data directory must be outside the source release/,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  await t.test("skills path resolving through an ancestor into source", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "protected-paybox-skills-ancestor-"),
    );
    const release = path.join(temporaryRoot, "release");
    const releaseAlias = path.join(temporaryRoot, "release-alias");
    const home = path.join(temporaryRoot, "home");
    const insideCodex = path.join(release, "codex-home");
    try {
      await mkdir(home, { recursive: true });
      await copyDownloadedRelease(release);
      await mkdir(path.join(insideCodex, "skills"), { recursive: true });
      await symlink(release, releaseAlias);
      await assert.rejects(
        execFileAsync(path.join(release, "install"), [], {
          env: installEnvironment(home, {
            CODEX_HOME: path.join(releaseAlias, "codex-home"),
          }),
          timeout: 20_000,
        }),
        /skills directory must be outside the source release/,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});

test("unrelated existing skill is never replaced, even with --upgrade", async () => {
  const home = await mkdtemp(
    path.join(os.tmpdir(), "protected-paybox-unrelated-"),
  );
  try {
    const unrelated = path.join(home, "unrelated");
    const target = installedSkill(home);
    await mkdir(unrelated, { recursive: true });
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(
      path.join(unrelated, "SKILL.md"),
      "---\nname: unrelated\n---\n",
      "utf8",
    );
    await symlink(unrelated, target);
    await assert.rejects(
      execFileAsync(INSTALL, ["--upgrade"], {
        env: installEnvironment(home),
        timeout: 20_000,
      }),
      /existing skill is not a managed Protected PayBox version/,
    );
    assert.equal(await readlink(target), unrelated);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("--upgrade atomically retargets only a verified older managed version", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "protected-paybox-upgrade-"),
  );
  const home = path.join(temporaryRoot, "home");
  const oldRelease = path.join(temporaryRoot, "old-release");
  try {
    await mkdir(home, { recursive: true });
    await copyDownloadedRelease(oldRelease);
    const oldVersion = olderVersion(PACKAGE_VERSION);
    const oldPackage = JSON.parse(
      await readFile(path.join(oldRelease, "package.json"), "utf8"),
    );
    oldPackage.version = oldVersion;
    await writeFile(
      path.join(oldRelease, "package.json"),
      `${JSON.stringify(oldPackage, null, 2)}\n`,
      "utf8",
    );
    const oldConstantsPath = path.join(oldRelease, "src", "constants.js");
    const oldConstants = await readFile(oldConstantsPath, "utf8");
    await writeFile(
      oldConstantsPath,
      oldConstants.replace(
        /VERSION = "\d+\.\d+\.\d+"/,
        `VERSION = "${oldVersion}"`,
      ),
      "utf8",
    );
    await execFileAsync(path.join(oldRelease, "install"), [], {
      env: installEnvironment(home),
      timeout: 20_000,
    });
    const oldHarness = managedHarness(
      home,
      path.join(home, ".local", "share"),
      oldVersion,
    );
    const oldPlanOutput = await execFileAsync(
      path.join(installedSkill(home), "scripts", "run"),
      [
        "plan",
        "--intent",
        path.join(oldHarness, "examples", "solana-25-usdc-intent.json"),
        "--json",
      ],
      {
        env: { HOME: home, PATH: "/usr/bin:/bin" },
        timeout: 20_000,
      },
    );
    const oldPlan = JSON.parse(oldPlanOutput.stdout);
    const oldPassOutput = await execFileAsync(
      path.join(installedSkill(home), "scripts", "run"),
      [
        "demo",
        "--plan",
        oldPlan.plan_path,
        "--confirm-policy",
        oldPlan.plan.policy_digest,
        "--scenario",
        "pass",
        "--json",
      ],
      {
        env: { HOME: home, PATH: "/usr/bin:/bin" },
        timeout: 20_000,
      },
    );
    assert.equal(JSON.parse(oldPassOutput.stdout).record.decision.outcome, "PASS");
    assert.equal(
      await realpath(installedSkill(home)),
      await realpath(
        path.join(
          managedHarness(home, path.join(home, ".local", "share"), oldVersion),
          "skills",
          "protected-paybox",
        ),
      ),
    );
    const replayOutput = await execFileAsync(
      path.join(installedSkill(home), "scripts", "run"),
      [
        "demo",
        "--plan",
        oldPlan.plan_path,
        "--confirm-policy",
        oldPlan.plan.policy_digest,
        "--scenario",
        "pass",
        "--json",
      ],
      {
        env: { HOME: home, PATH: "/usr/bin:/bin" },
        timeout: 20_000,
      },
    );
    const replay = JSON.parse(replayOutput.stdout);
    assert.equal(replay.record.decision.outcome, "BLOCK");
    assert.equal(replay.record.decision.code, "PLAN_ALREADY_USED");

    await assert.rejects(
      execFileAsync(INSTALL, [], {
        env: installEnvironment(home),
        timeout: 20_000,
      }),
      /Use --upgrade only for a verified older Protected PayBox install/,
    );
    const { stdout } = await execFileAsync(INSTALL, ["--upgrade"], {
      env: installEnvironment(home),
      timeout: 20_000,
    });
    assert.match(stdout, /Upgraded Protected PayBox/);
    assert.equal(
      await realpath(installedSkill(home)),
      await realpath(
        path.join(
          managedHarness(home),
          "skills",
          "protected-paybox",
        ),
      ),
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(
            managedHarness(
              home,
              path.join(home, ".local", "share"),
              oldVersion,
            ),
            ".protected-paybox-install.json",
          ),
          "utf8",
        ),
      ).version,
      oldVersion,
    );
    const replayAfterUpgradeOutput = await execFileAsync(
      path.join(installedSkill(home), "scripts", "run"),
      [
        "demo",
        "--plan",
        oldPlan.plan_path,
        "--confirm-policy",
        oldPlan.plan.policy_digest,
        "--scenario",
        "pass",
        "--json",
      ],
      {
        env: { HOME: home, PATH: "/usr/bin:/bin" },
        timeout: 20_000,
      },
    );
    const replayAfterUpgrade = JSON.parse(replayAfterUpgradeOutput.stdout);
    assert.equal(replayAfterUpgrade.record.decision.outcome, "BLOCK");
    assert.equal(
      replayAfterUpgrade.record.decision.code,
      "PLAN_ALREADY_USED",
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

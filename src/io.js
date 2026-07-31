import {
  constants,
  lstat,
  link,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { GuardError } from "./errors.js";

const MAX_JSON_BYTES = 1_048_576;

export async function readJsonFile(filePath, field = "file") {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
    throw new GuardError(
      "ABSOLUTE_PATH_REQUIRED",
      `${field} must be an absolute path.`,
    );
  }
  const metadata = await lstat(filePath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new GuardError(
      "FILE_TYPE_INVALID",
      `${field} must be a regular non-symlink file.`,
    );
  }
  if (metadata.size > MAX_JSON_BYTES) {
    throw new GuardError(
      "FILE_TOO_LARGE",
      `${field} exceeds the 1 MiB limit.`,
    );
  }
  const handle = await open(
    filePath,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const openedMetadata = await handle.stat();
    if (!openedMetadata.isFile()) {
      throw new GuardError(
        "FILE_TYPE_INVALID",
        `${field} must remain a regular file after opening.`,
      );
    }
    if (openedMetadata.size > MAX_JSON_BYTES) {
      throw new GuardError(
        "FILE_TOO_LARGE",
        `${field} exceeds the 1 MiB limit.`,
      );
    }
    const text = await handle.readFile("utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new GuardError("JSON_INVALID", `${field} is not valid JSON.`);
    }
    throw error;
  } finally {
    await handle.close();
  }
}

export async function writePrivateJson(filePath, value) {
  await writePrivateText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writePrivateJsonOnce(filePath, value) {
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(directory);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const handle = await open(
    temporary,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, filePath);
    await assertPrivateRegularFile(filePath);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  } finally {
    await unlink(temporary).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export async function writePrivateText(filePath, text) {
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(directory);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, text, { mode: 0o600, flag: "wx" });
    await rename(temporary, filePath);
    await assertPrivateRegularFile(filePath);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new GuardError(
      "RUNTIME_DIRECTORY_INVALID",
      "Runtime storage must be a real directory.",
    );
  }
}

export async function assertPrivateRegularFile(filePath) {
  const metadata = await lstat(filePath);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o077) !== 0
  ) {
    throw new GuardError(
      "PRIVATE_FILE_INVALID",
      "Runtime artifacts must be regular owner-only files.",
    );
  }
}

export async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

import { createHash } from "node:crypto";
import { GuardError } from "./errors.js";

export function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new GuardError("NON_JSON_NUMBER", "Canonical JSON requires finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new GuardError(
    "NON_JSON_VALUE",
    "Canonical JSON accepts only null, booleans, finite numbers, strings, arrays, and plain objects.",
  );
}

export function digest(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function digestBytes(value) {
  if (typeof value !== "string" && !Buffer.isBuffer(value)) {
    throw new GuardError(
      "INVALID_BYTE_INPUT",
      "Byte digest input must be a string or Buffer.",
    );
  }
  return createHash("sha256").update(value).digest("hex");
}

export function isDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertPlainObject(value, field) {
  if (!isPlainObject(value)) {
    throw new GuardError("SCHEMA_INVALID", `${field} must be an object.`);
  }
  return value;
}

export function assertExactKeys(value, allowed, field) {
  assertPlainObject(value, field);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new GuardError(
      "UNKNOWN_FIELD",
      `${field} contains unsupported field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`,
    );
  }
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    throw new GuardError(
      "MISSING_FIELD",
      `${field} is missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
    );
  }
}

export function clone(value) {
  return structuredClone(value);
}

export function withoutKeys(value, keys) {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

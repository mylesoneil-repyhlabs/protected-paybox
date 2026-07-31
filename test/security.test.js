import test from "node:test";
import assert from "node:assert/strict";
import { canonicalize, digest } from "../src/canonical.js";
import { sanitize } from "../src/sanitize.js";

test("canonical JSON sorts object keys recursively", () => {
  assert.equal(
    canonicalize({ z: 1, a: { y: 2, b: 3 } }),
    '{"a":{"b":3,"y":2},"z":1}',
  );
});

test("digest is stable across key ordering", () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
});

test("sanitizer removes sensitive keys before receipt sealing", () => {
  const safe = sanitize({
    oauth_token: "must-not-remain",
    nested: { private_key: "must-not-remain", value: "ok" },
  });
  assert.deepEqual(safe, { nested: { value: "ok" } });
});

test("sanitizer redacts secret-looking provider text", () => {
  const safe = sanitize({
    message: "upstream failed with Bearer abcdefghijklmnopqrstuvwxyz012345",
  });
  assert.equal(safe.message, "[REDACTED:SECRET-LIKE]");
});

test("sanitizer preserves non-secret policy authorization semantics", () => {
  const safe = sanitize({
    authorization: {
      use_count: 1,
      expires_at: "2026-07-30T12:02:00.000Z",
    },
  });
  assert.deepEqual(safe.authorization, {
    use_count: 1,
    expires_at: "2026-07-30T12:02:00.000Z",
  });
});

test("canonical JSON rejects non-JSON values", () => {
  assert.throws(() => canonicalize({ value: undefined }), /Canonical JSON/);
});

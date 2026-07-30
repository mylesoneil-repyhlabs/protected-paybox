const SENSITIVE_KEY =
  /(authorization|cookie|credential|oauth|passphrase|private[_-]?key|secret|seed|session[_-]?key|token)$/i;

export function sanitize(value, { depth = 0 } = {}) {
  if (depth > 30) return "[REDACTED:DEPTH]";
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    if (looksSecretLike(value)) return "[REDACTED:SECRET-LIKE]";
    return value.length > 16_384 ? `${value.slice(0, 16_384)}[TRUNCATED]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 1_000).map((entry) =>
      sanitize(entry, { depth: depth + 1 }),
    );
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, entry]) => [
          key,
          sanitize(entry, { depth: depth + 1 }),
        ]),
    );
  }
  return "[REDACTED:UNSUPPORTED]";
}

function looksSecretLike(value) {
  return (
    /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/.test(value) ||
    /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/i.test(value) ||
    /\b(?:ows_key_|sk_live_|pk_live_)[A-Za-z0-9_-]{16,}/.test(value)
  );
}

import { GuardError } from "./errors.js";

const SENSITIVE_KEY_NAMES = new Set([
  "pan",
  "primaryaccountnumber",
  "cardnumber",
  "paymentcardnumber",
  "cvv",
  "cvv2",
  "cvc",
  "cvc2",
  "cardsecuritycode",
  "cardexpiry",
  "expirationdate",
  "expirydate",
  "privatekey",
  "seedphrase",
  "mnemonic",
  "password",
  "passphrase",
  "apikey",
  "authorizationheader",
  "cookie",
  "setcookie",
  "token",
  "bearertoken",
  "oauthtoken",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "clientkey",
  "clientsecret",
  "secret",
  "credential",
  "paymentcredential",
  "paymenttoken",
]);

/**
 * Reject raw credential-shaped JSON before it can enter a plan, evidence bundle,
 * record, or MCP response. Error messages identify only the field location and
 * never copy the rejected value.
 */
export function rejectSensitiveInput(value, root = "input") {
  inspect(value, [], root);
}

function inspect(value, pathParts, root) {
  if (typeof value === "string") {
    if (containsSensitiveValue(value)) {
      throw new GuardError(
        "SENSITIVE_INPUT_REJECTED",
        `Sensitive credential value is prohibited at ${formatLocation(root, pathParts)}.`,
      );
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, [...pathParts, String(index)], root));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (containsSensitiveValue(key)) {
      throw new GuardError(
        "SENSITIVE_INPUT_REJECTED",
        `Sensitive credential-shaped property name is prohibited at ${formatLocation(root, pathParts)}.`,
      );
    }
    const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    if (SENSITIVE_KEY_NAMES.has(normalized)) {
      throw new GuardError(
        "SENSITIVE_INPUT_REJECTED",
        `Sensitive credential field is prohibited at ${formatLocation(root, [...pathParts, key])}.`,
      );
    }
    inspect(item, [...pathParts, key], root);
  }
}

function containsSensitiveValue(value) {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) return true;
  if (/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i.test(value)) return true;
  if (/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/.test(value)) return true;
  if (/\bsk-[A-Za-z0-9_-]{16,}\b/.test(value)) return true;
  if (/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)) {
    return true;
  }
  const candidates =
    value.match(/(?<![A-Za-z0-9])(?:\d[ -]?){13,19}(?![A-Za-z0-9])/g) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replaceAll(/\D/g, "");
    if (digits.length === 13) {
      const possibleEpochMilliseconds = Number(digits);
      if (
        possibleEpochMilliseconds >= 1_500_000_000_000 &&
        possibleEpochMilliseconds <= 2_500_000_000_000
      ) {
        return false;
      }
    }
    return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
  });
}

function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

function formatLocation(root, pathParts) {
  return pathParts.length === 0 ? root : `${root}.${pathParts.join(".")}`;
}

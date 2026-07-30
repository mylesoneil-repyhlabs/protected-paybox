import { GuardError } from "./errors.js";

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export function parseDecimal(value, field = "value") {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new GuardError(
      "DECIMAL_INVALID",
      `${field} must be a non-negative decimal string.`,
    );
  }
  const [integerPart, fractionPart = ""] = value.split(".");
  if (integerPart.length > 36 || fractionPart.length > 18) {
    throw new GuardError(
      "DECIMAL_PRECISION_EXCEEDED",
      `${field} exceeds supported decimal precision.`,
    );
  }
  return {
    coefficient: BigInt(`${integerPart}${fractionPart}`),
    scale: fractionPart.length,
  };
}

export function isPositiveDecimal(value) {
  try {
    return parseDecimal(value).coefficient > 0n;
  } catch {
    return false;
  }
}

export function compareDecimals(left, right) {
  const a = parseDecimal(left, "left");
  const b = parseDecimal(right, "right");
  const scale = Math.max(a.scale, b.scale);
  const scaledA = toScale(a, scale);
  const scaledB = toScale(b, scale);
  return scaledA === scaledB ? 0 : scaledA < scaledB ? -1 : 1;
}

export function decimalToAtomic(value, decimals, field = "value") {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new GuardError(
      "ASSET_DECIMALS_INVALID",
      `${field} decimals must be an integer between 0 and 18.`,
    );
  }
  const parsed = parseDecimal(value, field);
  if (parsed.scale > decimals) {
    throw new GuardError(
      "AMOUNT_NOT_ALIGNED",
      `${field} has more fractional places than the asset supports.`,
    );
  }
  return (
    parsed.coefficient * 10n ** BigInt(decimals - parsed.scale)
  ).toString();
}

export function atomicToDecimal(value, decimals, field = "value") {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new GuardError(
      "ATOMIC_AMOUNT_INVALID",
      `${field} must be an unsigned integer string.`,
    );
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new GuardError(
      "ASSET_DECIMALS_INVALID",
      `${field} decimals must be an integer between 0 and 18.`,
    );
  }
  const coefficient = BigInt(value);
  if (decimals === 0) return coefficient.toString();
  const digits = coefficient.toString().padStart(decimals + 1, "0");
  const integer = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
}

export function bpsExceeded(actualBps, maximumBps) {
  return (
    !Number.isInteger(actualBps) ||
    actualBps < 0 ||
    !Number.isInteger(maximumBps) ||
    maximumBps < 0 ||
    actualBps > maximumBps
  );
}

function toScale(decimal, scale) {
  return decimal.coefficient * 10n ** BigInt(scale - decimal.scale);
}

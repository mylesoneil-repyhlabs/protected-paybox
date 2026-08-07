import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GuardError } from "../errors.js";

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const taxonomyPath = path.join(ROOT, "schemas", "card-purchase-taxonomy.json");

function loadTaxonomy() {
  let value;
  try {
    value = JSON.parse(readFileSync(taxonomyPath, "utf8"));
  } catch {
    throw new GuardError(
      "CARD_TAXONOMY_INVALID",
      "The card-purchase taxonomy could not be read as JSON.",
    );
  }
  if (
    value?.schema_version !== "protected-paybox.taxonomy.card-purchase.v1" ||
    value?.category !== "PAYBOX-CARD-PURCHASE" ||
    value?.action_type !== "commerce.card.purchase" ||
    !value.attributes ||
    !Array.isArray(value.representative_fixture_merchants)
  ) {
    throw new GuardError(
      "CARD_TAXONOMY_INVALID",
      "The card-purchase taxonomy is missing its required identity or sections.",
    );
  }
  const keys = new Set();
  const domains = new Set();
  for (const merchant of value.representative_fixture_merchants) {
    if (
      !merchant ||
      typeof merchant.key !== "string" ||
      typeof merchant.display_name !== "string" ||
      typeof merchant.domain !== "string" ||
      keys.has(merchant.key) ||
      domains.has(merchant.domain)
    ) {
      throw new GuardError(
        "CARD_TAXONOMY_INVALID",
        "Representative merchant entries must have unique keys and domains.",
      );
    }
    keys.add(merchant.key);
    domains.add(merchant.domain);
  }
  return Object.freeze(value);
}

export const CARD_TAXONOMY = loadTaxonomy();

export function representativeMerchant(key) {
  const merchant = CARD_TAXONOMY.representative_fixture_merchants.find(
    (entry) => entry.key === key,
  );
  if (!merchant) {
    throw new GuardError(
      "MERCHANT_FIXTURE_UNKNOWN",
      `No representative fixture exists for merchant: ${key}`,
    );
  }
  return { ...merchant };
}

export function listRepresentativeMerchants() {
  return CARD_TAXONOMY.representative_fixture_merchants.map((entry) => ({
    ...entry,
    status: "SIMULATED_FIXTURE_ONLY",
  }));
}

import { GuardError } from "../errors.js";

/**
 * Public builds intentionally have no production composition.
 *
 * Keep the options parameter opaque: do not destructure it, inspect properties,
 * invoke callbacks, or initialize providers before the lock is raised.
 */
export function createProductionComposition(_options = undefined) {
  throw new GuardError(
    "PUBLIC_EXECUTION_LOCKED",
    "Protected PayBox has no public signing or broadcast composition. No credentials or network clients were accessed.",
  );
}

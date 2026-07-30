export class GuardError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "GuardError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function asGuardError(error, fallbackCode = "UNEXPECTED_ERROR") {
  if (error instanceof GuardError) return error;
  return new GuardError(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
  );
}

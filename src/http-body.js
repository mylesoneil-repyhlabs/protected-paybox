import { GuardError } from "./errors.js";

export async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel();
  } catch {
    // Cleanup is best effort. Callers still fail closed on the response itself.
  }
}

export async function readBoundedUtf8(
  response,
  {
    maxBytes,
    invalidCode = "RESPONSE_INVALID",
    tooLargeCode = "RESPONSE_TOO_LARGE",
    label = "Response",
  },
) {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength)) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw new GuardError(tooLargeCode, `${label} exceeded the size limit.`);
    }
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new GuardError(invalidCode, `${label} could not be read.`);
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new GuardError(tooLargeCode, `${label} exceeded the size limit.`);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof GuardError) throw error;
    throw new GuardError(invalidCode, `${label} could not be read.`);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GuardError(invalidCode, `${label} was not valid UTF-8.`);
  }
}

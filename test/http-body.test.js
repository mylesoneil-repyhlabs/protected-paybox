import test from "node:test";
import assert from "node:assert/strict";
import { cancelResponseBody, readBoundedUtf8 } from "../src/http-body.js";

test("unused non-success response bodies can be cancelled without reading", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([65]));
      },
      cancel() {
        cancelled = true;
      },
    }),
    { status: 500 },
  );

  await cancelResponseBody(response);
  assert.equal(cancelled, true);
  assert.equal(response.bodyUsed, true);
});

test("bounded HTTP reader cancels a chunked body before buffering it completely", async () => {
  let pulls = 0;
  let cancelled = false;
  const chunk = new Uint8Array(400_000).fill(65);
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(chunk);
      if (pulls === 4) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body);
  await assert.rejects(
    readBoundedUtf8(response, {
      maxBytes: 1_000_000,
      tooLargeCode: "TEST_TOO_LARGE",
      invalidCode: "TEST_INVALID",
      label: "Test response",
    }),
    (error) => error.code === "TEST_TOO_LARGE",
  );
  assert.equal(cancelled, true);
  assert.ok(pulls < 4);
});

test("bounded HTTP reader rejects an oversized declared length and cancels the body", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array([65]));
      },
      cancel() {
        cancelled = true;
      },
    }),
    { headers: { "content-length": "1000001" } },
  );
  await assert.rejects(
    readBoundedUtf8(response, {
      maxBytes: 1_000_000,
      tooLargeCode: "TEST_TOO_LARGE",
      invalidCode: "TEST_INVALID",
      label: "Test response",
    }),
    (error) => error.code === "TEST_TOO_LARGE",
  );
  assert.equal(cancelled, true);
});

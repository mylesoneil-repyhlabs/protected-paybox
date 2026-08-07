import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYBOX_OAUTH,
  buildPayboxAuthorizationUrl,
  createPkceMaterial,
  discoverPayboxOAuth,
  exchangePayboxAuthorizationCode,
  oauthStateMatches,
  registerPayboxClient,
} from "../src/paybox-oauth.js";

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function cancellableResponse(status) {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"error":"fixture"}'));
      },
      cancel() {
        cancelled = true;
      },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
  return { response, wasCancelled: () => cancelled };
}

function validResourceMetadata(overrides = {}) {
  return {
    resource: PAYBOX_OAUTH.resource,
    authorization_servers: [PAYBOX_OAUTH.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
    ...overrides,
  };
}

function validServerMetadata(overrides = {}) {
  return {
    issuer: PAYBOX_OAUTH.issuer,
    authorization_endpoint: PAYBOX_OAUTH.authorizationEndpoint,
    token_endpoint: PAYBOX_OAUTH.tokenEndpoint,
    registration_endpoint: PAYBOX_OAUTH.registrationEndpoint,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp", "offline_access"],
    ...overrides,
  };
}

test("discovers and pins the exact PayBox OAuth resource and issuer", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === PAYBOX_OAUTH.resource) {
      return jsonResponse(
        { error: "unauthorized" },
        401,
        {
          "www-authenticate":
            `Bearer realm="paybox", resource_metadata="${PAYBOX_OAUTH.protectedResourceMetadata}"`,
        },
      );
    }
    if (url === PAYBOX_OAUTH.protectedResourceMetadata) {
      return jsonResponse(validResourceMetadata());
    }
    if (url === PAYBOX_OAUTH.authorizationServerMetadata) {
      return jsonResponse(validServerMetadata());
    }
    throw new Error("unexpected URL");
  };

  const result = await discoverPayboxOAuth({ fetchImpl });
  assert.equal(result.resource, PAYBOX_OAUTH.resource);
  assert.equal(result.scope, "mcp");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.options.redirect === "error"));
});

test("rejects OAuth metadata origin and capability drift before authorization", async () => {
  const fetchImpl = async (url) => {
    if (url === PAYBOX_OAUTH.resource) {
      return jsonResponse({}, 401, {
        "www-authenticate":
          `Bearer resource_metadata="${PAYBOX_OAUTH.protectedResourceMetadata}"`,
      });
    }
    if (url === PAYBOX_OAUTH.protectedResourceMetadata) {
      return jsonResponse(validResourceMetadata());
    }
    return jsonResponse(
      validServerMetadata({ token_endpoint: "https://example.invalid/token" }),
    );
  };
  await assert.rejects(
    discoverPayboxOAuth({ fetchImpl }),
    (error) => error.code === "PAYBOX_OAUTH_METADATA_INVALID",
  );
});

test("registers a public loopback client without confidential material", async () => {
  const redirectUri = "http://127.0.0.1:49152/callback";
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return jsonResponse(
      {
        client_id: "pbx-oauth-protected-paybox",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
      },
      201,
    );
  };
  const result = await registerPayboxClient({ redirectUri, fetchImpl });
  assert.equal(result.clientId, "pbx-oauth-protected-paybox");
  assert.deepEqual(requestBody.redirect_uris, [redirectUri]);
  assert.equal(requestBody.token_endpoint_auth_method, "none");
  assert.deepEqual(requestBody.grant_types, ["authorization_code"]);
  assert.equal(Object.hasOwn(requestBody, "client_secret"), false);
});

test("rejects DCR secrets and non-loopback redirects", async () => {
  await assert.rejects(
    registerPayboxClient({
      redirectUri: "http://localhost:49152/callback",
      fetchImpl: async () => jsonResponse({}),
    }),
    (error) => error.code === "PAYBOX_OAUTH_REDIRECT_INVALID",
  );

  const confidentialValue = ["unexpected", "confidential", "material"].join("-");
  await assert.rejects(
    registerPayboxClient({
      redirectUri: "http://127.0.0.1:49152/callback",
      fetchImpl: async () =>
        jsonResponse(
          {
            client_id: "pbx-oauth-protected-paybox",
            [["client", "secret"].join("_")]: confidentialValue,
          },
          201,
        ),
    }),
    (error) =>
      error.code === "PAYBOX_OAUTH_REGISTRATION_UNSAFE" &&
      !error.message.includes(confidentialValue),
  );
});

test("cancels every unused non-success OAuth response body", async () => {
  const challenge = cancellableResponse(200);
  await assert.rejects(
    discoverPayboxOAuth({ fetchImpl: async () => challenge.response }),
    (error) => error.code === "PAYBOX_OAUTH_CHALLENGE_INVALID",
  );
  assert.equal(challenge.wasCancelled(), true);

  const metadata = cancellableResponse(503);
  await assert.rejects(
    discoverPayboxOAuth({
      fetchImpl: async (url) => {
        if (url === PAYBOX_OAUTH.resource) {
          return jsonResponse({}, 401, {
            "www-authenticate":
              `Bearer resource_metadata="${PAYBOX_OAUTH.protectedResourceMetadata}"`,
          });
        }
        return metadata.response;
      },
    }),
    (error) => error.code === "PAYBOX_OAUTH_DISCOVERY_FAILED",
  );
  assert.equal(metadata.wasCancelled(), true);

  const registration = cancellableResponse(500);
  await assert.rejects(
    registerPayboxClient({
      redirectUri: "http://127.0.0.1:49152/callback",
      fetchImpl: async () => registration.response,
    }),
    (error) => error.code === "PAYBOX_OAUTH_REGISTRATION_FAILED",
  );
  assert.equal(registration.wasCancelled(), true);

  const exchange = cancellableResponse(500);
  await assert.rejects(
    exchangePayboxAuthorizationCode({
      clientId: "pbx-oauth-protected-paybox",
      redirectUri: "http://127.0.0.1:49152/callback",
      code: "single-use-code",
      verifier: "v".repeat(43),
      fetchImpl: async () => exchange.response,
    }),
    (error) => error.code === "PAYBOX_OAUTH_TOKEN_EXCHANGE_FAILED",
  );
  assert.equal(exchange.wasCancelled(), true);
});

test("rejects non-ASCII client identifiers, authorization codes, and access tokens", async () => {
  await assert.rejects(
    registerPayboxClient({
      redirectUri: "http://127.0.0.1:49152/callback",
      fetchImpl: async () =>
        jsonResponse({ client_id: "pbx-oauth-cliënt" }, 201),
    }),
    (error) => error.code === "PAYBOX_OAUTH_REGISTRATION_INVALID",
  );

  assert.throws(
    () =>
      buildPayboxAuthorizationUrl({
        clientId: "pbx-oauth-cliënt",
        redirectUri: "http://127.0.0.1:49152/callback",
        challenge: "c".repeat(43),
        state: "s".repeat(43),
      }),
    (error) => error.code === "PAYBOX_OAUTH_CLIENT_INVALID",
  );

  let codeFetches = 0;
  await assert.rejects(
    exchangePayboxAuthorizationCode({
      clientId: "pbx-oauth-protected-paybox",
      redirectUri: "http://127.0.0.1:49152/callback",
      code: "single-usé-code",
      verifier: "v".repeat(43),
      fetchImpl: async () => {
        codeFetches += 1;
        return jsonResponse({});
      },
    }),
    (error) => error.code === "PAYBOX_OAUTH_CODE_INVALID",
  );
  assert.equal(codeFetches, 0);

  const nonAsciiToken = `${"t".repeat(32)}é`;
  await assert.rejects(
    exchangePayboxAuthorizationCode({
      clientId: "pbx-oauth-protected-paybox",
      redirectUri: "http://127.0.0.1:49152/callback",
      code: "single-use-code",
      verifier: "v".repeat(43),
      fetchImpl: async () =>
        jsonResponse({
          access_token: nonAsciiToken,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "mcp",
        }),
    }),
    (error) =>
      error.code === "PAYBOX_OAUTH_TOKEN_RESPONSE_INVALID" &&
      !error.message.includes(nonAsciiToken),
  );
});

test("authorization URL uses fresh PKCE S256, exact resource, and mcp only", () => {
  const first = createPkceMaterial();
  const second = createPkceMaterial();
  assert.notEqual(first.verifier, second.verifier);
  assert.notEqual(first.state, second.state);
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);

  const value = buildPayboxAuthorizationUrl({
    clientId: "pbx-oauth-protected-paybox",
    redirectUri: "http://127.0.0.1:49152/callback",
    challenge: first.challenge,
    state: first.state,
  });
  const url = new URL(value);
  assert.equal(url.origin + url.pathname, PAYBOX_OAUTH.authorizationEndpoint);
  assert.equal(url.searchParams.get("scope"), "mcp");
  assert.equal(url.searchParams.has("offline_access"), false);
  assert.equal(url.searchParams.get("resource"), PAYBOX_OAUTH.resource);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), first.state);
});

test("exchanges one code with resource binding and rejects scope escalation", async () => {
  const accessToken = ["session", "only", "access", "material", "x".repeat(24)].join("-");
  let form;
  const result = await exchangePayboxAuthorizationCode({
    clientId: "pbx-oauth-protected-paybox",
    redirectUri: "http://127.0.0.1:49152/callback",
    code: "single-use-code",
    verifier: "v".repeat(43),
    fetchImpl: async (_url, options) => {
      form = new URLSearchParams(options.body);
      return jsonResponse({
        [["access", "token"].join("_")]: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "mcp",
      });
    },
  });
  assert.equal(result.accessToken, accessToken);
  assert.equal(form.get("resource"), PAYBOX_OAUTH.resource);
  assert.equal(form.get("code_verifier"), "v".repeat(43));
  assert.equal(form.has("client_secret"), false);

  const refreshMaterial = ["refresh", "must", "not", "persist"].join("-");
  await assert.rejects(
    exchangePayboxAuthorizationCode({
      clientId: "pbx-oauth-protected-paybox",
      redirectUri: "http://127.0.0.1:49152/callback",
      code: "single-use-code-two",
      verifier: "w".repeat(43),
      fetchImpl: async () =>
        jsonResponse({
          [["access", "token"].join("_")]: accessToken,
          [["refresh", "token"].join("_")]: refreshMaterial,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "mcp offline_access",
        }),
    }),
    (error) =>
      error.code === "PAYBOX_OAUTH_SCOPE_ESCALATION" &&
      !error.message.includes(refreshMaterial),
  );

  for (const invalidScope of ["", "mcp mcp", 7]) {
    await assert.rejects(
      exchangePayboxAuthorizationCode({
        clientId: "pbx-oauth-protected-paybox",
        redirectUri: "http://127.0.0.1:49152/callback",
        code: "single-use-code-three",
        verifier: "x".repeat(43),
        fetchImpl: async () =>
          jsonResponse({
            [["access", "token"].join("_")]: accessToken,
            token_type: "Bearer",
            expires_in: 3600,
            scope: invalidScope,
          }),
      }),
      (error) => error.code === "PAYBOX_OAUTH_SCOPE_ESCALATION",
    );
  }
});

test("OAuth state comparison is exact", () => {
  const state = "a".repeat(43);
  assert.equal(oauthStateMatches(state, state), true);
  assert.equal(oauthStateMatches(state, `${state}b`), false);
  assert.equal(oauthStateMatches(state, "b".repeat(43)), false);
  assert.equal(oauthStateMatches(state, null), false);
});

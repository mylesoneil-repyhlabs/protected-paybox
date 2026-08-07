import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { GuardError } from "./errors.js";
import { cancelResponseBody, readBoundedUtf8 } from "./http-body.js";

export const PAYBOX_OAUTH = Object.freeze({
  issuer: "https://api.paybox.sh",
  resource: "https://api.paybox.sh/mcp",
  protectedResourceMetadata:
    "https://api.paybox.sh/.well-known/oauth-protected-resource",
  authorizationServerMetadata:
    "https://api.paybox.sh/.well-known/oauth-authorization-server",
  authorizationEndpoint: "https://api.paybox.sh/oauth/authorize",
  tokenEndpoint: "https://api.paybox.sh/oauth/token",
  registrationEndpoint: "https://api.paybox.sh/oauth/register",
  scope: "mcp",
});

const MAX_RESPONSE_BYTES = 1_048_576;
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_MAX_LENGTH = 16_384;

export function createPkceMaterial(random = randomBytes) {
  const verifier = random(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier, "ascii")
    .digest("base64url");
  const state = random(32).toString("base64url");
  return { verifier, challenge, state };
}

export async function discoverPayboxOAuth({
  fetchImpl = globalThis.fetch,
  signal = undefined,
} = {}) {
  assertFetch(fetchImpl);
  const challenge = await request(fetchImpl, PAYBOX_OAUTH.resource, {
    method: "GET",
    headers: { accept: "application/json" },
    signal,
  });
  if (challenge.status !== 401) {
    await cancelResponseBody(challenge);
    throw oauthError(
      "PAYBOX_OAUTH_CHALLENGE_INVALID",
      "PayBox MCP did not return the required OAuth challenge.",
    );
  }
  const metadataUrl = parseResourceMetadataChallenge(
    challenge.headers.get("www-authenticate"),
  );
  await cancelResponseBody(challenge);
  if (metadataUrl !== PAYBOX_OAUTH.protectedResourceMetadata) {
    throw oauthError(
      "PAYBOX_OAUTH_RESOURCE_METADATA_INVALID",
      "PayBox advertised unexpected protected-resource metadata.",
    );
  }

  const resourceMetadata = await getJson(fetchImpl, metadataUrl, { signal });
  requireExact(resourceMetadata.resource, PAYBOX_OAUTH.resource, "resource");
  requireExactArray(
    resourceMetadata.authorization_servers,
    [PAYBOX_OAUTH.issuer],
    "authorization_servers",
  );
  requireIncludes(resourceMetadata.bearer_methods_supported, "header", "bearer method");
  requireIncludes(resourceMetadata.scopes_supported, PAYBOX_OAUTH.scope, "resource scope");

  const serverMetadata = await getJson(
    fetchImpl,
    PAYBOX_OAUTH.authorizationServerMetadata,
    { signal },
  );
  requireExact(serverMetadata.issuer, PAYBOX_OAUTH.issuer, "issuer");
  requireExact(
    serverMetadata.authorization_endpoint,
    PAYBOX_OAUTH.authorizationEndpoint,
    "authorization endpoint",
  );
  requireExact(
    serverMetadata.token_endpoint,
    PAYBOX_OAUTH.tokenEndpoint,
    "token endpoint",
  );
  requireExact(
    serverMetadata.registration_endpoint,
    PAYBOX_OAUTH.registrationEndpoint,
    "registration endpoint",
  );
  requireIncludes(serverMetadata.response_types_supported, "code", "response type");
  requireIncludes(
    serverMetadata.grant_types_supported,
    "authorization_code",
    "grant type",
  );
  requireIncludes(
    serverMetadata.code_challenge_methods_supported,
    "S256",
    "PKCE method",
  );
  requireIncludes(
    serverMetadata.token_endpoint_auth_methods_supported,
    "none",
    "token authentication method",
  );
  requireIncludes(serverMetadata.scopes_supported, PAYBOX_OAUTH.scope, "server scope");

  return {
    issuer: PAYBOX_OAUTH.issuer,
    resource: PAYBOX_OAUTH.resource,
    authorization_endpoint: PAYBOX_OAUTH.authorizationEndpoint,
    token_endpoint: PAYBOX_OAUTH.tokenEndpoint,
    registration_endpoint: PAYBOX_OAUTH.registrationEndpoint,
    scope: PAYBOX_OAUTH.scope,
  };
}

export async function registerPayboxClient({
  redirectUri,
  clientName = "Protected PayBox",
  fetchImpl = globalThis.fetch,
  signal = undefined,
} = {}) {
  assertExactLoopbackRedirect(redirectUri);
  if (
    typeof clientName !== "string" ||
    clientName.length < 1 ||
    clientName.length > 80
  ) {
    throw oauthError("PAYBOX_OAUTH_CLIENT_INVALID", "OAuth client name is invalid.");
  }
  const response = await request(fetchImpl, PAYBOX_OAUTH.registrationEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    }),
    signal,
  });
  if (response.status !== 200 && response.status !== 201) {
    await cancelResponseBody(response);
    throw oauthError(
      "PAYBOX_OAUTH_REGISTRATION_FAILED",
      `PayBox OAuth client registration failed with HTTP ${response.status}.`,
    );
  }
  const body = await parseJsonResponse(response);
  if (
    Object.hasOwn(body, "client_secret") ||
    Object.hasOwn(body, "registration_access_token")
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_REGISTRATION_UNSAFE",
      "PayBox returned unexpected confidential-client material.",
    );
  }
  if (
    typeof body.client_id !== "string" ||
    body.client_id.length < 8 ||
    body.client_id.length > 512 ||
    !/^[\x21-\x7e]+$/.test(body.client_id)
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_REGISTRATION_INVALID",
      "PayBox returned an invalid OAuth client identifier.",
    );
  }
  if (
    body.token_endpoint_auth_method !== undefined &&
    body.token_endpoint_auth_method !== "none"
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_REGISTRATION_INVALID",
      "PayBox did not register a public OAuth client.",
    );
  }
  if (
    body.redirect_uris !== undefined &&
    (!Array.isArray(body.redirect_uris) ||
      body.redirect_uris.length !== 1 ||
      body.redirect_uris[0] !== redirectUri)
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_REGISTRATION_INVALID",
      "PayBox returned a different OAuth redirect URI.",
    );
  }
  return { clientId: body.client_id };
}

export function buildPayboxAuthorizationUrl({
  clientId,
  redirectUri,
  challenge,
  state,
} = {}) {
  assertClientId(clientId);
  assertExactLoopbackRedirect(redirectUri);
  assertBase64Url(challenge, 43, 128, "PKCE challenge");
  assertBase64Url(state, 32, 128, "OAuth state");
  const url = new URL(PAYBOX_OAUTH.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", PAYBOX_OAUTH.scope);
  url.searchParams.set("resource", PAYBOX_OAUTH.resource);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangePayboxAuthorizationCode({
  clientId,
  redirectUri,
  code,
  verifier,
  fetchImpl = globalThis.fetch,
  signal = undefined,
} = {}) {
  assertClientId(clientId);
  assertExactLoopbackRedirect(redirectUri);
  if (
    typeof code !== "string" ||
    code.length < 1 ||
    code.length > 4_096 ||
    !/^[\x21-\x7e]+$/.test(code)
  ) {
    throw oauthError("PAYBOX_OAUTH_CODE_INVALID", "OAuth authorization code is invalid.");
  }
  assertBase64Url(verifier, 43, 128, "PKCE verifier");
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource: PAYBOX_OAUTH.resource,
  });
  const response = await request(fetchImpl, PAYBOX_OAUTH.tokenEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    signal,
  });
  if (response.status !== 200) {
    await cancelResponseBody(response);
    throw oauthError(
      "PAYBOX_OAUTH_TOKEN_EXCHANGE_FAILED",
      `PayBox OAuth token exchange failed with HTTP ${response.status}.`,
    );
  }
  const body = await parseJsonResponse(response);
  if (Object.hasOwn(body, "id_token")) {
    throw oauthError(
      "PAYBOX_OAUTH_TOKEN_RESPONSE_INVALID",
      "PayBox returned an unexpected identity token.",
    );
  }
  if (
    typeof body.access_token !== "string" ||
    body.access_token.length < 16 ||
    body.access_token.length > TOKEN_MAX_LENGTH ||
    !/^[\x21-\x7e]+$/.test(body.access_token) ||
    String(body.token_type).toLowerCase() !== "bearer"
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_TOKEN_RESPONSE_INVALID",
      "PayBox returned an invalid access token response.",
    );
  }
  const grantedScopes =
    body.scope === undefined || body.scope === null
      ? [PAYBOX_OAUTH.scope]
      : typeof body.scope === "string"
        ? body.scope.split(/\s+/).filter(Boolean)
        : [];
  if (
    body.refresh_token !== undefined ||
    grantedScopes.length !== 1 ||
    grantedScopes[0] !== PAYBOX_OAUTH.scope
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_SCOPE_ESCALATION",
      "PayBox returned authorization outside the requested session-only scope.",
    );
  }
  const expiresIn = Number(body.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 30 || expiresIn > 86_400) {
    throw oauthError(
      "PAYBOX_OAUTH_TOKEN_RESPONSE_INVALID",
      "PayBox returned an invalid access-token lifetime.",
    );
  }
  return {
    accessToken: body.access_token,
    expiresInSeconds: expiresIn,
    scope: PAYBOX_OAUTH.scope,
  };
}

export function oauthStateMatches(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function assertExactLoopbackRedirect(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw oauthError(
      "PAYBOX_OAUTH_REDIRECT_INVALID",
      "OAuth redirect must be an exact loopback URL.",
    );
  }
  const port = Number(url.port);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/callback" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_REDIRECT_INVALID",
      "OAuth redirect must use the exact 127.0.0.1 callback.",
    );
  }
  return value;
}

function parseResourceMetadataChallenge(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/\bresource_metadata="([^"]+)"/i);
  return match?.[1] ?? null;
}

async function getJson(fetchImpl, url, { signal } = {}) {
  const response = await request(fetchImpl, url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal,
  });
  if (response.status !== 200) {
    await cancelResponseBody(response);
    throw oauthError(
      "PAYBOX_OAUTH_DISCOVERY_FAILED",
      `PayBox OAuth discovery failed with HTTP ${response.status}.`,
    );
  }
  return parseJsonResponse(response);
}

async function request(fetchImpl, url, options) {
  assertFetch(fetchImpl);
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      redirect: "error",
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw oauthError(
      "PAYBOX_NETWORK_ERROR",
      "PayBox OAuth request failed before a response was received.",
    );
  }
  return response;
}

async function parseJsonResponse(response) {
  const text = await readBoundedUtf8(response, {
    maxBytes: MAX_RESPONSE_BYTES,
    invalidCode: "PAYBOX_RESPONSE_INVALID",
    tooLargeCode: "PAYBOX_RESPONSE_TOO_LARGE",
    label: "PayBox response",
  });
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw oauthError("PAYBOX_RESPONSE_INVALID", "PayBox returned invalid JSON.");
  }
}

function requireExact(actual, expected, field) {
  if (actual !== expected) {
    throw oauthError(
      "PAYBOX_OAUTH_METADATA_INVALID",
      `PayBox OAuth ${field} did not match the pinned value.`,
    );
  }
}

function requireExactArray(actual, expected, field) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw oauthError(
      "PAYBOX_OAUTH_METADATA_INVALID",
      `PayBox OAuth ${field} did not match the pinned value.`,
    );
  }
}

function requireIncludes(actual, expected, field) {
  if (!Array.isArray(actual) || !actual.includes(expected)) {
    throw oauthError(
      "PAYBOX_OAUTH_METADATA_INVALID",
      `PayBox OAuth metadata does not support the required ${field}.`,
    );
  }
}

function assertClientId(value) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 512 ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw oauthError("PAYBOX_OAUTH_CLIENT_INVALID", "OAuth client identifier is invalid.");
  }
}

function assertBase64Url(value, minimum, maximum, field) {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw oauthError("PAYBOX_OAUTH_MATERIAL_INVALID", `${field} is invalid.`);
  }
}

function assertFetch(value) {
  if (typeof value !== "function") {
    throw oauthError("PAYBOX_CLIENT_INVALID", "A fetch implementation is required.");
  }
}

function oauthError(code, message) {
  return new GuardError(code, message);
}

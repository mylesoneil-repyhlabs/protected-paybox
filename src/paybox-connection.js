import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { digest } from "./canonical.js";
import { VERSION } from "./constants.js";
import { GuardError } from "./errors.js";
import {
  buildPayboxAuthorizationUrl,
  createPkceMaterial,
  discoverPayboxOAuth,
  exchangePayboxAuthorizationCode,
  oauthStateMatches,
  registerPayboxClient,
} from "./paybox-oauth.js";
import {
  closePayboxMcpSession,
  discoverAuthenticatedPayboxTools,
} from "./paybox-mcp-client.js";

const DEFAULT_TIMEOUT_MS = 300_000;
const MIN_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 600_000;

export class PayboxConnection {
  #fetchImpl;
  #oauth;
  #discoverTools;
  #closeSession;
  #createServer;
  #now;
  #pkce;
  #pending = null;
  #token = null;
  #sessionId = null;
  #snapshot = null;
  #connectedAt = null;
  #lastErrorCode = null;
  #registeredClientNames = new Set();
  #tokenTimer = null;
  #generation = 0;
  #beginning = false;
  #syncing = false;

  constructor({
    fetchImpl = globalThis.fetch,
    oauth = {},
    discoverTools = discoverAuthenticatedPayboxTools,
    closeSession = closePayboxMcpSession,
    createHttpServer = createServer,
    now = () => Date.now(),
    pkce = createPkceMaterial,
  } = {}) {
    this.#fetchImpl = fetchImpl;
    this.#oauth = {
      discover: oauth.discover ?? discoverPayboxOAuth,
      register: oauth.register ?? registerPayboxClient,
      exchange: oauth.exchange ?? exchangePayboxAuthorizationCode,
    };
    this.#discoverTools = discoverTools;
    this.#closeSession = closeSession;
    this.#createServer = createHttpServer;
    this.#now = now;
    this.#pkce = pkce;
  }

  async begin({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (
      !Number.isInteger(timeoutMs) ||
      timeoutMs < MIN_TIMEOUT_MS ||
      timeoutMs > MAX_TIMEOUT_MS
    ) {
      throw connectionError(
        "PAYBOX_OAUTH_TIMEOUT_INVALID",
        "OAuth timeout must be between 60 and 600 seconds.",
      );
    }
    if (this.#beginning) {
      throw connectionError(
        "PAYBOX_CONNECTION_BUSY",
        "A PayBox connection attempt is already starting.",
      );
    }
    this.#beginning = true;
    let flowId = null;

    try {
      await this.disconnect({ remoteCleanup: true });
      const generation = ++this.#generation;
      await this.#oauth.discover({ fetchImpl: this.#fetchImpl });
      this.#assertGeneration(generation);

      const material = this.#pkce();
      flowId = randomUUID();
      const clientName = `Protected PayBox v${VERSION} (${flowId.slice(0, 8)})`;
      let settle;
      const settled = new Promise((resolve) => {
        settle = resolve;
      });
      const pending = {
        flowId,
        generation,
        verifier: material.verifier,
        challenge: material.challenge,
        state: material.state,
        clientId: null,
        clientName,
        redirectUri: null,
        expectedHost: null,
        authorizationUrl: null,
        expiresAt: this.#now() + timeoutMs,
        consumed: false,
        server: null,
        timer: null,
        settle,
        settled,
      };
      this.#pending = pending;
      pending.server = this.#createServer((request, response) => {
        void this.#handleCallback(flowId, request, response);
      });
      pending.server.on("clientError", (_error, socket) => socket.destroy());
      await listenLoopback(pending.server);
      this.#assertPending(pending);
      const address = pending.server.address();
      if (!address || typeof address === "string") {
        throw connectionError(
          "PAYBOX_OAUTH_LISTENER_FAILED",
          "OAuth callback listener did not bind to loopback.",
        );
      }
      pending.expectedHost = `127.0.0.1:${address.port}`;
      pending.redirectUri = `http://${pending.expectedHost}/callback`;
      // Registration may succeed even if its response is lost. Retain the exact
      // attempted name from this point until the user removes it in PayBox.
      this.#registeredClientNames.add(clientName);
      const registration = await this.#oauth.register({
        redirectUri: pending.redirectUri,
        clientName: pending.clientName,
        fetchImpl: this.#fetchImpl,
      });
      this.#assertPending(pending);
      pending.clientId = registration.clientId;
      pending.authorizationUrl = buildPayboxAuthorizationUrl({
        clientId: pending.clientId,
        redirectUri: pending.redirectUri,
        challenge: pending.challenge,
        state: pending.state,
      });
      pending.timer = setTimeout(() => {
        void this.#failPending(
          flowId,
          "PAYBOX_OAUTH_TIMEOUT",
          "PayBox authorization timed out; start a new connection.",
        );
      }, timeoutMs);
      pending.timer.unref?.();
      return {
        phase: "authorization_pending",
        authorization_url: pending.authorizationUrl,
        registered_client_name: pending.clientName,
        expires_at: new Date(pending.expiresAt).toISOString(),
        scope: "mcp",
        credential_handling:
          "Sign in and approve only on PayBox. Never paste a password, passkey, token, card number, or signing key into Protected PayBox.",
        recommended_grant:
          "This named client is already registered. Its mcp bearer has the authority of every selected grant. Select no credential if PayBox permits; otherwise select one least-sensitive evaluation credential, require human approval for every operation, and grant no raw secrets.",
        execution: "disabled; authenticated tools/list only",
      };
    } catch (error) {
      const typed =
        error instanceof GuardError
          ? error
          : connectionError(
              "PAYBOX_OAUTH_BEGIN_FAILED",
              "PayBox authorization could not be started.",
            );
      if (flowId) {
        await this.#failPending(flowId, typed.code, typed.message);
      } else {
        this.#lastErrorCode = typed.code;
      }
      throw typed;
    } finally {
      this.#beginning = false;
    }
  }

  async waitForAuthorization() {
    if (!this.#pending) return this.status();
    return this.#pending.settled;
  }

  async status() {
    await this.#expireTokenIfNeeded();
    if (this.#token) {
      return {
        phase: "connected",
        connected_at: this.#connectedAt,
        access_expires_at: new Date(this.#token.expiresAt).toISOString(),
        scope: "mcp",
        token_storage: "memory_only",
        authenticated_tool_snapshot: this.#snapshot
          ? summarizePayboxSnapshot(this.#snapshot)
          : null,
        execution: "disabled; no upstream tools/call implementation",
        registered_client_names_requiring_manual_revocation:
          [...this.#registeredClientNames],
      };
    }
    if (this.#pending) {
      return {
        phase: "authorization_pending",
        expires_at: new Date(this.#pending.expiresAt).toISOString(),
        scope: "mcp",
        token_storage: "memory_only",
        execution: "disabled; no upstream tools/call implementation",
        registered_client_names_requiring_manual_revocation:
          [...this.#registeredClientNames],
      };
    }
    return {
      phase: "disconnected",
      scope: null,
      token_storage: "memory_only",
      last_error_code: this.#lastErrorCode,
      registered_client_names_requiring_manual_revocation:
        [...this.#registeredClientNames],
      execution: "disabled; no upstream tools/call implementation",
    };
  }

  async syncTools() {
    await this.#expireTokenIfNeeded();
    if (!this.#token) {
      throw connectionError(
        "PAYBOX_OAUTH_REQUIRED",
        "Connect to PayBox before requesting authenticated tool discovery.",
      );
    }
    if (this.#syncing) {
      throw connectionError(
        "PAYBOX_CONNECTION_BUSY",
        "Authenticated PayBox tool discovery is already in progress.",
      );
    }
    this.#syncing = true;
    const generation = this.#generation;
    const token = this.#token;
    try {
      const priorSessionId = this.#sessionId;
      this.#sessionId = null;
      if (priorSessionId) {
        await this.#closeSession({
          accessToken: token.accessToken,
          sessionId: priorSessionId,
          fetchImpl: this.#fetchImpl,
        });
        this.#assertTokenGeneration(generation, token);
      }
      const result = await this.#discoverTools({
        accessToken: token.accessToken,
        fetchImpl: this.#fetchImpl,
      });
      if (!this.#isTokenGeneration(generation, token)) {
        await this.#closeSession({
          accessToken: token.accessToken,
          sessionId: result.sessionId,
          fetchImpl: this.#fetchImpl,
        });
        throw connectionError(
          "PAYBOX_CONNECTION_CHANGED",
          "The PayBox connection changed during authenticated discovery.",
        );
      }
      this.#sessionId = result.sessionId ?? null;
      this.#snapshot = result.snapshot;
      return {
        snapshot: result.snapshot,
        summary: summarizePayboxSnapshot(result.snapshot),
      };
    } catch (error) {
      if (!this.#isTokenGeneration(generation, token)) {
        throw connectionError(
          "PAYBOX_CONNECTION_CHANGED",
          "The PayBox connection changed during authenticated discovery.",
        );
      }
      if (error instanceof GuardError && error.code === "PAYBOX_OAUTH_EXPIRED") {
        await this.disconnect({ remoteCleanup: false });
      }
      throw error;
    } finally {
      this.#syncing = false;
    }
  }

  async disconnect({ remoteCleanup = true } = {}) {
    this.#generation += 1;
    const registeredClientNames = [...this.#registeredClientNames];
    if (this.#tokenTimer) clearTimeout(this.#tokenTimer);
    this.#tokenTimer = null;
    const pending = this.#pending;
    if (pending) {
      this.#pending = null;
      if (pending.timer) clearTimeout(pending.timer);
      await closeServer(pending.server);
      pending.verifier = "";
      pending.state = "";
      pending.settle({
        phase: "disconnected",
        reason_code: "PAYBOX_OAUTH_CANCELLED",
      });
    }
    const token = this.#token;
    const sessionId = this.#sessionId;
    this.#token = null;
    this.#sessionId = null;
    this.#snapshot = null;
    this.#connectedAt = null;
    if (remoteCleanup && token && sessionId) {
      await this.#closeSession({
        accessToken: token.accessToken,
        sessionId,
        fetchImpl: this.#fetchImpl,
      });
    }
    return {
      phase: "disconnected",
      local_token_discarded: token !== null,
      server_side_revocation: "not_available_via_advertised_oauth_metadata",
      registered_client_names_requiring_manual_revocation:
        registeredClientNames,
      next_step:
        registeredClientNames.length === 0
          ? "Use PayBox Clients to revoke any server-side grant."
          : `Revoke ${registeredClientNames.join(", ")} in PayBox Clients to end server-side access.`,
    };
  }

  async #handleCallback(flowId, request, response) {
    const pending = this.#pending;
    if (!pending || pending.flowId !== flowId || pending.consumed) {
      respond(response, 410, "This PayBox authorization session is no longer active.");
      return;
    }
    if (
      request.method !== "GET" ||
      request.headers.host !== pending.expectedHost ||
      !isLoopbackAddress(request.socket.remoteAddress)
    ) {
      respond(response, 400, "Invalid PayBox authorization callback.");
      return;
    }
    let url;
    try {
      url = new URL(request.url ?? "", `http://${pending.expectedHost}`);
    } catch {
      respond(response, 400, "Invalid PayBox authorization callback.");
      return;
    }
    if (url.pathname !== "/callback") {
      respond(response, 404, "Not found.");
      return;
    }
    const returnedState = url.searchParams.get("state");
    if (!oauthStateMatches(pending.state, returnedState)) {
      respond(response, 400, "PayBox authorization state did not match.");
      return;
    }
    if (url.searchParams.has("error")) {
      pending.consumed = true;
      respond(response, 400, "PayBox authorization was denied or cancelled.");
      await this.#failPending(
        flowId,
        "PAYBOX_OAUTH_DENIED",
        "PayBox authorization was denied or cancelled.",
      );
      return;
    }
    const code = url.searchParams.get("code");
    if (!code || code.length > 4_096) {
      respond(response, 400, "PayBox authorization code was missing or invalid.");
      return;
    }
    pending.consumed = true;
    try {
      const token = await this.#oauth.exchange({
        clientId: pending.clientId,
        redirectUri: pending.redirectUri,
        code,
        verifier: pending.verifier,
        fetchImpl: this.#fetchImpl,
      });
      if (
        this.#pending !== pending ||
        pending.generation !== this.#generation ||
        this.#now() >= pending.expiresAt
      ) {
        respond(response, 410, "This PayBox authorization session has expired.");
        if (this.#pending === pending) {
          await this.#failPending(
            flowId,
            "PAYBOX_OAUTH_TIMEOUT",
            "PayBox authorization timed out; start a new connection.",
          );
        }
        return;
      }
      const connectedAt = this.#now();
      this.#token = {
        accessToken: token.accessToken,
        expiresAt: connectedAt + token.expiresInSeconds * 1_000,
      };
      const tokenGeneration = this.#generation;
      const tokenReference = this.#token;
      this.#tokenTimer = setTimeout(() => {
        if (this.#isTokenGeneration(tokenGeneration, tokenReference)) {
          this.#lastErrorCode = "PAYBOX_OAUTH_EXPIRED";
          void this.disconnect({ remoteCleanup: false });
        }
      }, token.expiresInSeconds * 1_000);
      this.#tokenTimer.unref?.();
      this.#connectedAt = new Date(connectedAt).toISOString();
      this.#lastErrorCode = null;
      respond(
        response,
        200,
        "Protected PayBox connected for this local session. You may close this tab.",
      );
      await this.#completePending(flowId, {
        phase: "connected",
        connected_at: this.#connectedAt,
        access_expires_at: new Date(this.#token.expiresAt).toISOString(),
        scope: "mcp",
        token_storage: "memory_only",
        execution: "disabled; authenticated tools/list only",
      });
    } catch (error) {
      respond(response, 400, "PayBox authorization could not be completed.");
      await this.#failPending(
        flowId,
        error instanceof GuardError
          ? error.code
          : "PAYBOX_OAUTH_TOKEN_EXCHANGE_FAILED",
        error instanceof GuardError
          ? error.message
          : "PayBox authorization could not be completed.",
      );
    }
  }

  async #completePending(flowId, result) {
    const pending = this.#pending;
    if (!pending || pending.flowId !== flowId) return;
    this.#pending = null;
    if (pending.timer) clearTimeout(pending.timer);
    await closeServer(pending.server);
    pending.verifier = "";
    pending.state = "";
    pending.settle(result);
  }

  async #failPending(flowId, code, message) {
    const pending = this.#pending;
    if (!pending || pending.flowId !== flowId) return;
    this.#lastErrorCode = code;
    await this.#completePending(flowId, {
      phase: "disconnected",
      reason_code: code,
      message,
    });
  }

  async #expireTokenIfNeeded() {
    if (this.#token && this.#now() >= this.#token.expiresAt) {
      this.#lastErrorCode = "PAYBOX_OAUTH_EXPIRED";
      await this.disconnect({ remoteCleanup: false });
      this.#lastErrorCode = "PAYBOX_OAUTH_EXPIRED";
    }
  }

  #assertGeneration(generation) {
    if (generation !== this.#generation) {
      throw connectionError(
        "PAYBOX_CONNECTION_CHANGED",
        "The PayBox connection changed while the operation was in progress.",
      );
    }
  }

  #assertPending(pending) {
    if (
      this.#pending !== pending ||
      pending.generation !== this.#generation
    ) {
      throw connectionError(
        "PAYBOX_CONNECTION_CHANGED",
        "The PayBox connection changed while authorization was starting.",
      );
    }
  }

  #isTokenGeneration(generation, token) {
    return generation === this.#generation && this.#token === token;
  }

  #assertTokenGeneration(generation, token) {
    if (!this.#isTokenGeneration(generation, token)) {
      throw connectionError(
        "PAYBOX_CONNECTION_CHANGED",
        "The PayBox connection changed during authenticated discovery.",
      );
    }
  }
}

export function summarizePayboxSnapshot(snapshot) {
  return {
    provider_authenticated: snapshot.source.provider_authenticated,
    resource: snapshot.source.resource,
    protocol_version: snapshot.source.protocol_version,
    tool_count: snapshot.tool_count,
    observed_at: snapshot.observed_at,
    snapshot_digest: snapshot.snapshot_digest,
    risk_summary: snapshot.risk_summary,
    tools: snapshot.tools.map((tool) => {
      const nameDigest = digest(tool.name);
      return {
        tool_alias: `paybox_tool_${nameDigest.slice(0, 12)}`,
        name_digest: nameDigest,
        classification: tool.classification,
        requires_mandate_gate: tool.requires_mandate_gate,
        input_schema_digest: tool.input_schema_digest,
        output_schema_digest: tool.output_schema_digest,
        risk_flags: tool.risk_flags,
      };
    }),
    provider_tool_names_exposed_to_model: false,
    descriptions_and_schemas_exposed_to_model: false,
    remote_tool_calls_available: false,
  };
}

function listenLoopback(server) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
}

function closeServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function respond(response, status, message) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(`${message}\n`);
}

function isLoopbackAddress(value) {
  return value === "127.0.0.1" || value === "::ffff:127.0.0.1";
}

function connectionError(code, message) {
  return new GuardError(code, message);
}

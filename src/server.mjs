import http from "node:http";
import crypto from "node:crypto";
import { loadConfig } from "./config.mjs";
import { ensureDirectories } from "./policy.mjs";
import { writeAudit } from "./audit.mjs";
import { dispatch } from "./dispatcher.mjs";
import { createRuntimeInfo, snapshotRuntimeInfo } from "./runtime-info.mjs";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function checkAuth(req, config) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${config.authToken}`;
  return auth === expected;
}

export async function createServer() {
  const config = await loadConfig();
  await ensureDirectories(config);
  const runtimeInfo = createRuntimeInfo(config);

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      const out = json(200, {
        ok: true,
        service: "openclaw-host-bridge",
        mode: config.mode,
        listener: {
          host: config.listenHost,
          port: config.listenPort,
        },
        runtime: snapshotRuntimeInfo(runtimeInfo),
      });
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/bridge") {
      const out = json(404, { ok: false, error: { code: "not_found", message: "Not found" } });
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
      return;
    }
    if (!checkAuth(req, config)) {
      const out = json(401, { ok: false, error: { code: "unauthorized", message: "Unauthorized" } });
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
      return;
    }
    let body;
    try {
      body = await readJsonBody(req);
      const requestId = typeof body.request_id === "string" && body.request_id ? body.request_id : crypto.randomUUID();
      const operation = body.operation;
      const actor = body.actor && typeof body.actor === "object" ? body.actor : {};
      const result = await dispatch(config, operation, body.arguments || {});
      const auditId = await writeAudit(config, {
        request_id: requestId,
        actor,
        operation,
        ok: true,
      });
      const out = json(200, { request_id: requestId, ok: true, result, audit_id: auditId });
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
    } catch (error) {
      const requestId =
        body && typeof body.request_id === "string" && body.request_id ? body.request_id : crypto.randomUUID();
      const operation = body && typeof body.operation === "string" ? body.operation : "unknown";
      const auditId = await writeAudit(config, {
        request_id: requestId,
        actor: body?.actor && typeof body.actor === "object" ? body.actor : {},
        operation,
        ok: false,
        error: {
          code: error?.code || "internal_error",
          message: String(error?.message || error),
        },
      });
      const out = json(error?.code === "unauthorized" ? 401 : 400, {
        request_id: requestId,
        ok: false,
        error: {
          code: error?.code || "internal_error",
          message: String(error?.message || error),
        },
        audit_id: auditId,
      });
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
    }
  });

  return {
    config,
    async start() {
      await new Promise((resolve) => {
        server.listen(config.listenPort, config.listenHost, resolve);
      });
      console.log(
        JSON.stringify({
          ok: true,
          service: "openclaw-host-bridge",
          host: config.listenHost,
          port: config.listenPort,
          config: config.configPath,
          runtime: snapshotRuntimeInfo(runtimeInfo),
        }),
      );
    },
  };
}

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { executeAction } from "./prismActionRuntime";

interface ActionRequestEnvelope {
  action: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

async function readJsonBody(req: IncomingMessage): Promise<ActionRequestEnvelope> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const bodyText = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(bodyText) as ActionRequestEnvelope;
}

function writeJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function prismActionsPlugin(): Plugin {
  return {
    name: "prism-actions-plugin",
    configureServer(server) {
      server.middlewares.use("/api/actions", async (req, res) => {
        if (req.method !== "POST") {
          writeJson(res, 405, {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Method not allowed",
              retriable: false
            },
            meta: {
              serverTs: new Date().toISOString()
            }
          });
          return;
        }

        try {
          const request = await readJsonBody(req);
          const result = executeAction(request.action, request.payload ?? {}, request.requestId);
          writeJson(res, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected server error";
          writeJson(res, 500, {
            ok: false,
            error: {
              code: "INTERNAL_ERROR",
              message,
              retriable: true
            },
            meta: {
              serverTs: new Date().toISOString()
            }
          });
        }
      });
    }
  };
}

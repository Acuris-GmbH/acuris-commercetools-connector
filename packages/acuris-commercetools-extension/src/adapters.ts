/**
 * Runtime adapters that wrap `processExtension` for common deployment
 * targets. Add new runtimes here as we get pilot feedback.
 */
import { processExtension } from "./processExtension.js";
import type {
  ExtensionConfig,
  ExtensionRequest,
  ExtensionResponse,
} from "./types.js";

/**
 * Build a generic async handler `(body) => response`. The thinnest possible
 * wrapper — for runtimes that don't fit any of the named adapters below.
 */
export function buildExtensionHandler(config: ExtensionConfig = {}) {
  return async (body: ExtensionRequest): Promise<ExtensionResponse> => {
    return processExtension(body, config);
  };
}

/** Node http-style handler — works for Express, raw Node http, etc. */
export function buildNodeHttpHandler(config: ExtensionConfig = {}) {
  return async (
    req: { method?: string; body?: unknown; headers?: Record<string, unknown> },
    res: {
      statusCode: number;
      setHeader: (k: string, v: string) => void;
      end: (s?: string) => void;
    },
  ): Promise<void> => {
    if (req.method && req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end();
      return;
    }
    const body = (req.body ?? {}) as ExtensionRequest;
    try {
      const result = await processExtension(body, config);
      res.setHeader("Content-Type", "application/json");
      if (!result) {
        res.statusCode = 200;
        res.end("{}");
        return;
      }
      if ("errors" in result) {
        res.statusCode = 400;
        res.end(JSON.stringify(result));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        errors: [{ code: "General", message: err instanceof Error ? err.message : String(err) }],
      }));
    }
  };
}

/** AWS Lambda (API Gateway proxy v2) handler. */
export function buildLambdaHandler(config: ExtensionConfig = {}) {
  return async (event: { body?: string | null }): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }> => {
    const headers = { "Content-Type": "application/json" };
    let parsed: ExtensionRequest;
    try {
      parsed = JSON.parse(event.body ?? "{}") as ExtensionRequest;
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          errors: [{ code: "InvalidInput", message: "Malformed JSON body" }],
        }),
      };
    }
    try {
      const result = await processExtension(parsed, config);
      if (!result) return { statusCode: 200, headers, body: "{}" };
      if ("errors" in result) {
        return { statusCode: 400, headers, body: JSON.stringify(result) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          errors: [{ code: "General", message: err instanceof Error ? err.message : String(err) }],
        }),
      };
    }
  };
}

import type { NextApiRequest, NextApiResponse } from "next";
import {
  AcurisClient,
  suggestAddress,
  AcurisError,
  type SuggestionHit,
} from "@acuris-geo/av-sdk";
import { iso2ToIso3 } from "@acuris-geo/commercetools-checkout";

let _client: AcurisClient | null = null;
function client(): AcurisClient {
  if (!_client) {
    _client = new AcurisClient({
      apiKey: process.env.ACURIS_API_KEY,
      timeoutMs: 4000,
      userAgent: "commercetools-storefront-example/0.1.0",
    });
  }
  return _client;
}

type ErrorBody = { error: string; message?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ suggestions: SuggestionHit[] } | ErrorBody>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const country = typeof req.query.country === "string" ? req.query.country : "";
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (!country) {
    res.status(400).json({ error: "bad_request", message: "country is required" });
    return;
  }
  try {
    const suggestions = await suggestAddress(client(), q, {
      country: iso2ToIso3(country),
      limit,
      state,
    });
    res.status(200).json({ suggestions });
  } catch (err) {
    if (err instanceof AcurisError) {
      res.status(err.status ?? 502).json({
        error: err.name,
        message: err.message,
      });
      return;
    }
    res.status(500).json({ error: "internal", message: String(err) });
  }
}

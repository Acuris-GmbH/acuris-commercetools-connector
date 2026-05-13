import type { NextApiRequest, NextApiResponse } from "next";
import {
  AcurisClient,
  validateAddress,
  AcurisError,
  type AddressInput,
  type ValidationResult,
} from "@acuris-geo/av-sdk";
import { iso2ToIso3 } from "@acuris-geo/commercetools-checkout";

let _client: AcurisClient | null = null;
function client(): AcurisClient {
  if (!_client) {
    _client = new AcurisClient({
      apiKey: process.env.ACURIS_API_KEY,
      timeoutMs: 8000,
      userAgent: "commercetools-storefront-example/0.1.0",
    });
  }
  return _client;
}

type Body = { country?: string; input?: AddressInput };
type ErrorBody = { error: string; message?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValidationResult | ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const { country, input } = (req.body ?? {}) as Body;
  if (!country || !input) {
    res.status(400).json({
      error: "bad_request",
      message: "Request body must include { country, input }.",
    });
    return;
  }
  try {
    const result = await validateAddress(client(), input, {
      country: iso2ToIso3(country),
    });
    res.status(200).json(result);
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

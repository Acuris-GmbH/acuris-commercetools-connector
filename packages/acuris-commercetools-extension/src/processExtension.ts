import {
  AcurisClient,
  AcurisError,
  AcurisNotFoundError,
  validateAddress,
  type FieldedAddressInput,
  type ValidationResult,
} from "@acuris-geo/av-sdk";
import { iso2ToIso3, iso3ToIso2 } from "./iso.js";
import type {
  BaseAddress,
  CartUpdateAction,
  ExtensionConfig,
  ExtensionRequest,
  ExtensionResponse,
} from "./types.js";

/**
 * Runtime-agnostic core. Takes a parsed commercetools Extension request,
 * returns the response body the runtime should serialise as JSON.
 *
 *   const result = await processExtension(reqBody, { apiKey, mode: "rewrite" });
 *   //   undefined                → 200 with empty body (no change)
 *   //   { actions: [...] }       → 200 — commercetools applies these
 *   //   { errors: [...] }        → 400 — commercetools aborts the update
 *
 * The handler reads every `setShippingAddress`/`setBillingAddress` action in
 * the request, validates each address via Acuris, and emits replacement
 * actions (rewrite mode) or errors (reject mode). Other action types pass
 * through untouched.
 */
export async function processExtension(
  request: ExtensionRequest,
  config: ExtensionConfig = {},
  clientOverride?: AcurisClient,
): Promise<ExtensionResponse> {
  if (request.resource?.typeId !== "cart") return undefined;
  if (request.action === "Create") return undefined; // no addresses on Create
  const inbound = request.updates?.actions ?? [];
  if (inbound.length === 0) return undefined;

  const addressActions = inbound.filter(isAddressAction);
  if (addressActions.length === 0) return undefined;

  const mode = config.mode ?? "rewrite";
  const minConfidence = config.minConfidence ?? 0.8;
  const skip = new Set((config.skipCountries ?? []).map((c) => c.toUpperCase()));

  const client = clientOverride ?? buildClient(config);

  const rewrittenActions: CartUpdateAction[] = [];
  const errors: Array<{ code: string; message: string; extensionExtraInfo?: Record<string, unknown> }> = [];

  for (const action of addressActions) {
    const addr = action.address;
    if (!addr || !addr.country) continue;
    if (skip.has(addr.country.toUpperCase())) continue;

    let result: ValidationResult | undefined;
    try {
      result = await validateOne(client, addr);
    } catch (err) {
      if (err instanceof AcurisNotFoundError) {
        // No match — treated same as low confidence.
        result = undefined;
      } else if (err instanceof AcurisError) {
        // Network/upstream issue. Per commercetools guidance we should NOT
        // block carts on infra failures — log and let the inbound action stand.
        continue;
      } else {
        throw err;
      }
    }

    const confidence = result?.confidence ?? 0;
    const passed = !!result && confidence >= minConfidence;

    if (passed && mode === "rewrite") {
      const standardized = mergeStandardized(result!, addr);
      rewrittenActions.push({ action: action.action, address: standardized });
    } else if (passed && mode === "annotate") {
      // No address change; keep the inbound action as-is. (Annotation via
      // Custom Fields requires the merchant to have registered the type;
      // we leave that to a future minor release with explicit setup steps.)
      // Intentionally no push — the original action stays.
    } else if (!passed && mode === "reject") {
      errors.push({
        code: "InvalidInput",
        message:
          `Address could not be validated by Acuris (confidence ${confidence.toFixed(2)}). ` +
          `Please review the address and try again.`,
        extensionExtraInfo: {
          accuracy_type: result?.accuracy_type ?? null,
          match_score: result?.match_score ?? null,
          confidence,
        },
      });
    } else if (!passed && mode === "rewrite") {
      // No standardized form to swap in; let the original through.
    }
    // mode === "annotate" with !passed: original passes through.
  }

  if (errors.length > 0) return { errors };
  if (rewrittenActions.length > 0) return { actions: rewrittenActions };
  return undefined;
}

function isAddressAction(
  a: CartUpdateAction,
): a is { action: "setShippingAddress" | "setBillingAddress"; address?: BaseAddress | null } {
  return a.action === "setShippingAddress" || a.action === "setBillingAddress";
}

async function validateOne(
  client: AcurisClient,
  addr: BaseAddress,
): Promise<ValidationResult> {
  const input: FieldedAddressInput = {
    street: addr.streetName,
    house_number: addr.streetNumber,
    locality: addr.additionalStreetInfo,
    city: addr.city,
    state: addr.region ?? addr.state,
    postcode: addr.postalCode,
  };
  return validateAddress(client, input, {
    country: iso2ToIso3(addr.country),
  });
}

function mergeStandardized(result: ValidationResult, original: BaseAddress): BaseAddress {
  const s = result.standardized;
  return {
    ...original, // identity + extras preserved verbatim
    country: s?.country ? iso3ToIso2(s.country) : original.country,
    streetName: s?.street ?? original.streetName,
    streetNumber: s?.house_number ?? original.streetNumber,
    city: s?.city ?? original.city,
    region: s?.state ?? original.region,
    postalCode: s?.postcode ?? original.postalCode,
  };
}

function buildClient(config: ExtensionConfig): AcurisClient {
  return new AcurisClient({
    apiKey: config.apiKey ?? process.env.ACURIS_API_KEY,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs ?? 3500,
    userAgent: "acuris-commercetools-extension/0.1.0",
  });
}

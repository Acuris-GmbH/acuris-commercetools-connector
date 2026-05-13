/**
 * @acuris-geo/commercetools-extension — server-side handler for a
 * commercetools API Extension on Cart updates. Synchronously validates
 * `setShippingAddress`/`setBillingAddress` against Acuris and either
 * rewrites to the canonical address or rejects with `InvalidInput`.
 *
 *   import { buildLambdaHandler } from "@acuris-geo/commercetools-extension";
 *
 *   export const handler = buildLambdaHandler({
 *     apiKey: process.env.ACURIS_API_KEY!,
 *     mode: "rewrite",
 *     minConfidence: 0.8,
 *   });
 */
export { processExtension } from "./processExtension.js";
export {
  buildExtensionHandler,
  buildNodeHttpHandler,
  buildLambdaHandler,
} from "./adapters.js";
export { iso2ToIso3, iso3ToIso2 } from "./iso.js";

export type {
  BaseAddress,
  CartResource,
  CartUpdateAction,
  CountryCodeIso2,
  ExtensionConfig,
  ExtensionErrorResponse,
  ExtensionMode,
  ExtensionRequest,
  ExtensionResponse,
  ExtensionSuccessResponse,
} from "./types.js";

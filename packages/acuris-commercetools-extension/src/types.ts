/**
 * Types for commercetools API Extension payloads. Subset of the official
 * spec at https://docs.commercetools.com/api/projects/api-extensions —
 * we only model what the address-validation extension needs to read.
 */

/** Two-letter ISO-3166-1 alpha-2 country code, uppercase. */
export type CountryCodeIso2 = string;

/** commercetools `BaseAddress`. */
export interface BaseAddress {
  country: CountryCodeIso2;
  key?: string;
  externalId?: string;
  title?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  department?: string;
  streetName?: string;
  streetNumber?: string;
  additionalStreetInfo?: string;
  building?: string;
  apartment?: string;
  pOBox?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  state?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  fax?: string;
  additionalAddressInfo?: string;
}

/** Cart update actions we recognise. Other actions are passed through untouched. */
export type CartUpdateAction =
  | { action: "setShippingAddress"; address?: BaseAddress | null }
  | { action: "setBillingAddress"; address?: BaseAddress | null }
  | { action: string; [k: string]: unknown };

export interface CartResource {
  typeId: "cart";
  id: string;
  version?: number;
  obj?: {
    id: string;
    version: number;
    shippingAddress?: BaseAddress;
    billingAddress?: BaseAddress;
    [k: string]: unknown;
  };
}

/** Extension trigger envelope. We only handle `Update` on `cart`. */
export interface ExtensionRequest {
  action: "Create" | "Update";
  resource: CartResource;
  /** Present on Update; same shape as `CartUpdateAction[]`. */
  updates?: { actions: CartUpdateAction[] };
}

/** Successful response: replace the inbound actions with these. */
export interface ExtensionSuccessResponse {
  actions: CartUpdateAction[];
}

/** Rejecting response: abort the Cart update with one or more errors. */
export interface ExtensionErrorResponse {
  errors: Array<{
    code: "InvalidInput" | "InvalidField" | string;
    message: string;
    extensionExtraInfo?: Record<string, unknown>;
  }>;
}

export type ExtensionResponse = ExtensionSuccessResponse | ExtensionErrorResponse | undefined;

export type ExtensionMode = "rewrite" | "reject" | "annotate";

export interface ExtensionConfig {
  /** Acuris API key. Falls back to process.env.ACURIS_API_KEY. */
  apiKey?: string;
  /**
   * What to do on a low-confidence or no-match result:
   *  - "rewrite"  (default): replace the inbound address with Acuris's
   *                          standardized form. No error returned.
   *  - "reject":             return InvalidInput so commercetools aborts the Cart update.
   *  - "annotate":           leave the address as-is but attach Custom Fields
   *                          recording the Acuris confidence + accuracy_type.
   */
  mode?: ExtensionMode;
  /** Below this confidence we treat it as a no-match. Default 0.8. */
  minConfidence?: number;
  /** Override the Acuris base URL (defaults to https://api.acuris-geo.com). */
  baseUrl?: string;
  /** Per-call timeout, ms. Default 3500 — commercetools enforces 2s default / 10s max. */
  timeoutMs?: number;
  /** Skip validation for these ISO-2 country codes (e.g. low-coverage). */
  skipCountries?: string[];
}

/**
 * @acuris-geo/commercetools-checkout — React components for integrating
 * Acuris Address Validation & Geocoding into commercetools storefronts.
 *
 *   import { AcurisAddressInput, toBaseAddress } from "@acuris-geo/commercetools-checkout";
 *
 * Components NEVER call api.acuris-geo.com directly. They call YOUR proxy
 * endpoints (see `AcurisEndpoints`), which forward to Acuris with the API
 * key attached server-side.
 */
export { AcurisAddressInput, hitToDisplay } from "./AcurisAddressInput.js";
export { AcurisAddressValidator } from "./AcurisAddressValidator.js";
export { useAcurisValidation } from "./useAcurisValidation.js";
export { useAcurisSuggest } from "./useAcurisSuggest.js";
export {
  postValidateViaProxy,
  getSuggestViaProxy,
  adaptWireToSdk,
} from "./transport.js";

export {
  toAcurisInput,
  toBaseAddress,
  suggestionToBaseAddress,
  normalizeHouseNumber,
} from "./boundary.js";

export { iso2ToIso3, iso3ToIso2 } from "./iso.js";

export type {
  AcurisAddressInputProps,
  AcurisAddressValidatorProps,
  AcurisEndpoints,
  BaseAddress,
  CountryCodeIso2,
  SuggestionHit,
  ValidationResult,
  ValidatorRenderState,
} from "./types.js";

export type {
  UseAcurisValidationArgs,
  UseAcurisValidationReturn,
  ValidationStatus,
} from "./useAcurisValidation.js";

export type {
  UseAcurisSuggestArgs,
  UseAcurisSuggestReturn,
} from "./useAcurisSuggest.js";

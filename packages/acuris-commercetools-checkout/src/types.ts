/**
 * Public types for @acuris-geo/commercetools-checkout.
 *
 * Field names mirror commercetools's `BaseAddress` shape verbatim
 * (https://docs.commercetools.com/api/types#address). The connector ships
 * mappers that translate between this shape and Acuris's wire format —
 * the mapping is the work the connector exists to do.
 */
import type { SuggestionHit, ValidationResult } from "@acuris-geo/av-sdk";
export type { SuggestionHit, ValidationResult };

/** ISO-3166-1 alpha-2 country code, uppercase (e.g. "DE", "US", "NL"). */
export type CountryCodeIso2 = string;

/**
 * commercetools `BaseAddress`. All fields are optional in the API except
 * when used as a draft for resource creation; we keep them optional here.
 * Identity fields (firstName/lastName/…) are merchant-supplied — Acuris
 * doesn't touch them.
 */
export interface BaseAddress {
  /** ISO-3166-1 alpha-2, e.g. "DE". */
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
  /** Lowercase `p` — matches commercetools spelling. */
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

export interface AcurisEndpoints {
  /** POST endpoint on your backend that proxies to Acuris /validate. */
  validate: string;
  /** GET endpoint that proxies to Acuris /suggest. Optional — omit to disable typeahead. */
  suggest?: string;
}

export interface AcurisAddressInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "onSelect"> {
  endpoints: AcurisEndpoints;
  /** ISO-2 country code (commercetools-native: "DE", "US", "NL"). */
  country: CountryCodeIso2;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (hit: SuggestionHit) => void;
  /** Debounce window before firing a suggest request, in ms. Default 200. */
  debounceMs?: number;
  /** Minimum query length before suggesting. Default 3. */
  minQueryLength?: number;
  /** Limit on suggestions returned. Default 5. */
  limit?: number;
  /** Optional state/region bias (commercetools `region` value). */
  region?: string;
  renderSuggestion?: (hit: SuggestionHit, index: number) => React.ReactNode;
  suggestionsClassName?: string;
}

export interface AcurisAddressValidatorProps {
  endpoints: AcurisEndpoints;
  country: CountryCodeIso2;
  /** A `BaseAddress` (preferred — sends the structured form to Acuris) or a free-text string. */
  address: BaseAddress | string;
  trigger?: "blur" | "submit" | "manual";
  children: (state: ValidatorRenderState) => React.ReactNode;
}

export interface ValidatorRenderState {
  status: "idle" | "loading" | "ok" | "error";
  result?: ValidationResult;
  error?: Error;
  validate: () => Promise<ValidationResult | undefined>;
  formProps: {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLFormElement>) => void;
  };
}

/**
 * Boundary mappers between commercetools `BaseAddress` and Acuris's
 * wire format. These are the load-bearing piece of this connector:
 * commercetools speaks ISO-2 + (streetName/streetNumber/additionalStreetInfo)
 * while Acuris speaks ISO-3 + (street/house_number/locality).
 *
 * Both directions preserve merchant-supplied identity fields (name, phone,
 * company, …) verbatim — Acuris doesn't return them.
 */
import type { FieldedAddressInput, ValidationResult } from "@acuris-geo/av-sdk";
import { iso3ToIso2 } from "./iso.js";
import type { BaseAddress, SuggestionHit } from "./types.js";

/**
 * commercetools BaseAddress → Acuris fielded input.
 *
 *   { country: "DE", streetName: "Hammanstr.", streetNumber: "1",
 *     postalCode: "67549", city: "Worms" }
 *     →
 *   { street: "Hammanstr.", house_number: "1",
 *     postcode: "67549", city: "Worms" }
 *
 * Country is NOT included in the output — it travels separately at the
 * top of the validate-proxy wire payload so the proxy can do the
 * ISO-2 → ISO-3 conversion in one place.
 */
export function toAcurisInput(addr: BaseAddress): FieldedAddressInput {
  return {
    street: addr.streetName,
    house_number: addr.streetNumber,
    locality: addr.additionalStreetInfo,
    city: addr.city,
    state: addr.region ?? addr.state,
    postcode: addr.postalCode,
  };
}

/**
 * Acuris validate result → commercetools BaseAddress.
 *
 * `base` lets the caller carry through identity fields (name, phone, company,
 * apartment/building/pOBox) that Acuris doesn't see. The standardized
 * address from Acuris always wins on locale fields; the base wins on identity.
 */
export function toBaseAddress(
  result: ValidationResult,
  base: Partial<BaseAddress> = {},
): BaseAddress {
  const s = result.standardized;
  // Treat empty string as "missing" so a degraded Acuris response falls
  // through to the caller-supplied base.country.
  const country = s?.country || base.country || "";
  return {
    country: iso3ToIso2(country),
    streetName: s?.street ?? base.streetName,
    streetNumber: s?.house_number ?? base.streetNumber,
    additionalStreetInfo: base.additionalStreetInfo,
    building: base.building,
    apartment: base.apartment,
    pOBox: base.pOBox,
    city: s?.city ?? base.city,
    region: s?.state ?? base.region,
    state: base.state,
    postalCode: s?.postcode ?? base.postalCode,
    // Identity pass-through.
    key: base.key,
    externalId: base.externalId,
    title: base.title,
    salutation: base.salutation,
    firstName: base.firstName,
    lastName: base.lastName,
    company: base.company,
    department: base.department,
    phone: base.phone,
    mobile: base.mobile,
    email: base.email,
    fax: base.fax,
    additionalAddressInfo: base.additionalAddressInfo,
  };
}

/**
 * Acuris suggestion hit → commercetools BaseAddress. Used when a buyer
 * picks from the typeahead and the merchant wants to seed cart fields
 * without a follow-up /validate call.
 */
export function suggestionToBaseAddress(
  hit: SuggestionHit,
  base: Partial<BaseAddress> = {},
): BaseAddress {
  return {
    country: iso3ToIso2(hit.country ?? base.country ?? ""),
    streetName: hit.street ?? base.streetName,
    streetNumber: hit.house_number ?? base.streetNumber,
    additionalStreetInfo: base.additionalStreetInfo,
    building: base.building,
    apartment: base.apartment,
    pOBox: base.pOBox,
    city: hit.city ?? base.city,
    region: hit.state ?? base.region,
    state: base.state,
    postalCode: hit.postcode ?? base.postalCode,
    key: base.key,
    externalId: base.externalId,
    title: base.title,
    salutation: base.salutation,
    firstName: base.firstName,
    lastName: base.lastName,
    company: base.company,
    department: base.department,
    phone: base.phone,
    mobile: base.mobile,
    email: base.email,
    fax: base.fax,
    additionalAddressInfo: base.additionalAddressInfo,
  };
}

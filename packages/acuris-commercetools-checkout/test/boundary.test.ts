import { describe, expect, it } from "vitest";
import type { ValidationResult } from "@acuris-geo/av-sdk";
import {
  toAcurisInput,
  toBaseAddress,
  suggestionToBaseAddress,
} from "../src/boundary.js";

describe("toAcurisInput", () => {
  it("maps commercetools fields to Acuris fielded input", () => {
    const r = toAcurisInput({
      country: "DE",
      streetName: "Hammanstr.",
      streetNumber: "1",
      additionalStreetInfo: "Hinterhaus",
      postalCode: "67549",
      city: "Worms",
      region: "RP",
    });
    expect(r).toEqual({
      street: "Hammanstr.",
      house_number: "1",
      locality: "Hinterhaus",
      city: "Worms",
      state: "RP",
      postcode: "67549",
    });
  });

  it("does not emit country (travels separately on the wire)", () => {
    const r = toAcurisInput({ country: "DE", streetName: "X" });
    expect("country" in r).toBe(false);
  });

  it("prefers region over state when both are set", () => {
    const r = toAcurisInput({ country: "US", region: "CA", state: "California" });
    expect(r.state).toBe("CA");
  });

  it("falls back to state when region is absent", () => {
    const r = toAcurisInput({ country: "US", state: "CA" });
    expect(r.state).toBe("CA");
  });
});

describe("toBaseAddress", () => {
  const result: ValidationResult = {
    accuracy_type: "rooftop",
    confidence: 1.0,
    match_type: "rooftop",
    match_score: 1,
    input_corrected: false,
    match_components: { city: true, house_number: true, state: false, street: true, zip: true },
    standardized: {
      country: "deu",
      streetName: undefined as unknown as string | undefined,
      street: "Hammanstr.",
      house_number: "1",
      city: "Worms",
      postcode: "67549",
      state: undefined,
      formatted_address: "Hammanstr. 1\n67549 Worms\nGERMANY",
    },
  };

  it("maps ISO-3 country back to ISO-2 uppercase", () => {
    expect(toBaseAddress(result).country).toBe("DE");
  });

  it("uses standardized street/streetNumber/postalCode/city", () => {
    const a = toBaseAddress(result);
    expect(a.streetName).toBe("Hammanstr.");
    expect(a.streetNumber).toBe("1");
    expect(a.postalCode).toBe("67549");
    expect(a.city).toBe("Worms");
  });

  it("preserves identity fields from the base address", () => {
    const a = toBaseAddress(result, {
      firstName: "Jane",
      lastName: "Brand",
      company: "Brand GmbH",
      phone: "+49 1234",
      apartment: "3B",
    });
    expect(a.firstName).toBe("Jane");
    expect(a.lastName).toBe("Brand");
    expect(a.company).toBe("Brand GmbH");
    expect(a.phone).toBe("+49 1234");
    expect(a.apartment).toBe("3B");
  });

  it("falls back to base.country when standardized has no country", () => {
    const partial: ValidationResult = {
      ...result,
      standardized: { ...result.standardized!, country: "" as unknown as string },
    };
    expect(toBaseAddress(partial, { country: "FR" }).country).toBe("FR");
  });
});

describe("suggestionToBaseAddress", () => {
  it("maps a suggestion hit into a commercetools BaseAddress", () => {
    const a = suggestionToBaseAddress(
      {
        country: "deu",
        street: "Hammanstr.",
        house_number: "1",
        city: "Worms",
        postcode: "67549",
        lat: 49.6316,
        lng: 8.3464,
      },
      { firstName: "Jane" },
    );
    expect(a.country).toBe("DE");
    expect(a.streetName).toBe("Hammanstr.");
    expect(a.streetNumber).toBe("1");
    expect(a.postalCode).toBe("67549");
    expect(a.city).toBe("Worms");
    expect(a.firstName).toBe("Jane");
  });
});

import { describe, expect, it } from "vitest";
import { iso2ToIso3, iso3ToIso2 } from "../src/iso.js";

describe("iso mapping (extension copy — must match checkout copy)", () => {
  it("US/DE/NL round-trip", () => {
    for (const c of ["US", "DE", "NL", "GB", "FR", "BR"]) {
      expect(iso3ToIso2(iso2ToIso3(c))).toBe(c);
    }
  });
  it("graceful passthrough for unknown codes", () => {
    expect(iso2ToIso3("XX")).toBe("xx");
    expect(iso3ToIso2("zzz")).toBe("ZZZ");
  });
});

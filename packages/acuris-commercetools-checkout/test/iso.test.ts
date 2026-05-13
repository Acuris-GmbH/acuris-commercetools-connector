import { describe, expect, it } from "vitest";
import { iso2ToIso3, iso3ToIso2 } from "../src/iso.js";

describe("iso2ToIso3", () => {
  it("maps the demo set correctly", () => {
    expect(iso2ToIso3("US")).toBe("usa");
    expect(iso2ToIso3("DE")).toBe("deu");
    expect(iso2ToIso3("NL")).toBe("nld");
  });
  it("handles lowercase input", () => {
    expect(iso2ToIso3("de")).toBe("deu");
  });
  it("returns lowercased original for unknown codes", () => {
    expect(iso2ToIso3("XX")).toBe("xx");
  });
  it("returns empty string for empty input", () => {
    expect(iso2ToIso3("")).toBe("");
  });
});

describe("iso3ToIso2", () => {
  it("inverts the mapping", () => {
    expect(iso3ToIso2("usa")).toBe("US");
    expect(iso3ToIso2("deu")).toBe("DE");
    expect(iso3ToIso2("nld")).toBe("NL");
  });
  it("returns uppercased original for unknown codes", () => {
    expect(iso3ToIso2("zzz")).toBe("ZZZ");
  });
  it("returns empty for empty", () => {
    expect(iso3ToIso2("")).toBe("");
  });
});

describe("round-trip", () => {
  it.each(["US", "DE", "NL", "GB", "JP", "BR", "SE", "ZA", "AU"])(
    "%s → ISO-3 → back to %s",
    (code) => {
      expect(iso3ToIso2(iso2ToIso3(code))).toBe(code);
    },
  );
});

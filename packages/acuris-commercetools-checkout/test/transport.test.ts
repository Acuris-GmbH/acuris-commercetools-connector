import { describe, expect, it, vi, afterEach } from "vitest";
import {
  postValidateViaProxy,
  getSuggestViaProxy,
  adaptWireToSdk,
} from "../src/transport.js";

describe("postValidateViaProxy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends BaseAddress mapped to Acuris fielded input, country stays ISO-2 on the wire", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await postValidateViaProxy("/api/v", "DE", {
      country: "DE",
      streetName: "Hammanstr.",
      streetNumber: "1",
      city: "Worms",
      postalCode: "67549",
    });
    const init = spy.mock.calls[0]![1]!;
    const body = JSON.parse(init.body as string);
    expect(body.country).toBe("DE");
    expect(body.input).toEqual({
      street: "Hammanstr.",
      house_number: "1",
      city: "Worms",
      postcode: "67549",
    });
  });

  it("forwards a single-line string input as-is", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await postValidateViaProxy("/api/v", "DE", "Hammanstr. 1, 67549 Worms");
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.input).toBe("Hammanstr. 1, 67549 Worms");
  });

  it("surfaces proxy error message on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }),
    );
    await expect(postValidateViaProxy("/api/v", "DE", "x")).rejects.toThrow(/rate limited/);
  });
});

describe("getSuggestViaProxy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds query string with country/q/limit/region", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ suggestions: [{ country: "deu" }] }), { status: 200 }),
    );
    const r = await getSuggestViaProxy("/api/s", "DE", "Hammanstr", {
      limit: 5,
      region: "RP",
    });
    expect(r).toHaveLength(1);
    const url = spy.mock.calls[0]![0] as string;
    expect(url).toContain("country=DE");
    expect(url).toContain("q=Hammanstr");
    expect(url).toContain("limit=5");
    expect(url).toContain("state=RP");
  });

  it("returns [] when proxy body lacks suggestions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    expect(await getSuggestViaProxy("/api/s", "DE", "x")).toEqual([]);
  });
});

describe("adaptWireToSdk", () => {
  it("converts ISO-2 → ISO-3 and passes through fielded input untouched", () => {
    const r = adaptWireToSdk({
      country: "DE",
      input: {
        country: "DE",
        streetName: "Hammanstr.",
        streetNumber: "1",
        city: "Worms",
        postalCode: "67549",
      },
    });
    expect(r.country).toBe("deu");
    expect(r.input).toEqual({
      street: "Hammanstr.",
      house_number: "1",
      city: "Worms",
      postcode: "67549",
    });
  });

  it("preserves a string input", () => {
    const r = adaptWireToSdk({ country: "DE", input: "Hammanstr. 1 67549 Worms" });
    expect(r.country).toBe("deu");
    expect(r.input).toBe("Hammanstr. 1 67549 Worms");
  });
});

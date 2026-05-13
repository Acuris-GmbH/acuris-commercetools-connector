import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAcurisValidation } from "../src/useAcurisValidation.js";

const okResult = {
  accuracy_type: "rooftop",
  confidence: 1,
  match_type: "rooftop",
  match_score: 1,
  input_corrected: false,
  match_components: { city: true, house_number: true, state: false, street: true, zip: true },
  standardized: { country: "deu", city: "Worms", formatted_address: "Hammanstr. 1, 67549 Worms" },
};

const endpoints = { validate: "/api/acuris/validate" };

describe("useAcurisValidation", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okResult), { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("transitions idle → loading → ok", async () => {
    const { result } = renderHook(() => useAcurisValidation({ endpoints, country: "DE" }));
    expect(result.current.status).toBe("idle");
    await act(async () => {
      await result.current.validate({ country: "DE", streetName: "Hammanstr.", streetNumber: "1" });
    });
    expect(result.current.status).toBe("ok");
    expect(result.current.result?.accuracy_type).toBe("rooftop");
  });

  it("transitions to error on non-2xx proxy response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad" }), { status: 400 }),
    );
    const { result } = renderHook(() => useAcurisValidation({ endpoints, country: "DE" }));
    await act(async () => {
      await result.current.validate({ country: "DE", streetName: "X" });
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("bad");
  });

  it("reset() clears state", async () => {
    const { result } = renderHook(() => useAcurisValidation({ endpoints, country: "DE" }));
    await act(async () => {
      await result.current.validate({ country: "DE", streetName: "X" });
    });
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeUndefined();
  });
});

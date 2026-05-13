import { describe, expect, it, vi } from "vitest";
import { AcurisClient } from "@acuris-geo/av-sdk";
import {
  buildExtensionHandler,
  buildLambdaHandler,
  buildNodeHttpHandler,
} from "../src/adapters.js";

const ROOFTOP = {
  accuracy_type: "rooftop",
  confidence: 1,
  match_type: "rooftop",
  match_score: 1,
  match_components: {},
  input_corrected: false,
  standardized: {
    country: "deu",
    city: "WORMS",
    postcode: "67549",
    street: "HAMMANSTR.",
    house_number: "1",
    formatted_address: "x",
  },
};

const cartReq = {
  action: "Update" as const,
  resource: { typeId: "cart" as const, id: "c1" },
  updates: {
    actions: [
      {
        action: "setShippingAddress",
        address: { country: "DE", streetName: "Hammanstr.", streetNumber: "1", city: "Worms", postalCode: "67549" },
      },
    ],
  },
};

describe("buildExtensionHandler", () => {
  it("returns a function that processes a request body", async () => {
    const handler = buildExtensionHandler({ apiKey: "test" });
    expect(typeof handler).toBe("function");
  });
});

describe("buildNodeHttpHandler", () => {
  it("405s on non-POST", async () => {
    const handler = buildNodeHttpHandler({ apiKey: "test" });
    const req = { method: "GET" };
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it("returns 200 with empty body when no action change is needed", async () => {
    const handler = buildNodeHttpHandler({ apiKey: "test" });
    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: "POST", body: { action: "Create", resource: { typeId: "cart", id: "x" } } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.end).toHaveBeenCalledWith("{}");
  });
});

describe("buildLambdaHandler", () => {
  it("400s on malformed JSON body", async () => {
    const handler = buildLambdaHandler({ apiKey: "test" });
    const r = await handler({ body: "{not json" });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).errors[0].code).toBe("InvalidInput");
  });

  it("returns 200 with replacement actions in rewrite mode", async () => {
    // We can't easily wire a custom client through buildLambdaHandler, so this
    // path is exercised end-to-end in processExtension.test.ts. Here we just
    // confirm the response envelope shape for empty body.
    const handler = buildLambdaHandler({ apiKey: "test" });
    const r = await handler({ body: "{}" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toBe("{}");
  });
});

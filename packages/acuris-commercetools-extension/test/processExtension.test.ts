import { describe, expect, it, vi } from "vitest";
import { AcurisClient } from "@acuris-geo/av-sdk";
import { processExtension } from "../src/processExtension.js";
import type { ExtensionRequest, ExtensionSuccessResponse, ExtensionErrorResponse } from "../src/types.js";

// Realistic Acuris /validate responses used in the mocked SDK transport.
const ROOFTOP = {
  accuracy_type: "rooftop",
  confidence: 1,
  match_type: "rooftop",
  match_score: 1,
  match_components: { city: true, house_number: true, state: false, street: true, zip: true },
  input_corrected: false,
  standardized: {
    country: "deu",
    city: "WORMS",
    postcode: "67549",
    street: "HAMMANSTR.",
    house_number: "1",
    formatted_address: "Hammanstr. 1\n67549 Worms\nGERMANY",
  },
};
const LOW_CONFIDENCE = { ...ROOFTOP, accuracy_type: "locality", confidence: 0.5 };

function clientWith(body: unknown, status = 200) {
  return new AcurisClient({
    apiKey: "test",
    fetch: () =>
      Promise.resolve(new Response(JSON.stringify(body), { status })) as unknown as ReturnType<typeof fetch>,
  });
}

function notFoundClient() {
  return new AcurisClient({
    apiKey: "test",
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Address not found" }), { status: 404 }),
      ) as unknown as ReturnType<typeof fetch>,
    maxRetries: 0,
  });
}

const cartUpdate: ExtensionRequest = {
  action: "Update",
  resource: { typeId: "cart", id: "c1", version: 2 },
  updates: {
    actions: [
      {
        action: "setShippingAddress",
        address: {
          country: "DE",
          streetName: "Hammanstr.",
          streetNumber: "1",
          city: "Worms",
          postalCode: "67549",
          firstName: "Jane",
          lastName: "Brand",
        },
      },
    ],
  },
};

describe("processExtension", () => {
  it("ignores Create actions", async () => {
    const r = await processExtension({ ...cartUpdate, action: "Create" }, {}, clientWith(ROOFTOP));
    expect(r).toBeUndefined();
  });

  it("ignores non-cart resources", async () => {
    const r = await processExtension(
      { action: "Update", resource: { typeId: "order" as never, id: "o1" } },
      {},
      clientWith(ROOFTOP),
    );
    expect(r).toBeUndefined();
  });

  it("ignores updates that touch no address actions", async () => {
    const r = await processExtension(
      {
        action: "Update",
        resource: { typeId: "cart", id: "c1" },
        updates: { actions: [{ action: "addLineItem", productId: "p1" } as never] },
      },
      {},
      clientWith(ROOFTOP),
    );
    expect(r).toBeUndefined();
  });

  it("rewrite mode replaces the address with the standardized form, identity preserved", async () => {
    const r = (await processExtension(cartUpdate, { mode: "rewrite" }, clientWith(ROOFTOP))) as
      | ExtensionSuccessResponse
      | undefined;
    expect(r).toBeDefined();
    expect(r!.actions).toHaveLength(1);
    const a = r!.actions[0] as { action: string; address: { city?: string; firstName?: string; country?: string } };
    expect(a.action).toBe("setShippingAddress");
    expect(a.address.city).toBe("WORMS");
    expect(a.address.country).toBe("DE");
    expect(a.address.firstName).toBe("Jane");
  });

  it("reject mode emits InvalidInput when confidence is below threshold", async () => {
    const r = (await processExtension(
      cartUpdate,
      { mode: "reject", minConfidence: 0.8 },
      clientWith(LOW_CONFIDENCE),
    )) as ExtensionErrorResponse;
    expect(r).toBeDefined();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.code).toBe("InvalidInput");
    expect(r.errors[0]!.extensionExtraInfo?.confidence).toBe(0.5);
  });

  it("reject mode lets high-confidence pass through with no actions emitted", async () => {
    const r = await processExtension(
      cartUpdate,
      { mode: "reject", minConfidence: 0.8 },
      clientWith(ROOFTOP),
    );
    // High confidence + reject mode: nothing to do — original action stays.
    // Caller returns 200 with empty body. We expect undefined or no errors.
    expect(r === undefined || !("errors" in (r as object))).toBe(true);
  });

  it("rewrite mode lets a no-match (404) pass through with no rewrite", async () => {
    const r = await processExtension(cartUpdate, { mode: "rewrite" }, notFoundClient());
    expect(r).toBeUndefined();
  });

  it("rewrite mode preserves apartment/building/pOBox from the original", async () => {
    const req: ExtensionRequest = {
      ...cartUpdate,
      updates: {
        actions: [
          {
            action: "setShippingAddress",
            address: {
              ...cartUpdate.updates!.actions[0]!.address!,
              apartment: "3B",
              building: "Hinterhaus",
              pOBox: "PO 123",
            },
          },
        ],
      },
    };
    const r = (await processExtension(req, { mode: "rewrite" }, clientWith(ROOFTOP))) as ExtensionSuccessResponse;
    const a = r.actions[0] as { address: { apartment?: string; building?: string; pOBox?: string } };
    expect(a.address.apartment).toBe("3B");
    expect(a.address.building).toBe("Hinterhaus");
    expect(a.address.pOBox).toBe("PO 123");
  });

  it("skipCountries bypasses validation entirely", async () => {
    const fetchSpy = vi.fn();
    const r = await processExtension(
      cartUpdate,
      { mode: "rewrite", skipCountries: ["DE"] },
      new AcurisClient({ apiKey: "test", fetch: fetchSpy as never }),
    );
    expect(r).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates setBillingAddress too", async () => {
    const req: ExtensionRequest = {
      action: "Update",
      resource: { typeId: "cart", id: "c1" },
      updates: {
        actions: [
          {
            action: "setBillingAddress",
            address: {
              country: "DE",
              streetName: "Hammanstr.",
              streetNumber: "1",
              city: "Worms",
              postalCode: "67549",
            },
          },
        ],
      },
    };
    const r = (await processExtension(req, { mode: "rewrite" }, clientWith(ROOFTOP))) as ExtensionSuccessResponse;
    expect(r.actions[0]!.action).toBe("setBillingAddress");
  });

  it("infra failures do NOT block the cart update", async () => {
    const flakyClient = new AcurisClient({
      apiKey: "test",
      maxRetries: 0,
      fetch: () => Promise.reject(new TypeError("ECONNREFUSED")) as never,
    });
    const r = await processExtension(cartUpdate, { mode: "reject" }, flakyClient);
    expect(r).toBeUndefined();
  });
});

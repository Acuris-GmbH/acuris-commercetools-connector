import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AcurisAddressValidator } from "../src/AcurisAddressValidator.js";

const okResult = {
  accuracy_type: "rooftop",
  confidence: 1,
  match_type: "rooftop",
  match_score: 1,
  match_components: { city: true, house_number: true, state: false, street: true, zip: true },
  input_corrected: false,
  standardized: {
    country: "deu",
    city: "Worms",
    postcode: "67549",
    street: "Hammanstr.",
    house_number: "1",
    formatted_address: "Hammanstr. 1, 67549 Worms",
  },
};

const addr = {
  country: "DE",
  streetName: "Hammanstr.",
  streetNumber: "1",
  city: "Worms",
  postalCode: "67549",
};

describe("<AcurisAddressValidator>", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(okResult), { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("starts idle and exposes formProps", () => {
    render(
      <AcurisAddressValidator endpoints={{ validate: "/api/v" }} country="DE" address={addr}>
        {({ status }) => <p data-testid="status">{status}</p>}
      </AcurisAddressValidator>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
  });

  it("validates on submit when trigger='submit' and prevents default", async () => {
    render(
      <AcurisAddressValidator endpoints={{ validate: "/api/v" }} country="DE" address={addr} trigger="submit">
        {({ status, formProps }) => (
          <form {...formProps} data-testid="form">
            <span data-testid="status">{status}</span>
          </form>
        )}
      </AcurisAddressValidator>,
    );
    fireEvent.submit(screen.getByTestId("form"));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ok"));
  });

  it("sends BaseAddress mapped to Acuris fielded input on the wire", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <AcurisAddressValidator endpoints={{ validate: "/api/v" }} country="DE" address={addr} trigger="submit">
        {({ formProps }) => <form {...formProps} data-testid="form" />}
      </AcurisAddressValidator>,
    );
    fireEvent.submit(screen.getByTestId("form"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0]![1]!;
    const body = JSON.parse(init.body as string);
    expect(body.country).toBe("DE");
    expect(body.input.street).toBe("Hammanstr.");
    expect(body.input.house_number).toBe("1");
    expect(body.input.postcode).toBe("67549");
  });
});

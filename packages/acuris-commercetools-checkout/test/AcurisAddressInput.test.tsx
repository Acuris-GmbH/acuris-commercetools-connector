import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { AcurisAddressInput, hitToDisplay } from "../src/AcurisAddressInput.js";

const suggestPayload = {
  suggestions: [
    {
      country: "deu",
      city: "Worms",
      postcode: "67549",
      street: "Hammanstr.",
      house_number: "1",
      formatted_address: "Hammanstr. 1\n67549 Worms\nGERMANY",
    },
    {
      country: "deu",
      city: "Berlin",
      postcode: "10117",
      street: "Friedrichstraße",
      house_number: "43",
      formatted_address: "Friedrichstraße 43\n10117 Berlin\nGERMANY",
    },
  ],
};

function Wrapper({ onSelect }: { onSelect?: (h: unknown) => void }) {
  const [v, setV] = useState("");
  return (
    <AcurisAddressInput
      endpoints={{ validate: "/api/v", suggest: "/api/s" }}
      country="DE"
      value={v}
      onChange={setV}
      onSelect={onSelect}
      debounceMs={0}
      minQueryLength={3}
      placeholder="Search…"
    />
  );
}

describe("<AcurisAddressInput>", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(suggestPayload), { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders an input and starts collapsed", () => {
    render(<Wrapper />);
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens suggestions after typing past minQueryLength", async () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Hamm" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("populates the input with a single-line display when a suggestion is picked", async () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText("Search…") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Hamm" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    fireEvent.mouseDown(screen.getAllByRole("option")[0]!);
    expect(input.value).not.toContain("\n");
    expect(input.value).toContain("Hammanstr. 1");
    expect(input.value).toContain("67549");
  });

  it("emits the picked SuggestionHit via onSelect", async () => {
    const onSelect = vi.fn();
    render(<Wrapper onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Hamm" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    fireEvent.mouseDown(screen.getAllByRole("option")[0]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ street: "Hammanstr." });
  });

  it("supports keyboard ArrowDown + Enter", async () => {
    const onSelect = vi.fn();
    render(<Wrapper onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Hamm" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("closes the dropdown on Escape", async () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Hamm" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });
});

describe("hitToDisplay", () => {
  it("flattens multi-line formatted_address", () => {
    expect(
      hitToDisplay({
        country: "deu",
        formatted_address: "Hammanstr. 1\n67549 Worms\nGERMANY",
      }),
    ).toBe("Hammanstr. 1, 67549 Worms, GERMANY");
  });

  it("handles CRLF", () => {
    expect(
      hitToDisplay({
        country: "deu",
        formatted_address: "A\r\nB\r\nC",
      }),
    ).toBe("A, B, C");
  });

  it("falls back to synthesised form when formatted_address is missing", () => {
    expect(
      hitToDisplay({
        country: "deu",
        house_number: "1",
        street: "Hammanstr.",
        city: "Worms",
        postcode: "67549",
      }),
    ).toMatch(/1\s+Hammanstr\./);
  });
});

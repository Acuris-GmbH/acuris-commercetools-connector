import { forwardRef, useState } from "react";
import type { SuggestionHit } from "@acuris-geo/av-sdk";
import { useAcurisSuggest } from "./useAcurisSuggest.js";
import type { AcurisAddressInputProps } from "./types.js";

/**
 * Controlled input with Acuris-powered typeahead, emitting commercetools-
 * shaped suggestion hits via `onSelect`.
 *
 * The component never touches Acuris directly. It calls `endpoints.suggest`
 * on the merchant's backend, which proxies to api.acuris-geo.com with the
 * API key attached server-side.
 */
export const AcurisAddressInput = forwardRef<HTMLInputElement, AcurisAddressInputProps>(
  function AcurisAddressInput(props, ref) {
    const {
      endpoints,
      country,
      value,
      onChange,
      onSelect,
      debounceMs = 200,
      minQueryLength = 3,
      limit = 5,
      region,
      renderSuggestion,
      suggestionsClassName,
      ...inputProps
    } = props;

    const [isOpen, setIsOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const { suggestions, isLoading } = useAcurisSuggest({
      endpoint: endpoints.suggest,
      country,
      q: value,
      debounceMs,
      minQueryLength,
      limit,
      region,
    });

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
      } else if (e.key === "Enter" && highlight >= 0) {
        e.preventDefault();
        pick(suggestions[highlight]!);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const pick = (hit: SuggestionHit) => {
      // formatted_address is multi-line; <input> would strip newlines and
      // smash tokens. Always present a single-line, comma-separated form.
      onChange(hitToDisplay(hit));
      onSelect?.(hit);
      setIsOpen(false);
      setHighlight(-1);
    };

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      onChange(e.target.value);
      setIsOpen(true);
      setHighlight(-1);
    };

    const showList = isOpen && (isLoading || suggestions.length > 0);

    return (
      <div data-acuris-input style={{ position: "relative" }}>
        <input
          ref={ref}
          {...inputProps}
          type={inputProps.type ?? "text"}
          value={value}
          onChange={handleChange}
          onFocus={(e) => {
            setIsOpen(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setTimeout(() => setIsOpen(false), 120);
            inputProps.onBlur?.(e);
          }}
          onKeyDown={(e) => {
            handleKeyDown(e);
            inputProps.onKeyDown?.(e);
          }}
          role="combobox"
          aria-expanded={showList}
          aria-controls="acuris-suggestions"
          aria-autocomplete="list"
        />
        {showList && (
          <ul
            id="acuris-suggestions"
            role="listbox"
            className={suggestionsClassName}
            data-acuris-suggestions
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              margin: 0,
              padding: 0,
              listStyle: "none",
              zIndex: 1000,
            }}
          >
            {isLoading && suggestions.length === 0 ? (
              <li role="option" aria-selected={false} data-acuris-state="loading">
                Loading…
              </li>
            ) : (
              suggestions.map((hit, i) => (
                <li
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${hit.formatted_address ?? "row"}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  data-acuris-suggestion-index={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(hit);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {renderSuggestion ? renderSuggestion(hit, i) : (hit.formatted_address ?? formatHit(hit))}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  },
);

function formatHit(h: SuggestionHit): string {
  return [
    [h.house_number, h.street].filter(Boolean).join(" "),
    [h.city, h.state, h.postcode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Single-line display for a suggestion. Prefer Acuris's `formatted_address`
 * flattened to commas; fall back to a synthesised form.
 */
export function hitToDisplay(hit: SuggestionHit): string {
  if (hit.formatted_address) {
    return hit.formatted_address
      .replace(/\r?\n+/g, ", ")
      .replace(/\s*,\s*,\s*/g, ", ")
      .trim();
  }
  return formatHit(hit);
}

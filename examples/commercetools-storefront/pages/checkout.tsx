import { useState } from "react";
import {
  AcurisAddressInput,
  AcurisAddressValidator,
  hitToDisplay,
  suggestionToBaseAddress,
  type BaseAddress,
  type SuggestionHit,
} from "@acuris-geo/commercetools-checkout";

const ENDPOINTS = {
  validate: "/api/acuris/validate",
  suggest: "/api/acuris/suggest",
};

// Match the country set on the acuris-geo.com homepage demo.
// commercetools convention: ISO-3166-1 alpha-2, uppercase.
const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "NL", label: "Netherlands" },
  { code: "FI", label: "Finland" },
  { code: "SE", label: "Sweden" },
];

// Country-specific placeholder examples. Each is verified to return a
// rooftop match from the production ref DB.
const EXAMPLE_ADDRESS: Record<string, string> = {
  US: "1600 Pennsylvania Ave NW, Washington, DC 20500",
  GB: "10 Downing Street, London SW1A 2AA",
  DE: "Marienplatz 8, 80331 München",
  NL: "Stadhouderskade 78, 1072 AE Amsterdam",
  FI: "Mannerheimintie 1, 00100 Helsinki",
  SE: "Drottninggatan 1, 11151 Stockholm",
};

export default function Checkout() {
  const [country, setCountry] = useState("DE");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<SuggestionHit | null>(null);
  const [name, setName] = useState("");

  const pickedAsBaseAddress: BaseAddress | null = picked
    ? suggestionToBaseAddress(picked, { country })
    : null;

  return (
    <div className="page">
      <main className="card">
        <div className="brand">ACURIS × COMMERCETOOLS</div>
        <h1>Demo checkout</h1>
        <p className="lede">
          Start typing an address — suggestions come from Acuris (proxied by
          this app&apos;s <code>/api/acuris</code> routes). Pick one to populate
          a commercetools <code>BaseAddress</code>, then submit to run a full
          validate pass.
        </p>

        <div className="field">
          <label htmlFor="name">Recipient</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Brand-Owner"
          />
        </div>

        <div className="field">
          <label htmlFor="country">Country</label>
          <select
            id="country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setSearch("");
              setPicked(null);
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="addr">Address</label>
          <AcurisAddressInput
            id="addr"
            endpoints={ENDPOINTS}
            country={country}
            value={search}
            onChange={(v) => {
              setSearch(v);
              if (picked && v !== hitToDisplay(picked)) setPicked(null);
            }}
            onSelect={(hit) => setPicked(hit)}
            debounceMs={200}
            minQueryLength={3}
            placeholder={"e.g. " + (EXAMPLE_ADDRESS[country] || EXAMPLE_ADDRESS.DE)}
          />
        </div>

        {pickedAsBaseAddress && (
          <div className="status status-info">
            <span className="status-dot" />
            <div>
              <strong>Picked as BaseAddress:</strong>{" "}
              {[pickedAsBaseAddress.streetNumber, pickedAsBaseAddress.streetName].filter(Boolean).join(" ")}
              {pickedAsBaseAddress.postalCode || pickedAsBaseAddress.city ? ", " : ""}
              {pickedAsBaseAddress.postalCode} {pickedAsBaseAddress.city}
              {pickedAsBaseAddress.country ? `, ${pickedAsBaseAddress.country}` : ""}
              <div className="status-meta">
                lat {picked?.lat?.toFixed(5)}, lng {picked?.lng?.toFixed(5)}
              </div>
            </div>
          </div>
        )}

        <AcurisAddressValidator
          endpoints={ENDPOINTS}
          country={country}
          address={pickedAsBaseAddress ?? search}
          trigger="submit"
        >
          {({ status, result, error, formProps }) => (
            <form {...formProps}>
              <button className="btn" type="submit" disabled={!search}>
                Validate &amp; continue
              </button>
              {status === "loading" && (
                <div className="status status-loading">
                  <span className="status-dot" />
                  <div>Validating…</div>
                </div>
              )}
              {status === "ok" && result && (
                <div className="status status-ok">
                  <span className="status-icon">✓</span>
                  <div>
                    <strong>{result.accuracy_type ?? "match"}</strong> —
                    confidence {result.confidence.toFixed(2)}
                    <div className="status-meta">
                      {result.standardized?.formatted_address}
                    </div>
                  </div>
                </div>
              )}
              {status === "error" && error && (
                <div className="status status-error">
                  <span className="status-icon">✗</span>
                  <div>{error.message}</div>
                </div>
              )}
            </form>
          )}
        </AcurisAddressValidator>

        <footer className="foot">
          Powered by <a href="https://acuris-geo.com" target="_blank" rel="noreferrer">Acuris</a> Address Validation & Geocoding
        </footer>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 56px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          background: linear-gradient(180deg, #fbf9f5 0%, #efe9de 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter",
            Roboto, sans-serif;
          color: #1a1a1a;
          -webkit-font-smoothing: antialiased;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border-radius: 16px;
          padding: 40px 36px 28px;
          box-shadow:
            0 1px 2px rgba(20, 20, 20, 0.04),
            0 10px 36px rgba(20, 20, 20, 0.07);
        }

        .brand {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.24em;
          color: #c97a2b;
          margin-bottom: 18px;
        }

        h1 {
          font-size: 26px;
          font-weight: 600;
          margin: 0 0 12px;
          letter-spacing: -0.01em;
          color: #111;
        }

        .lede {
          font-size: 14px;
          line-height: 1.6;
          color: #555;
          margin: 0 0 28px;
        }

        .lede code {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          background: #f3efe7;
          padding: 1.5px 6px;
          border-radius: 4px;
          font-size: 12.5px;
          color: #6b3e16;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .field label {
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .card :global(input),
        .card :global(select) {
          font-family: inherit;
          font-size: 15px;
          padding: 11px 13px;
          border: 1px solid #e3ddd1;
          border-radius: 8px;
          background: #fbfaf6;
          color: #1a1a1a;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }

        .card :global(input):focus,
        .card :global(select):focus {
          outline: none;
          border-color: #c97a2b;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(201, 122, 43, 0.14);
        }

        .btn {
          width: 100%;
          margin-top: 10px;
          padding: 13px 18px;
          background: #161616;
          color: #ffffff;
          border: 0;
          border-radius: 9px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 0.15s, transform 0.05s;
        }
        .btn:hover:not(:disabled) { background: #2a2a2a; }
        .btn:active:not(:disabled) { transform: translateY(1px); }
        .btn:disabled {
          background: #ddd6c9;
          color: #ffffff;
          cursor: not-allowed;
        }

        .status {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 9px;
          font-size: 13.5px;
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .status-meta {
          font-size: 12.5px;
          color: #6c6c6c;
          margin-top: 3px;
        }
        .status-icon {
          font-weight: 700;
          font-size: 15px;
          line-height: 1.4;
          flex-shrink: 0;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 7px;
          flex-shrink: 0;
        }

        .status-info { background: #f6f3ed; color: #3a3024; }
        .status-info .status-dot { background: #c97a2b; }

        .status-loading { background: #f4f4f4; color: #555; }
        .status-loading .status-dot {
          background: #888;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .status-ok { background: #ecf6ee; color: #1f5230; }
        .status-ok .status-icon { color: #2f8147; }

        .status-error { background: #fcecec; color: #7a1f1f; }
        .status-error .status-icon { color: #b03333; }

        .foot {
          margin-top: 28px;
          padding-top: 18px;
          border-top: 1px solid #f0eadf;
          font-size: 12px;
          color: #999;
          text-align: center;
        }
        .foot a {
          color: #c97a2b;
          text-decoration: none;
          font-weight: 500;
        }
        .foot a:hover { text-decoration: underline; }

        @media (max-width: 540px) {
          .page { padding: 24px 12px; }
          .card { padding: 28px 22px 22px; border-radius: 12px; }
          h1 { font-size: 22px; }
        }
      `}</style>
    </div>
  );
}

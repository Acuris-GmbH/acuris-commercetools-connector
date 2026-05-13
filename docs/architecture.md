# Architecture

This document explains the shape of the connector: how the two packages
relate, why the API key always lives on the server, and the rationale
behind retry/timeout defaults. Written for engineers integrating the
connector into a production commercetools storefront — not exhaustive
reference docs; those live in the per-package READMEs.

## 30-second summary

```
   Browser                       Your backend                   Acuris
   ─────────                     ─────────                      ─────────

   <AcurisAddressInput>   ──►    /api/acuris/suggest   ──►   GET  /suggest
   <AcurisAddressValidator> ─►   /api/acuris/validate  ──►   POST /validate
                                 (acuris-av-sdk +            (api.acuris-geo.com)
                                  ACURIS_API_KEY +
                                  iso2ToIso3)

   commercetools API Extension on Cart:Update
                          ──►    your-lambda/url       ──►   POST /validate
                                 (acuris-av-sdk +
                                  ACURIS_API_KEY)
```

Three pieces, two trust boundaries:

1. **Storefront component → merchant proxy.** React in the browser calls
   the merchant's own `/api/acuris/*` routes. No Acuris key ever crosses
   into the browser bundle.
2. **Merchant proxy → Acuris.** The proxy uses `@acuris-geo/av-sdk` with
   the key from `process.env`. It also converts commercetools-native
   ISO-2 country codes to Acuris's ISO-3 (`iso2ToIso3`).
3. **commercetools → API Extension.** When Cart updates fire, commercetools
   POSTs to the Extension handler URL, which also speaks to Acuris via
   the SDK. This closes the storefront-only bypass.

## The two packages

### `@acuris-geo/commercetools-checkout` (client)

React components + hooks + boundary mappers.

- Peer-depends on `react ^18 || ^19`.
- Depends on `@acuris-geo/av-sdk` only for shared types (no runtime use
  of the SDK in the browser).
- Components: `<AcurisAddressInput>` (debounced typeahead),
  `<AcurisAddressValidator>` (render-prop wrapper around a form).
- Hooks: `useAcurisSuggest`, `useAcurisValidation` — for teams rolling
  their own UI.
- Boundary helpers: `toAcurisInput`, `toBaseAddress`,
  `suggestionToBaseAddress`, `iso2ToIso3`, `iso3ToIso2`,
  `adaptWireToSdk`.
- SSR-safe. No browser-only globals are touched during render.
- Unstyled by default; the sample app ships a polished styled-jsx layer
  you can lift verbatim or replace.

### `@acuris-geo/commercetools-extension` (server)

Node handler for commercetools API Extensions.

- Zero React deps; safe for Lambda/Cloud Functions/commercetools Connect.
- Exports `processExtension` (runtime-agnostic core) plus thin adapters:
  `buildExtensionHandler`, `buildNodeHttpHandler`, `buildLambdaHandler`.
- Three modes: `rewrite` (replace inbound address with standardized
  form), `reject` (return `InvalidInput` below `minConfidence`),
  `annotate` (placeholder for Custom Field round-trip).
- Acuris-side failures (network, 5xx) **do not block** Cart updates;
  the inbound action stands. Configurable per release if you want
  fail-closed.

## Why a backend proxy is non-negotiable

An Acuris API key is a paid credential — every call decrements credits.
If we let the browser carry the key:

1. Anyone visiting the storefront can read it from the network tab.
2. Bots will scrape it within hours.
3. The customer's credit pool drains overnight.

The connector therefore enforces the proxy pattern by design:

- **The SDK refuses to instantiate without an API key.** That key has to
  come from `process.env.ACURIS_API_KEY` on the server.
- **The React components require an `endpoints` prop** pointing at your
  own routes. There is no escape hatch to call Acuris directly from the
  browser.

## ISO-2 ↔ ISO-3 — where the conversion happens

commercetools uses ISO-3166-1 alpha-2 (`"DE"`). Acuris uses ISO-3
lowercase (`"deu"`). The conversion happens **exactly once** at the
proxy boundary:

```ts
// pages/api/acuris/validate.ts
const result = await validateAddress(client, input, {
  country: iso2ToIso3(req.body.country),    // ← here
});
```

The wire format between browser and proxy stays in commercetools
vocabulary. This means a merchant who already has `BaseAddress` in
their cart state can hand it to the React component verbatim, no
double translation.

## Why two packages and not one

A pure-React widget gives the buyer a good UX. It does **not** stop a
buyer (or a bot) bypassing the widget by hitting the cart REST endpoint
directly with bad data. For enterprise commercetools deployments that's
a real concern — most have orders flowing through partner tooling,
fulfilment integrations, and CSV bulk imports, all of which skip the
storefront entirely.

The API Extension closes that bypass. It runs inside commercetools, on
every Cart update, before persistence. The widget guides the buyer;
the extension guarantees the result.

## Retry and timeout defaults

The SDK ships with conservative defaults that work for a checkout flow:

| Setting           | Default | Rationale                                         |
| ----------------- | ------- | ------------------------------------------------- |
| `timeoutMs`       | 5000 ms | Long enough for cold-start cascades, short enough that users don't sit on a spinner. |
| `maxRetries`      | 3       | Acuris occasionally returns 429 during peak hours; three attempts smooths that without amplifying real outages. |
| backoff base      | 200 ms  | First retry lands at ~200 ms.                      |
| backoff cap       | 4000 ms | Worst-case retry pair never delays a user >5 s.   |
| jitter            | ±25 %   | Avoids thundering when many clients see the same 429 simultaneously. |

Only transient statuses (5xx, 429), network errors, and client-side
timeouts are retried. Auth errors (401/403), validation errors (400/422),
and not-found (404) propagate immediately — retrying them won't help.

The **API Extension package** uses a tighter `timeoutMs: 3500` by default
because commercetools enforces a 2 s default / 10 s max per-extension
budget. Raise to 5000 if your handler runs in the same region as your
commercetools project and you've measured headroom.

## Field-shape conventions

The SDK preserves Acuris's wire-format field names verbatim
(`accuracy_type`, `match_score`, `standardized.formatted_address`, …)
rather than re-aliasing them. The boundary mappers in `commercetools-
checkout` translate to commercetools's `BaseAddress` shape at the point
of use — `toBaseAddress(result, base)` returns a shape you can hand
straight to `cart.setShippingAddress`.

If you want a vendor-agnostic shape (e.g. for swapping providers later),
map once at your application boundary rather than asking the SDK to do
it.

## Server-side typeahead — cost and latency

`<AcurisAddressInput>` is debounced and aborts in-flight requests on
keystrokes, but it still issues a network call per stable prefix:

- **Cost.** Each suggest call decrements one geocoding credit. A
  high-traffic page will burn credits quickly. Consider raising
  `minQueryLength` (default 3) or `debounceMs` (default 200), or
  putting your own cache in front of `/api/acuris/suggest`.
- **Latency.** A 200 ms debounce + ~80 ms server hop + ~50 ms Acuris
  lookup feels instant on broadband but can bite on mobile. The component
  shows a "Loading…" row while in-flight; you can swap that text via
  `renderSuggestion`.

To disable typeahead entirely, omit `endpoints.suggest`. The input
becomes a plain controlled text field, and validation runs only on blur
or submit via `<AcurisAddressValidator>`.

## SSR, Next.js, and Hydrogen / Alokai / commercetools Frontend

The components are written so that:

- First server render produces a closed-dropdown DOM with stable IDs.
- Client hydration attaches event handlers without re-rendering.
- No `window`, `document`, `localStorage`, or `IntersectionObserver` is
  touched outside an event handler.

Tested against Next.js 14 pages router (the sample) and Next.js 14 app
router. Alokai's commercetools integration and commercetools Frontend
both serve the React tree from a BFF — the components work unchanged as
long as the merchant exposes the two proxy routes. See the integration
guide for framework-specific recipes.

## Versioning

Both packages are versioned in lockstep (`0.1.0`, `0.1.1`, …) and depend
on the same `^0.1.1` of `@acuris-geo/av-sdk`. They will remain in
lockstep through `1.0.0`; after that they may diverge if one matures
faster than the other.

While in the `0.x` series, minor versions can include breaking changes.
We call them out explicitly in the changelog and ship a codemod where
the migration isn't obvious.

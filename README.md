# acuris-commercetools-connector

> Drop-in address validation + geocoding for [commercetools](https://commercetools.com)
> Composable Commerce, powered by [Acuris](https://acuris-geo.com). Ships
> two npm packages — a React widget pair for the storefront and a Node
> handler for commercetools API Extensions — so the merchant can both
> guide the buyer to a clean address and **gate cart updates server-side**
> before they reach the order.

[![CI](https://github.com/Acuris-GmbH/acuris-commercetools-connector/actions/workflows/ci.yml/badge.svg)](https://github.com/Acuris-GmbH/acuris-commercetools-connector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Status:** beta (`0.1.0`).

---

## What this is

commercetools is the flagship enterprise headless-commerce platform —
huge install base, formal partner program, Loqate and Avalara already
listed in the Connect Marketplace. This repo is Acuris's contribution to
that surface.

- **`@acuris-geo/commercetools-checkout`** — React components +
  hooks. `<AcurisAddressInput>` typeahead and
  `<AcurisAddressValidator>` render-prop, emitting commercetools
  `BaseAddress`-shaped objects (ISO-2 country, split
  `streetName`/`streetNumber`, `postalCode`, etc.). Drops into Alokai,
  commercetools Frontend, or a custom Next.js BFF.
- **`@acuris-geo/commercetools-extension`** — Node handler for a
  commercetools **API Extension** on Cart. Synchronously validates
  `setShippingAddress` / `setBillingAddress` actions against Acuris,
  then either **rewrites** the action to the canonical address or
  **rejects** with `InvalidInput`. Deployable to Lambda, Cloud
  Functions, or commercetools Connect.
- **A working Next.js demo** — `examples/commercetools-storefront` —
  clone, set `ACURIS_API_KEY`, deploy to Vercel.

> **Note:** This is a community integration. It is **not** an officially
> certified commercetools Connect listing yet — Marketplace submission
> is in progress. The packages work today against any commercetools
> project (free 60-day trial includes a sample-data project).

---

## Why two packages?

Storefront-only address validation is a **bypass**: a buyer with the
right HTTP client can `POST /me/carts/{id}` directly and skip the
React widget entirely. Enterprise commercetools merchants will not
accept that. The API Extension closes the bypass by running on every
Cart update, server-side, before the cart persists.

Both packages share Acuris's pricing model — one Address Validation
or Geocoding credit per `/validate` call regardless of which package
makes it.

---

## Quick start

```bash
npm install @acuris-geo/commercetools-checkout @acuris-geo/commercetools-extension
```

You also need an Acuris API key — get one at
[acuris-geo.com/acuris-pricing](https://acuris-geo.com/acuris-pricing/).

### Frontend (React)

```tsx
import {
  AcurisAddressInput,
  AcurisAddressValidator,
  toBaseAddress,
} from "@acuris-geo/commercetools-checkout";

const ENDPOINTS = { validate: "/api/acuris/validate", suggest: "/api/acuris/suggest" };

<AcurisAddressValidator endpoints={ENDPOINTS} country="DE" address={picked}>
  {({ status, result, formProps }) => (
    <form {...formProps}>
      <AcurisAddressInput endpoints={ENDPOINTS} country="DE" value={search} onChange={setSearch} onSelect={setPicked} />
      <button type="submit">Continue</button>
      {status === "ok" && (
        // Hand the BaseAddress straight to your cart mutation.
        await cart.setShippingAddress(toBaseAddress(result))
      )}
    </form>
  )}
</AcurisAddressValidator>
```

### Server (API Extension)

```ts
import { buildExtensionHandler } from "@acuris-geo/commercetools-extension";

export const handler = buildExtensionHandler({
  apiKey: process.env.ACURIS_API_KEY!,
  mode: "rewrite",     // rewrite to canonical, or "reject" on low confidence
  minConfidence: 0.8,
});
```

Register the handler URL in Merchant Center → Settings → API Extensions
with trigger `Cart: Update`.

---

## Repository layout

```
packages/
  acuris-commercetools-checkout/   React widgets + hooks
  acuris-commercetools-extension/  Node handler for commercetools API Extension
examples/
  commercetools-storefront/        Runnable Next.js demo with proxy routes
docs/
  research.md                      Phase 1 platform research
  architecture.md                  Why the client/server split, retry/timeout philosophy
  commercetools-integration-guide.md
                                   Production-ready wiring guide
```

## Live demo

[acuris-commercetools-demo.vercel.app](https://acuris-commercetools-demo.vercel.app) — Next.js
storefront with the components wired against a Next.js API proxy. Try
the German address `Hammanstr. 1, 67549 Worms` — should return
`rooftop` with confidence `1.00`.

## Documentation

- [Integration guide](docs/commercetools-integration-guide.md) — production wiring against Alokai, commercetools Frontend, or a custom Next.js BFF.
- [Architecture](docs/architecture.md) — why the client/server split, retry/timeout defaults.
- [Phase 1 research](docs/research.md) — the data-model + auth-model survey that shaped this connector.
- [@acuris-geo/commercetools-checkout README](packages/acuris-commercetools-checkout/README.md)
- [@acuris-geo/commercetools-extension README](packages/acuris-commercetools-extension/README.md)

## License

[MIT](LICENSE) © Acuris GmbH.

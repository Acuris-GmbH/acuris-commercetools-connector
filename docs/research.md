# Acuris AV+Geo → commercetools connector — Phase 1 research

Date: 2026-05-13. Target: scope a TypeScript connector for commercetools Composable Commerce (docs.commercetools.com).

## 1. Address data model

commercetools defines `BaseAddress` (the shape used in drafts and update actions) and `Address` (adds an `id`/`custom` for stored addresses). Source: <https://docs.commercetools.com/api/types#address>.

Confirmed fields (all `String`, all optional unless noted):

- Identity: `id`, `key`, `externalId`
- Locale: `country` — **`CountryCode`, "Two-digit country code as per ISO 3166-1 alpha-2"** (e.g. `"DE"`, `"US"`, `"NL"`)
- Person: `title`, `salutation`, `firstName`, `lastName`, `company`, `department`
- Lines: `streetName`, `streetNumber`, `additionalStreetInfo`, `building`, `apartment`, `pOBox` (note casing — lowercase `p`)
- Place: `postalCode`, `city`, `region`, `state`
- Contact: `phone`, `mobile`, `email`, `fax`
- Catch-all: `additionalAddressInfo`
- `Address`/`AddressDraft` add an optional `custom: CustomFields(Draft)` for merchant-defined fields

Confirmed: ISO-3166-1 **alpha-2**, not alpha-3. The street is split into `streetName` + `streetNumber` (libpostal-style), with `additionalStreetInfo` for unit/floor and a dedicated `pOBox` field — richer than Centra's flat `address1`/`address2`.

## 2. Storefront SDK / checkout API

Two cart entry points:

- Admin: `POST /{projectKey}/carts/{id}` with action `setShippingAddress` (and `setBillingAddress`, plus `setItemShippingAddress` for multi-ship carts). Source: <https://docs.commercetools.com/api/projects/carts>.
- Storefront: `/me/carts` with the same actions, but write-scoped to fields the customer is allowed to mutate. Auth flows from password or anonymous-session tokens. Source: <https://docs.commercetools.com/api/projects/me-carts>.

Addresses also attach to `Customer.addresses[]` (+ `defaultShippingAddressId`/`defaultBillingAddressId`) and snapshot onto the resulting `Order`. The TS SDK is `@commercetools/platform-sdk` plus a client builder (`@commercetools/ts-client` / `@commercetools/sdk-client-v2`). Source: <https://docs.commercetools.com/sdk>.

**Recommendation: ship pure React components + a thin server helper, do NOT wrap `platform-sdk`.** Three reasons: (a) most enterprise commercetools storefronts sit behind a framework that owns cart mutations — Alokai/Vue Storefront (`docs.alokai.com/commercetools`), commercetools Frontend (ex-Frontastic, `docs.frontastic.cloud`), or a bespoke Next.js BFF — so a `platform-sdk` patch would only fit ~⅓ of pilots; (b) merchants treat the SDK as a black box and won't accept monkey-patching; (c) the React widget pattern already shipped in `acuris-centra-checkout` composes cleanly with all three. Components call merchant-owned `/api/acuris/{validate,suggest}` proxies (API key server-side), then hand the resulting `BaseAddress`-shaped object to whatever `setShippingAddress` mutation the framework exposes (`useCart().setShippingAddress(addr)` in Alokai; cart-action mutators in commercetools Frontend; raw `apiRoot.me().carts()...` in a BFF).

## 3. Auth model for the demo

commercetools offers a **self-service 60-day free trial, no credit card, no sales contact**: <https://commercetools.com/free-trial> → "Create new Account" on the Merchant Center login. Sample-data Projects (B2C Lifestyle, B2B Heavy Machinery) seed carts/customers/products to test against. Source: <https://commercetools.com/blog/considering-an-ecommerce-migration-heres-the-top-5-faqs-about-our-60-day-trial>.

API client is provisioned in Merchant Center → Settings → Developer settings → API clients (or via the impex tool per region). Scopes for the demo (project-scoped, suffixed `:{projectKey}`): `manage_my_orders` (anonymous+password cart/order writes), `manage_my_profile` (customer addresses), `view_published_products` (catalog), plus `manage_customers` and `manage_orders` only on the server side if the demo also runs an admin BFF. Source: <https://docs.commercetools.com/api/scopes>. The `/me` endpoints accept tokens from the password flow or anonymous-session flow — exactly what a Next.js demo needs.

## 4. Plug-in points

- **API Extensions** (<https://docs.commercetools.com/api/projects/api-extensions>) — synchronous HTTP hooks fired on Create/Update for Cart, Order, Customer, Payment, BusinessUnit, ShoppingList, Quote. They can (a) return 200 with up to 100 update actions to rewrite the resource, or (b) return 400 with a structured error array to abort the call. Hard timeouts: 2 s default, configurable up to 10 s; 1 s connect. **Fits address validation perfectly**: gate `CartUpdate` with action `setShippingAddress`, call Acuris `/validate`, and either rewrite to the standardized address (`setShippingAddress` again with normalized fields) or reject 400 with `InvalidInput`.
- **Subscriptions** (<https://docs.commercetools.com/api/projects/subscriptions>) — async, fire-and-forget to SQS/PubSub/EventGrid after persistence. Cannot reject or modify. Useless for inline validation; possibly useful for batch re-validation of historical orders.
- **commercetools Connect** (<https://docs.commercetools.com/connect>) — managed runtime for partner integrations, certified for the **commercetools Marketplace** (<https://marketplace.commercetools.com/>). Existing address-validation precedent: Loqate (<https://www.loqate.com/developers/guides/commercetools-integration/>) and Avalara's `/check-address` endpoint. Partner program entrance: <https://partner.commercetools.com/>. Public submission/manifest format is not documented on the open web — gated behind partner-program signup.

## 5. Material differences vs Centra

Centra reference: `/opt/acuris/services/acuris-centra-connector/`. Key deltas:

| Area | Centra (`@acuris-geo/centra-checkout`) | commercetools |
|---|---|---|
| Country code | lowercase ISO-3 (`"deu"`, `"usa"`) — matches `@acuris-geo/av-sdk` `CountryCode` | uppercase ISO-2 (`"DE"`, `"US"`) — **must map at the boundary** |
| Street | flat `address1` / `address2` | split `streetName` + `streetNumber` + `additionalStreetInfo` + `building` + `apartment` + `pOBox` |
| Plug-in surface | none (storefront-only checkout widget) | API Extensions (sync, gating) + Subscriptions + Connect runtime |
| Custom fields | not modelled | `Address.custom: CustomFields` — merchants can attach an `acurisConfidence` / `acurisAccuracyType` field type |
| Marketplace | none | commercetools Marketplace + Connect certification |
| Framework split | one storefront pattern | Alokai / commercetools Frontend / Next.js BFF — three call sites |

**This is NOT a clone-and-rename of the Centra repo.** The component-shape parity holds (`AcurisAddressInput` + `AcurisAddressValidator` render-prop survives unchanged), but at minimum the connector must add:

1. **`@acuris-geo/commercetools-checkout`** — React widgets, identical surface to `centra-checkout`, plus a `toBaseAddress(hit | result): BaseAddress` mapper that uppercases the ISO-3→ISO-2 country and splits the formatted line into `streetName`/`streetNumber`/`additionalStreetInfo`.
2. **`@acuris-geo/commercetools-extension`** — a separate server-side package (Node handler + Connect manifest) implementing the API Extension contract. Exports a `buildExtensionHandler({ apiKey, mode: "reject" | "rewrite" })` that merchants drop into Cloud Functions / Lambda / Connect runtime. This is net-new vs Centra and is required for the enterprise sell — the React widget alone leaves a server-side bypass.
3. CustomField type definitions (`acurisConfidence`, `acurisAccuracyType`, `acurisStandardizedAt`) so validation results round-trip onto the Order.

Naming check: **`@acuris-geo/commercetools-checkout` is unclaimed on npm** (registry.npmjs.org returns 404; `@acuris-geo/centra-checkout` returns 200 for comparison). **No `Acuris-GmbH/acuris-commercetools-connector` or `LeventACURIS/acuris-commercetools-connector` repo on GitHub** (both return 404). Safe to register both when Phase 2 starts.

### Open questions before coding

- Connect manifest format + certification gating — need partner-program signup to read; can't be scoped from public docs.
- Which framework does the pilot merchant use (Alokai vs commercetools Frontend vs custom Next.js BFF)? Determines which `setShippingAddress` adapter ships as the headline demo.
- Should `additionalStreetInfo` carry the AV `unit`/`apartment` token, or should we keep it empty and put it in `apartment`? Merchant-by-merchant — needs a config knob.
- Multi-ship carts (`itemShippingAddresses[]`) — validate each independently, or batch? Probably independent given per-line tax recalc.
- CustomField type registration: ship a one-shot setup script or rely on commercetools Terraform provider? Likely both, with the script as default.
- 2-second default Extension timeout vs Acuris `/validate` p95 — confirm headroom; if tight, raise to 5 s in the recommended manifest.

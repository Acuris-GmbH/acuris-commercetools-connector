# @acuris-geo/commercetools-checkout

> React components + hooks for integrating Acuris Address Validation &
> Geocoding into commercetools storefronts. SSR-safe, unstyled by default,
> no monkey-patching of `@commercetools/platform-sdk`.

**Status:** beta (`0.1.0`).

## Install

```bash
npm install @acuris-geo/commercetools-checkout
```

`react` and `react-dom` are peer dependencies (`^18` or `^19`).

## Why this package

commercetools speaks ISO-2 country codes, split `streetName`/`streetNumber`
fields, and `postalCode` (lowercase `p`). Acuris's address-validation API
speaks ISO-3 lowercase, single-field street, and `postcode`. The mapping
is the work this package exists to do — your storefront stays in
commercetools-native vocabulary throughout.

## Security model

**Do not embed an Acuris API key in the browser.** Components call _your_
proxy endpoints, which forward to `api.acuris-geo.com` with the API key
attached server-side. A working pair of Next.js API routes lives in
`examples/commercetools-storefront/`.

```
Browser ──► /api/acuris/validate  ──►  acuris-av-sdk  ──►  api.acuris-geo.com
            (your backend; converts                       (lives server-side)
             ISO-2 → ISO-3 via iso2ToIso3)
```

## Components

### `<AcurisAddressInput>`

Controlled input with debounced typeahead. Country is ISO-2 (`"DE"`,
`"US"`, …).

```tsx
import { AcurisAddressInput, suggestionToBaseAddress } from "@acuris-geo/commercetools-checkout";
import { useState } from "react";

const ENDPOINTS = { validate: "/api/acuris/validate", suggest: "/api/acuris/suggest" };

const [value, setValue] = useState("");
const [picked, setPicked] = useState<SuggestionHit | null>(null);

<AcurisAddressInput
  endpoints={ENDPOINTS}
  country="DE"
  value={value}
  onChange={setValue}
  onSelect={(hit) => setPicked(hit)}
/>

// Hand the picked hit to your cart mutation as a BaseAddress.
const baseAddress = picked ? suggestionToBaseAddress(picked, { country: "DE" }) : null;
```

### `<AcurisAddressValidator>`

Render-prop wrapper that validates an address on blur, submit, or
manually. The `address` prop accepts a `BaseAddress` (preferred — gives
Acuris the structured form) or a fallback free-text string.

```tsx
<AcurisAddressValidator
  endpoints={ENDPOINTS}
  country="DE"
  address={pickedBaseAddress}
  trigger="submit"
>
  {({ status, result, error, formProps }) => (
    <form {...formProps}>
      {/* your fields */}
      {status === "ok" && (
        <p>✓ {result?.standardized?.formatted_address}</p>
      )}
    </form>
  )}
</AcurisAddressValidator>
```

## Boundary mappers

| Function | Direction |
|---|---|
| `toAcurisInput(addr: BaseAddress)` | commercetools → Acuris fielded input |
| `toBaseAddress(result, base?)` | Acuris validate result → commercetools `BaseAddress` |
| `suggestionToBaseAddress(hit, base?)` | Acuris suggestion → commercetools `BaseAddress` |
| `iso2ToIso3("DE")` → `"deu"` | Country mapping |
| `iso3ToIso2("deu")` → `"DE"` | Country mapping |
| `adaptWireToSdk({country, input})` | Proxy-side helper: ISO-2 → ISO-3 + pass through Acuris fielded input |

Identity fields (`firstName`, `lastName`, `company`, `phone`, …) are
preserved verbatim by `toBaseAddress` and `suggestionToBaseAddress` —
Acuris doesn't see them, and we don't lose them.

## Hooks

```ts
import { useAcurisValidation, useAcurisSuggest } from "@acuris-geo/commercetools-checkout";

const { status, result, validate } = useAcurisValidation({ endpoints, country: "DE" });
const { suggestions } = useAcurisSuggest({ endpoint: "/api/acuris/suggest", country: "DE", q, debounceMs: 200 });
```

Both hooks abort inflight requests automatically so the latest user
interaction always wins.

## Use with the API Extension

For enterprise hardening, pair this package with
[`@acuris-geo/commercetools-extension`](../acuris-commercetools-extension)
to gate Cart updates server-side. The React component guides the buyer;
the extension closes the bypass.

## License

MIT © Acuris GmbH

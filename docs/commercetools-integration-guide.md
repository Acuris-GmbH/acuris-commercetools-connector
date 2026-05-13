# commercetools integration guide

> Wiring the Acuris connector into a commercetools-based storefront.
> Written for the engineer doing the integration — assumes you have a
> commercetools project and at least one `me/carts` mutation working in
> your codebase already.

## What you'll have at the end

- Address typeahead on your storefront's address step, powered by Acuris.
- A "validate on submit" pass that catches bad addresses **before** they
  hit your cart mutation.
- An **API Extension** on `Cart:Update` that closes the storefront bypass
  server-side — backend or partner code that writes addresses directly
  is gated the same way.
- Zero Acuris credentials in your browser bundle.

## Prerequisites

- A commercetools project. Free 60-day trial available at
  [commercetools.com/free-trial](https://commercetools.com/free-trial)
  with sample-data projects (B2C Lifestyle / B2B Heavy Machinery) ready
  to test against.
- An Acuris API key. Get one at
  [acuris-geo.com/acuris-pricing](https://acuris-geo.com/acuris-pricing/).
- Node 18.17+.
- Your existing storefront framework: Alokai (Vue Storefront),
  commercetools Frontend (ex-Frontastic), or a custom Next.js BFF. All
  three work — this guide uses Next.js for the proxy routes; the
  React components themselves are framework-agnostic.

## Install

```bash
npm install @acuris-geo/commercetools-checkout @acuris-geo/commercetools-extension
```

Add the API key to your server-side env. In Vercel, set
`ACURIS_API_KEY` in the project's Environment Variables (mark it
server-only). For self-hosted, drop it into `.env.local`.

```
# .env.local
ACURIS_API_KEY=sk-...your-key...
```

---

## Step 1 — Add the two proxy API routes

The React components call your backend, not Acuris directly. Drop two
files into `pages/api/acuris/`.

### `pages/api/acuris/validate.ts`

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { AcurisClient, validateAddress, AcurisError } from "@acuris-geo/av-sdk";
import { iso2ToIso3 } from "@acuris-geo/commercetools-checkout";

let client: AcurisClient | null = null;
function getClient() {
  if (!client) client = new AcurisClient({ apiKey: process.env.ACURIS_API_KEY });
  return client;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const { country, input } = req.body ?? {};
  if (!country || !input) return res.status(400).json({ error: "bad_request" });
  try {
    res.status(200).json(
      await validateAddress(getClient(), input, { country: iso2ToIso3(country) }),
    );
  } catch (err) {
    if (err instanceof AcurisError) return res.status(err.status ?? 502).json({ error: err.message });
    res.status(500).json({ error: String(err) });
  }
}
```

### `pages/api/acuris/suggest.ts`

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { AcurisClient, suggestAddress, AcurisError } from "@acuris-geo/av-sdk";
import { iso2ToIso3 } from "@acuris-geo/commercetools-checkout";

let client: AcurisClient | null = null;
function getClient() {
  if (!client) client = new AcurisClient({ apiKey: process.env.ACURIS_API_KEY });
  return client;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const country = String(req.query.country ?? "");
  const q = String(req.query.q ?? "");
  if (!country) return res.status(400).json({ error: "bad_request" });
  try {
    res.status(200).json({
      suggestions: await suggestAddress(getClient(), q, { country: iso2ToIso3(country), limit: 5 }),
    });
  } catch (err) {
    if (err instanceof AcurisError) return res.status(err.status ?? 502).json({ error: err.message });
    res.status(500).json({ error: String(err) });
  }
}
```

App Router equivalents go in `app/api/acuris/{validate,suggest}/route.ts`
with `export async function POST/GET(req: Request)` — same shape.

---

## Step 2 — Wire the components into your address step

```tsx
import { useState } from "react";
import {
  AcurisAddressInput,
  AcurisAddressValidator,
  suggestionToBaseAddress,
  toBaseAddress,
  hitToDisplay,
  type BaseAddress,
  type SuggestionHit,
} from "@acuris-geo/commercetools-checkout";

const ENDPOINTS = { validate: "/api/acuris/validate", suggest: "/api/acuris/suggest" };

export function AddressStep({ country, onAddressVerified }: {
  country: string;                   // ISO-2: "DE", "US", "NL"
  onAddressVerified: (addr: BaseAddress) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<SuggestionHit | null>(null);

  const baseAddress = picked ? suggestionToBaseAddress(picked, { country }) : null;

  return (
    <AcurisAddressValidator
      endpoints={ENDPOINTS}
      country={country}
      address={baseAddress ?? search}
      trigger="submit"
    >
      {({ status, result, error, formProps }) => (
        <form
          {...formProps}
          onSubmit={async (e) => {
            formProps.onSubmit(e);
            if (status === "ok" && result) {
              const verified = toBaseAddress(result, baseAddress ?? { country });
              await onAddressVerified(verified);
            }
          }}
        >
          <AcurisAddressInput
            endpoints={ENDPOINTS}
            country={country}
            value={search}
            onChange={(v) => {
              setSearch(v);
              if (picked && v !== hitToDisplay(picked)) setPicked(null);
            }}
            onSelect={setPicked}
            placeholder="Start typing your address…"
          />
          <button type="submit">Continue to shipping</button>
          {status === "error" && <p role="alert">Couldn't verify: {error?.message}</p>}
        </form>
      )}
    </AcurisAddressValidator>
  );
}
```

---

## Step 3 — Hand the verified address to commercetools

Once `<AcurisAddressValidator>` reports `status: "ok"`, `toBaseAddress(result, base)`
gives you a clean commercetools `BaseAddress`. Hand it to your cart
mutation directly.

```ts
// Alokai
const { setShippingAddress } = useCart();
await setShippingAddress(verifiedAddress);

// commercetools Frontend
import { useCart } from 'frontastic';
const { updateCart } = useCart();
await updateCart({ shipping: verifiedAddress });

// Custom Next.js BFF using @commercetools/platform-sdk
await apiRoot
  .me()
  .carts()
  .withId({ ID: cartId })
  .post({
    body: {
      version: cartVersion,
      actions: [{ action: "setShippingAddress", address: verifiedAddress }],
    },
  })
  .execute();
```

---

## Step 4 — Add the server-side API Extension

The storefront component guides the buyer; the API Extension closes the
bypass. Deploy a Lambda (or Cloud Function / commercetools Connect
service) running the handler:

```ts
import { buildLambdaHandler } from "@acuris-geo/commercetools-extension";

export const handler = buildLambdaHandler({
  apiKey: process.env.ACURIS_API_KEY!,
  mode: "rewrite",
  minConfidence: 0.8,
});
```

Then register the URL in Merchant Center → Settings → Developer settings
→ API Extensions:

- **Trigger:** `Cart`, `Update`
- **Destination:** your Lambda URL
- **Auth:** AWS Lambda authorizer, X-API-Key header, or basic auth —
  pick whatever your Lambda enforces

commercetools will call the extension on every Cart update. The handler
runs Acuris on each `setShippingAddress`/`setBillingAddress` action and
either:

- **`rewrite` mode** (default): returns replacement actions with the
  standardized address. Cart proceeds.
- **`reject` mode**: returns `InvalidInput` on low-confidence matches.
  Cart aborts; the storefront sees the error and shows the buyer.

Network failures inside the extension **do not block** Cart updates —
we'd rather let a degraded buyer through than crash checkout on an
Acuris hiccup. If you want fail-closed behaviour for compliance reasons,
file an issue.

---

## Step 5 — Decide what to do with imperfect matches

`accuracy_type` gives you a coarse precision bucket. A reasonable policy:

| `accuracy_type`             | Action                                          |
| --------------------------- | ----------------------------------------------- |
| `rooftop`, `parcel`         | Auto-accept, proceed.                           |
| `street_interpolated`       | Auto-accept; log for ops.                       |
| `street_center`, `postcode` | "Looks like X — is this right?" inline confirm. |
| `locality`, `centroid`      | Reject; surface Acuris's `corrections[]`.       |
| `null` (no match)           | Reject; ask the buyer to refine.                |

Tune to your shipping carrier's quality bar. Some carriers ship on
`postcode`-only matches in postal-grid countries (NLD, GBR); others
want rooftop.

---

## Test addresses

Manual smoke test before going live:

1. **A real address.** Type a known-good address from your customer DB.
   Expect `accuracy_type: "rooftop"`, confidence ≈ 1.0.
2. **A German address with typeahead.** Type `Hammanstr` with country
   `DE` and pick "Hammanstr. 1, 67549 Worms" — expect rooftop,
   `lat 49.6316, lng 8.3464`.
3. **A typo.** Swap two characters in the street name. Expect
   `input_corrected: true` and the corrected form in
   `standardized.formatted_address`.
4. **Rate-limit handling.** Drop `maxRetries: 0` temporarily and hammer
   the typeahead. Confirm your UI gracefully shows the 429.
5. **A non-Latin script country.** If you ship to Japan or Saudi
   Arabia, send a kanji / Arabic address. Acuris returns side-by-side
   Latin + native fields — make sure your UI doesn't drop the native form.

---

## Common pitfalls

**API key empty in production.** Vercel doesn't inherit `.env.local`;
set `ACURIS_API_KEY` in the project Environment Variables and rebuild
after the change.

**ISO-2 vs ISO-3 confusion.** commercetools uses ISO-2 (`"DE"`); Acuris
uses ISO-3 (`"deu"`). The proxy routes do the conversion in one place
via `iso2ToIso3`. Don't pre-convert before posting to the proxy.

**Hydration mismatch on first paint.** Define the `endpoints` object as
a module constant (not inline in JSX) and memoize the `address` prop —
otherwise Next.js may warn about prop instability on the initial
hydration.

**Custom fields on Address.** commercetools allows merchants to attach
arbitrary `custom` fields to addresses. The connector currently
preserves them through `toBaseAddress(result, base)` — set them on
`base` and they survive the round-trip. A future minor release will add
an opt-in `annotate` mode that writes Acuris confidence + accuracy_type
into `custom` automatically.

---

## Going further

- **Batch validation.** Re-validate your customer DB nightly via the
  SDK directly in a worker. The SDK is the same `@acuris-geo/av-sdk`
  used here.
- **commercetools Connect.** Marketplace listing requires a partner
  account at [partner.commercetools.com](https://partner.commercetools.com).
  The extension handler is Connect-compatible — wrap `processExtension`
  in a Connect-conformant entry point.
- **Multi-ship carts.** `setItemShippingAddress` works the same way;
  the API Extension already validates each address independently.

For anything unclear, file an issue at
[github.com/Acuris-GmbH/acuris-commercetools-connector/issues](https://github.com/Acuris-GmbH/acuris-commercetools-connector/issues)
or email `support@acuris-geo.com`.

# commercetools-storefront-example

Minimal Next.js (pages router) app that demonstrates the Acuris
commercetools connector end-to-end. Used by Vercel as the deploy target
at [acuris-commercetools-demo.vercel.app](https://acuris-commercetools-demo.vercel.app).

- `@acuris-geo/commercetools-checkout` — `<AcurisAddressInput>` + `<AcurisAddressValidator>` in the browser.
- `@acuris-geo/av-sdk` — server-side, behind two Next.js API routes that proxy to Acuris.

## Run locally

```bash
# inside this directory (NOT the repo root — uses --no-workspaces install)
npm install
cp .env.example .env.local
# edit .env.local and set ACURIS_API_KEY=<your key>
npm run dev
# open http://localhost:3000/checkout
```

## Deploy to Vercel

```bash
npx vercel --prod
# then set ACURIS_API_KEY in Project Settings → Environment Variables
```

The included `vercel.json` pins `installCommand: "npm install --no-workspaces"`
so Vercel resolves dependencies from the public npm registry instead of
trying to follow the parent monorepo's workspace symlinks.

## File map

```
pages/
  index.tsx                  Landing page (links to /checkout)
  checkout.tsx               Demo with <AcurisAddressInput>/<AcurisAddressValidator>
  api/
    acuris/
      validate.ts            POST proxy → av-sdk validateAddress
      suggest.ts             GET  proxy → av-sdk suggestAddress
styles/
  globals.css                Light-touch styles (the heavy styling lives in
                             styled-jsx inside checkout.tsx)
vercel.json                  installCommand: npm install --no-workspaces
.env.example                 Template for ACURIS_API_KEY
package-lock.json            Standalone lockfile (regenerated outside the
                             monorepo workspace so Vercel can `npm ci` it)
```

## Why a proxy?

The Acuris API key must stay on the server. The components in
`@acuris-geo/commercetools-checkout` call _your_ endpoints (`/api/acuris/*`
here) which forward to `api.acuris-geo.com` with the key attached. See
`docs/architecture.md` in the repo root for the full picture.

## Country code translation

commercetools uses ISO-2 (`"DE"`, `"US"`, `"NL"`). Acuris uses ISO-3
lowercase (`"deu"`, `"usa"`, `"nld"`). The proxy routes call
`iso2ToIso3()` from `@acuris-geo/commercetools-checkout` before invoking
the SDK — see `pages/api/acuris/validate.ts`. This keeps the wire format
commercetools-native end-to-end.

## What this sample is NOT

- A real commercetools integration (no Cart mutations, no project setup).
- A real checkout (no cart, no payments, no inventory).
- A demonstration of the API Extension (that lives in
  `packages/acuris-commercetools-extension/` and deploys to Lambda, not Vercel).

The goal is to show, in ~150 lines of app code, how to wire the React
package into a commercetools-shaped storefront. Real commercetools
storefronts replace the surrounding UI with their own (Alokai,
commercetools Frontend, custom Next.js BFF).

# @acuris-geo/commercetools-extension

> commercetools API Extension handler for Acuris Address Validation &
> Geocoding. Synchronously validates `setShippingAddress` /
> `setBillingAddress` on Cart updates and either **rewrites** to the
> canonical address or **rejects** with `InvalidInput`. Server-side, no
> bypass.

**Status:** beta (`0.1.0`).

## Install

```bash
npm install @acuris-geo/commercetools-extension
```

## Why server-side

Storefront-only address validation can be bypassed: a buyer can call
`POST /me/carts/{id}` directly with bad data. The API Extension closes
that hole by running on every Cart update inside commercetools, before
the cart persists. Per
[docs.commercetools.com/api/projects/api-extensions](https://docs.commercetools.com/api/projects/api-extensions),
the handler can either return replacement update actions (200) or abort
with structured errors (400). We expose both modes.

## Quick start (AWS Lambda)

```ts
import { buildLambdaHandler } from "@acuris-geo/commercetools-extension";

export const handler = buildLambdaHandler({
  apiKey: process.env.ACURIS_API_KEY!,
  mode: "rewrite",        // rewrite (default), reject, or annotate
  minConfidence: 0.8,
});
```

Register the Lambda URL in **Merchant Center → Settings → Developer
settings → API Extensions** with trigger `Cart: Update` and authentication
of your choice (AWS Lambda authorizer / X-API-Key / basic auth — the
extension itself is transport-agnostic).

## Modes

| Mode | Behaviour |
|---|---|
| `rewrite` (default) | Replace the inbound address with Acuris's standardized form. Below `minConfidence` the inbound stays as-is. |
| `reject` | Return `InvalidInput` if confidence is below `minConfidence`. Cart update aborts; buyer sees the error. |
| `annotate` | Don't change the address; future minor release will attach Custom Fields (`acurisConfidence`, `acurisAccuracyType`). Currently a no-op placeholder for the merchant to slot their own logic. |

Identity fields (`firstName`, `lastName`, `company`, `apartment`,
`building`, `pOBox`, `phone`, …) are preserved verbatim in `rewrite` mode
— only the geographical components are updated.

## Other runtime adapters

```ts
// Generic async (your own router):
import { buildExtensionHandler } from "@acuris-geo/commercetools-extension";
const handler = buildExtensionHandler({ apiKey });
const responseBody = await handler(requestBody);

// Raw Node http (Express, fastify wrappers, etc):
import { buildNodeHttpHandler } from "@acuris-geo/commercetools-extension";
app.post("/acuris-extension", buildNodeHttpHandler({ apiKey }));
```

For commercetools **Connect** deployments, wrap `processExtension` in a
Connect-conformant handler — the `processExtension` core takes a parsed
request body and returns the response payload directly.

## Configuration

| Option | Default | Notes |
|---|---|---|
| `apiKey` | `process.env.ACURIS_API_KEY` | Required. |
| `mode` | `"rewrite"` | See above. |
| `minConfidence` | `0.8` | Below this, treated as a no-match. |
| `baseUrl` | `https://api.acuris-geo.com` | Override for self-hosted. |
| `timeoutMs` | `3500` | commercetools enforces ≤ 10 s; we default well under. |
| `skipCountries` | `[]` | ISO-2 codes to bypass entirely. |

## Failure semantics

Network errors and Acuris-side outages **do not block** Cart updates.
The handler logs internally and lets the inbound action stand — the
opposite of the buyer-blocking failure mode you'd get from a strict
implementation. If you want fail-closed behaviour, raise an issue.

## License

MIT © Acuris GmbH

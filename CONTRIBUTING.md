# Contributing

Thanks for your interest in improving the Acuris commercetools connector. This repo
holds two npm packages and a sample Next.js storefront; contributions to any of them
are welcome.

## Ground rules

- The connector is **MIT-licensed** and intentionally minimal. Prefer fewer dependencies
  and clearer surface area over feature breadth.
- Phase 1 is **beta**. Behaviour and types may still change between minor versions until
  we tag `1.0.0`.
- The packages target Node 18+ and React 18+. We use native `fetch` everywhere —
  please don't introduce `axios`, `node-fetch`, or polyfills.
- The address-validation SDK lives in a separate package (`@acuris-geo/av-sdk`)
  consumed from npm. Don't vendor or modify it here.

## Development setup

```bash
git clone https://github.com/Acuris-GmbH/acuris-commercetools-connector.git
cd acuris-commercetools-connector
npm install
npm run build
npm test
```

The workspace is wired with npm workspaces. Common scripts:

| Script              | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run build`     | Compile all packages.                                 |
| `npm test`          | Run unit + component tests across the workspace.      |
| `npm run typecheck` | Type-check without emitting.                          |
| `npm run lint`      | Lint each package (where a `lint` script exists).     |

## Project structure

```
packages/
  acuris-commercetools-checkout/    # React widgets + hooks
  acuris-commercetools-extension/   # Node API Extension handler
examples/
  commercetools-storefront/         # Next.js demo
docs/
  commercetools-integration-guide.md
  architecture.md
  research.md
```

## Pull requests

1. Fork & branch from `main`.
2. Keep PRs small and focused. One feature or bug fix per PR.
3. Add or update tests for new behaviour. Coverage is checked in CI.
4. Run `npm run typecheck && npm test` locally before pushing.
5. Update the relevant README or doc page in the same PR — drift is a regression.

## Reporting issues

Open a GitHub issue with:

- Which package (`acuris-commercetools-checkout` or `acuris-commercetools-extension`) and version.
- Minimal reproduction (a curl call, a short component snippet, or a repo link).
- Expected vs. actual behaviour.

For security issues, please email `security@acuris-geo.com` instead of filing a public
issue.

## Code of conduct

Be kind. Disagree with the idea, not the person. We follow the spirit of the
[Contributor Covenant](https://www.contributor-covenant.org/).

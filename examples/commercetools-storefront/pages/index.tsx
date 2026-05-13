import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.25rem 4rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <h1>Acuris × commercetools — sample storefront</h1>
      <p>
        Minimal Next.js app showing how a commercetools merchant wires the
        Acuris connector into their checkout flow. It uses{" "}
        <code>@acuris-geo/commercetools-checkout</code> on the client and{" "}
        <code>@acuris-geo/av-sdk</code> behind a Next.js API route.
      </p>
      <p>
        <Link href="/checkout">→ Go to the demo checkout</Link>
      </p>
      <h2>How it works</h2>
      <ol>
        <li>Browser renders the address fields with <code>&lt;AcurisAddressInput&gt;</code>.</li>
        <li>Each keystroke (debounced) hits <code>/api/acuris/suggest</code> on this app.</li>
        <li>That route converts the ISO-2 country code to ISO-3 and calls the SDK with <code>ACURIS_API_KEY</code>.</li>
        <li>On submit, <code>&lt;AcurisAddressValidator&gt;</code> POSTs the structured <code>BaseAddress</code> to <code>/api/acuris/validate</code>.</li>
        <li>Acuris returns a result with <code>accuracy_type</code>, <code>confidence</code>, and a standardized address.</li>
      </ol>
      <h2>Enterprise hardening</h2>
      <p>
        For production, pair this storefront component with{" "}
        <code>@acuris-geo/commercetools-extension</code> — a Lambda/Node
        handler that runs as a commercetools API Extension on Cart updates.
        The React component guides the buyer; the extension closes the
        bypass.
      </p>
      <p>
        Read{" "}
        <a href="https://github.com/Acuris-GmbH/acuris-commercetools-connector/blob/main/docs/commercetools-integration-guide.md">
          the integration guide
        </a>{" "}
        for production wiring against Alokai, commercetools Frontend, or a
        custom Next.js BFF.
      </p>
    </main>
  );
}

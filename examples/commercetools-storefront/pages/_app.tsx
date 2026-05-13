import { useEffect } from "react";
import type { AppProps } from "next/app";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  // Warm the /api/acuris/suggest serverless function on first paint so the
  // user's first typeahead keystroke doesn't pay a 500-1500 ms Vercel
  // cold-start. Empty `q=` short-circuits in the SDK (returns []), so no
  // Acuris credits are consumed by this prefetch.
  useEffect(() => {
    fetch("/api/acuris/suggest?country=DE&q=").catch(() => undefined);
  }, []);

  return <Component {...pageProps} />;
}

import { useEffect, useRef, useState } from "react";
import type { SuggestionHit } from "@acuris-geo/av-sdk";
import { getSuggestViaProxy } from "./transport.js";

export interface UseAcurisSuggestArgs {
  endpoint?: string;
  /** ISO-2 country (commercetools-native). */
  country: string;
  q: string;
  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
  /** commercetools `region` for state bias. */
  region?: string;
}

export interface UseAcurisSuggestReturn {
  suggestions: SuggestionHit[];
  isLoading: boolean;
  error?: Error;
}

/** Debounced typeahead hook. Cancels stale inflight requests automatically. */
export function useAcurisSuggest(args: UseAcurisSuggestArgs): UseAcurisSuggestReturn {
  const [suggestions, setSuggestions] = useState<SuggestionHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const inflight = useRef<AbortController | null>(null);

  const minLen = args.minQueryLength ?? 3;
  const debounce = args.debounceMs ?? 200;

  useEffect(() => {
    if (!args.endpoint) {
      setSuggestions([]);
      return undefined;
    }
    const q = args.q.trim();
    if (q.length < minLen) {
      setSuggestions([]);
      setIsLoading(false);
      setError(undefined);
      return undefined;
    }
    const handle = setTimeout(() => {
      if (inflight.current) inflight.current.abort();
      const ac = new AbortController();
      inflight.current = ac;
      setIsLoading(true);
      setError(undefined);
      getSuggestViaProxy(args.endpoint!, args.country, q, {
        limit: args.limit ?? 5,
        region: args.region,
        signal: ac.signal,
      })
        .then((hits) => {
          if (ac.signal.aborted) return;
          setSuggestions(hits);
        })
        .catch((err) => {
          if (ac.signal.aborted) return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setSuggestions([]);
        })
        .finally(() => {
          if (ac.signal.aborted) return;
          setIsLoading(false);
          if (inflight.current === ac) inflight.current = null;
        });
    }, debounce);

    return () => {
      clearTimeout(handle);
    };
  }, [args.endpoint, args.country, args.q, minLen, debounce, args.limit, args.region]);

  useEffect(() => {
    return () => {
      if (inflight.current) inflight.current.abort();
    };
  }, []);

  return { suggestions, isLoading, error };
}

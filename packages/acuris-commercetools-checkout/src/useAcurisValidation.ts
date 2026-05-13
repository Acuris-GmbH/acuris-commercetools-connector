import { useCallback, useRef, useState } from "react";
import type { ValidationResult } from "@acuris-geo/av-sdk";
import { postValidateViaProxy } from "./transport.js";
import type { AcurisEndpoints, BaseAddress } from "./types.js";

export type ValidationStatus = "idle" | "loading" | "ok" | "error";

export interface UseAcurisValidationArgs {
  endpoints: AcurisEndpoints;
  /** ISO-2 country code (commercetools-native, e.g. "DE"). */
  country: string;
}

export interface UseAcurisValidationReturn {
  status: ValidationStatus;
  result?: ValidationResult;
  error?: Error;
  validate: (address: BaseAddress | string) => Promise<ValidationResult | undefined>;
  reset: () => void;
}

/**
 * Headless validation hook. Cancels any inflight request when `validate`
 * is called again so the latest call always wins.
 */
export function useAcurisValidation(
  args: UseAcurisValidationArgs,
): UseAcurisValidationReturn {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [result, setResult] = useState<ValidationResult | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const inflight = useRef<AbortController | null>(null);

  const validate = useCallback(
    async (address: BaseAddress | string) => {
      if (inflight.current) inflight.current.abort();
      const ac = new AbortController();
      inflight.current = ac;
      setStatus("loading");
      setError(undefined);
      try {
        const v = await postValidateViaProxy(
          args.endpoints.validate,
          args.country,
          address,
          ac.signal,
        );
        if (ac.signal.aborted) return undefined;
        setResult(v);
        setStatus("ok");
        return v;
      } catch (err) {
        if (ac.signal.aborted) return undefined;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus("error");
        return undefined;
      } finally {
        if (inflight.current === ac) inflight.current = null;
      }
    },
    [args.endpoints.validate, args.country],
  );

  const reset = useCallback(() => {
    if (inflight.current) inflight.current.abort();
    inflight.current = null;
    setStatus("idle");
    setResult(undefined);
    setError(undefined);
  }, []);

  return { status, result, error, validate, reset };
}

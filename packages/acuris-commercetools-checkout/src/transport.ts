import type { AddressInput, SuggestionHit, ValidationResult } from "@acuris-geo/av-sdk";
import { iso2ToIso3 } from "./iso.js";
import type { BaseAddress } from "./types.js";
import { toAcurisInput } from "./boundary.js";

/**
 * Browser-safe wrappers that call _your_ proxy endpoints (never Acuris
 * directly). The proxy is expected to forward to the Acuris av-sdk with
 * the API key server-side — see the integration guide.
 *
 * On the wire we POST commercetools-native ISO-2 country codes. The proxy
 * should call `iso2ToIso3` server-side (or use our recommended proxy
 * snippet) before invoking the SDK.
 */

export async function postValidateViaProxy(
  endpoint: string,
  country: string,
  input: BaseAddress | string,
  signal?: AbortSignal,
): Promise<ValidationResult> {
  const body =
    typeof input === "string"
      ? { country, input }
      : { country, input: toAcurisInput(input) };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const parsed: unknown = await safeJson(res);
  if (!res.ok) {
    throw buildProxyError(res.status, parsed, endpoint);
  }
  return parsed as ValidationResult;
}

export async function getSuggestViaProxy(
  endpoint: string,
  country: string,
  q: string,
  options: { limit?: number; region?: string; signal?: AbortSignal } = {},
): Promise<SuggestionHit[]> {
  const url = new URL(endpoint, browserBaseUrl());
  url.searchParams.set("country", country);
  url.searchParams.set("q", q);
  if (options.limit) url.searchParams.set("limit", String(options.limit));
  if (options.region) url.searchParams.set("state", options.region);

  const target = url.toString().startsWith(browserBaseUrl())
    ? url.pathname + url.search
    : url.toString();

  const res = await fetch(target, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  const parsed: unknown = await safeJson(res);
  if (!res.ok) {
    throw buildProxyError(res.status, parsed, endpoint);
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { suggestions?: unknown }).suggestions)) {
    return (parsed as { suggestions: SuggestionHit[] }).suggestions;
  }
  return [];
}

/**
 * Convenience helper for the merchant's proxy: convert the wire `{country, input}`
 * (ISO-2 + commercetools fields) into the av-sdk's expected shape (ISO-3 +
 * Acuris fields). Exported so the proxy route can do the translation in a
 * single line.
 */
export function adaptWireToSdk(payload: {
  country: string;
  input: BaseAddress | string;
}): { country: string; input: AddressInput } {
  const country = iso2ToIso3(payload.country);
  if (typeof payload.input === "string") {
    return { country, input: payload.input };
  }
  return { country, input: toAcurisInput(payload.input) };
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function browserBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost";
}

function buildProxyError(status: number, body: unknown, endpoint: string): Error {
  const msg =
    (body && typeof body === "object" && typeof (body as { message?: string }).message === "string"
      ? (body as { message: string }).message
      : undefined) ??
    (body && typeof body === "object" && typeof (body as { error?: string }).error === "string"
      ? (body as { error: string }).error
      : undefined) ??
    `HTTP ${status} from ${endpoint}`;
  const err = new Error(msg);
  (err as { status?: number }).status = status;
  (err as { body?: unknown }).body = body;
  return err;
}

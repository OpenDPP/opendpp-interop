/**
 * @opendpp/eori — authoritative EORI validation
 *
 * Validates EORI numbers against the European Commission's official EOS validation
 * web service — the only authoritative validator for EU-issued EORIs, the machine
 * equivalent of the interactive page at
 * https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp
 *
 * The HTTP transport is injectable: by default the global `fetch` is used, but a
 * consumer (e.g. an SSRF-guarded server) can supply its own. The package itself
 * stays zero-dependency.
 *
 * Status semantics (from the service): `status` 0 = valid (the operator exists in
 * the EORI register), 1 = not valid. `valid` is derived as `status === 0`; the raw
 * `status` and `statusDescription` are always surfaced so callers are never locked
 * to that interpretation.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use
 * this file except in compliance with the License. You may obtain a copy of the
 * License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * "OpenDPP" is a trademark of Opendpp UAB; the Apache-2.0 license grants no rights to the marks.
 */

import { classifyEoriCountry, type EoriCountryScope } from "./countries.js";
import { isValidEoriSyntax, normalizeEori } from "./format.js";
import { defaultEoriRateLimiter, type RateLimiter } from "./rate-limit.js";
import {
  EoriServiceError,
  buildValidateEoriEnvelope,
  parseValidateEoriResponse,
  type RawEoriResult,
} from "./soap.js";

/** Official EOS validation service endpoint (SOAP). */
export const EORI_VALIDATION_ENDPOINT =
  "https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation";

/** WSDL for the EOS validation service. */
export const EORI_VALIDATION_WSDL = `${EORI_VALIDATION_ENDPOINT}?wsdl`;

/** Human-facing EU Commission EORI validator (informational). */
export const EORI_VALIDATION_HOMEPAGE =
  "https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp";

/** The EOS service accepts at most 10 EORIs per request. */
export const MAX_EORI_PER_REQUEST = 10;

const DEFAULT_TIMEOUT_MS = 15_000;

/** Where the answer in an {@link EoriValidationResult} came from. */
export type EoriValidationSource = "ec-europa-eos" | "offline-syntax";

/** Minimal response surface a transport must expose. */
export interface EoriTransportResponse {
  status: number;
  text(): Promise<string>;
}

/** Request a transport receives. Mirrors the relevant `fetch` init fields. */
export interface EoriTransportRequest {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

/**
 * Pluggable HTTP transport. The default uses the global `fetch`; a server can
 * inject an SSRF-guarded implementation (the endpoint host is fixed to
 * ec.europa.eu, so pinning is straightforward).
 */
export type EoriTransport = (
  url: string,
  request: EoriTransportRequest,
) => Promise<EoriTransportResponse>;

export interface ValidateEoriOptions {
  /** override the HTTP transport (default: global `fetch`) */
  transport?: EoriTransport;
  /** override the service endpoint (default: {@link EORI_VALIDATION_ENDPOINT}) */
  endpoint?: string;
  /** per-call timeout in ms (default 15000); ignored if `signal` is supplied */
  timeoutMs?: number;
  /** caller-controlled abort signal */
  signal?: AbortSignal;
  /**
   * Per-call rate-limit override. Omit to use the shared process default
   * ({@link DEFAULT_REQUESTS_PER_SECOND} = 100, the EU service cap). Pass a limiter
   * from `createEoriRateLimiter(n)` (created ONCE and reused) to share a higher
   * granted limit across calls, or `null` to disable throttling for this call.
   */
  rateLimiter?: RateLimiter | null;
}

/** The outcome of validating a single EORI. */
export interface EoriValidationResult {
  /** the caller's raw input */
  input: string;
  /** the normalised EORI that was (or would have been) queried */
  eori: string;
  /** true iff the EU service returned status 0 (operator exists in the register) */
  valid: boolean;
  /** whether `input` is even syntactically a possible EORI (offline pre-check) */
  validSyntax: boolean;
  /** raw status: 0 = valid, 1 = not valid; null when not queried or omitted */
  status: number | null;
  /** the service's human-readable status (statusDescr), or a local explanation */
  statusDescription: string;
  /** registered name — only present when the operator consented to publication */
  name?: string;
  address?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  /** request timestamp echoed by the service */
  requestDate?: string;
  /** advisory country-prefix scope; does NOT override `valid` */
  countryScope: EoriCountryScope;
  /** advisory caveat about the country prefix (e.g. GB validated by HMRC) */
  countryNote?: string;
  /** where this answer came from */
  source: EoriValidationSource;
  /** ISO 8601 timestamp of when this client produced the result */
  checkedAt: string;
}

const defaultTransport: EoriTransport = async (url, request) => {
  const res = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
  });
  return { status: res.status, text: () => res.text() };
};

function resolveSignal(options: ValidateEoriOptions): AbortSignal | undefined {
  if (options.signal) return options.signal;
  const ms = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return ms > 0 ? AbortSignal.timeout(ms) : undefined;
}

function resolveRateLimiter(options: ValidateEoriOptions): RateLimiter | null {
  // explicit (instance or null) wins; otherwise the shared process default
  return options.rateLimiter !== undefined ? options.rateLimiter : defaultEoriRateLimiter;
}

function offlineResult(input: string, normalized: string): EoriValidationResult {
  const country = classifyEoriCountry(normalized);
  return {
    input,
    eori: normalized,
    valid: false,
    validSyntax: false,
    status: null,
    statusDescription:
      "Not queried: input is not a syntactically valid EORI (expected a 2-letter country code followed by up to 15 alphanumeric characters).",
    countryScope: country.scope,
    countryNote: country.note,
    source: "offline-syntax",
    checkedAt: new Date().toISOString(),
  };
}

function toResult(
  input: string,
  normalized: string,
  raw: RawEoriResult | undefined,
  requestDate: string | undefined,
  checkedAt: string,
): EoriValidationResult {
  const country = classifyEoriCountry(normalized);
  if (!raw) {
    // The service did not echo this number back — report it honestly, don't guess.
    return {
      input,
      eori: normalized,
      valid: false,
      validSyntax: true,
      status: null,
      statusDescription: "The validation service did not return a result for this EORI.",
      requestDate,
      countryScope: country.scope,
      countryNote: country.note,
      source: "ec-europa-eos",
      checkedAt,
    };
  }
  return {
    input,
    eori: normalized,
    valid: raw.status === 0,
    validSyntax: true,
    status: raw.status,
    statusDescription: raw.statusDescription,
    name: raw.name,
    address: raw.address,
    street: raw.street,
    postalCode: raw.postalCode,
    city: raw.city,
    country: raw.country,
    requestDate,
    countryScope: country.scope,
    countryNote: country.note,
    source: "ec-europa-eos",
    checkedAt,
  };
}

async function queryService(
  normalizedChunk: string[],
  options: ValidateEoriOptions,
): Promise<{ results: RawEoriResult[]; requestDate?: string }> {
  const transport = options.transport ?? defaultTransport;
  const endpoint = options.endpoint ?? EORI_VALIDATION_ENDPOINT;
  const envelope = buildValidateEoriEnvelope(normalizedChunk);

  // Pace to the service cap BEFORE creating the timeout signal, so the queue wait
  // is bounded by the caller's own signal (if any) but not by the HTTP timeout.
  const limiter = resolveRateLimiter(options);
  if (limiter) await limiter.acquire(options.signal);

  let response: EoriTransportResponse;
  try {
    response = await transport(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
        Accept: "text/xml, application/soap+xml",
      },
      body: envelope,
      signal: resolveSignal(options),
    });
  } catch (cause) {
    throw new EoriServiceError("EORI validation request failed (transport error).", { cause });
  }

  const text = await response.text();
  if (response.status < 200 || response.status >= 300) {
    // A SOAP Fault may travel with HTTP 500 — let the parser surface the faultstring.
    if (/<(?:[\w.-]+:)?Fault(?:\s|>)/i.test(text)) return parseAndNormalize(text);
    throw new EoriServiceError(
      `EORI validation service returned HTTP ${response.status}.`,
    );
  }
  return parseAndNormalize(text);
}

function parseAndNormalize(text: string): { results: RawEoriResult[]; requestDate?: string } {
  const parsed = parseValidateEoriResponse(text);
  if (parsed.errorDescription && parsed.results.length === 0) {
    throw new EoriServiceError(`EORI service error: ${parsed.errorDescription}`);
  }
  return { results: parsed.results, requestDate: parsed.requestDate };
}

function findRaw(results: RawEoriResult[], normalized: string): RawEoriResult | undefined {
  return results.find((r) => normalizeEori(r.eori) === normalized);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Validate one EORI against the EU Commission EOS service.
 *
 * Syntactically-impossible input is reported offline (no network round-trip) with
 * `source: "offline-syntax"`. Everything else is sent to the authoritative service.
 */
export async function validateEori(
  input: string,
  options: ValidateEoriOptions = {},
): Promise<EoriValidationResult> {
  const [result] = await validateEoriBatch([input], options);
  // batch always returns one result per input, in order
  return result as EoriValidationResult;
}

/**
 * Validate up to many EORIs, transparently chunking into requests of
 * {@link MAX_EORI_PER_REQUEST}. Returns one result per input, in the input order.
 */
export async function validateEoriBatch(
  inputs: readonly string[],
  options: ValidateEoriOptions = {},
): Promise<EoriValidationResult[]> {
  const prepared = inputs.map((input) => {
    const raw = String(input ?? "");
    const normalized = normalizeEori(raw);
    return { raw, normalized, queryable: isValidEoriSyntax(normalized) };
  });

  const toQuery = prepared.filter((p) => p.queryable);
  const byNormalized = new Map<string, RawEoriResult>();
  let requestDate: string | undefined;

  if (toQuery.length > 0) {
    // de-duplicate so a repeated EORI uses a single slot in the 10-per-request budget
    const uniqueNormalized = [...new Set(toQuery.map((p) => p.normalized))];
    for (const group of chunk(uniqueNormalized, MAX_EORI_PER_REQUEST)) {
      const { results, requestDate: rd } = await queryService(group, options);
      if (rd && !requestDate) requestDate = rd;
      for (const norm of group) {
        const raw = findRaw(results, norm);
        if (raw) byNormalized.set(norm, raw);
      }
    }
  }

  const checkedAt = new Date().toISOString();
  return prepared.map((p) => {
    if (!p.queryable) return offlineResult(p.raw, p.normalized);
    return toResult(p.raw, p.normalized, byNormalized.get(p.normalized), requestDate, checkedAt);
  });
}

/** Convenience: resolve to `true` iff the EORI is valid per the EU service. */
export async function isEoriRegistered(
  input: string,
  options: ValidateEoriOptions = {},
): Promise<boolean> {
  const result = await validateEori(input, options);
  return result.valid;
}

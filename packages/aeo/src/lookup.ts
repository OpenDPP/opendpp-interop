/**
 * @opendpp/aeo — authoritative AEO lookup
 *
 * Looks up Authorised Economic Operator (trusted-trader) status against the
 * European Commission's official EOS aeo-retrieve web service — the machine
 * equivalent of the interactive page at
 * https://ec.europa.eu/taxation_customs/dds2/eos/aeo_consultation.jsp
 *
 * The service is a HOLDER DIRECTORY SEARCH, not an identifier validator: you search
 * by holder name (substring), optionally filtered by issuing country and
 * authorisation type (AEOC/AEOF/AEOS, at least one required), and it returns the
 * matching authorisations (holder name, issuing country, competent customs
 * authority, type, effective date). A search with no matches is a valid empty
 * result, not an error.
 *
 * The HTTP transport is injectable (default global `fetch`); the package itself
 * stays zero-dependency. Requests are paced to the EU cap (see ./rate-limit).
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

import {
  AUTHORISATION_TYPES,
  isAuthorisationType,
  normalizeCountryCode,
  normalizeHolderName,
  type AuthorisationType,
} from "./format.js";
import { defaultAeoRateLimiter, type RateLimiter } from "./rate-limit.js";
import {
  AeoServiceError,
  buildRetrieveAeoEnvelope,
  parseRetrieveAeoResponse,
  type AeoRawResult,
} from "./soap.js";

/** Official EOS aeo-retrieve service endpoint (SOAP). */
export const AEO_RETRIEVE_ENDPOINT =
  "https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/aeo-retrieve";

/** WSDL for the aeo-retrieve service. */
export const AEO_RETRIEVE_WSDL = `${AEO_RETRIEVE_ENDPOINT}?wsdl`;

/** Human-facing EU Commission AEO consultation page (informational). */
export const AEO_CONSULTATION_HOMEPAGE =
  "https://ec.europa.eu/taxation_customs/dds2/eos/aeo_consultation.jsp";

/**
 * The EOS service accepts up to 10 search criteria per request, but this client
 * sends ONE per request: the flat result list cannot be attributed back to
 * individual criteria, so one-per-request keeps results unambiguous.
 */
export const MAX_CRITERIA_PER_REQUEST = 10;

const DEFAULT_TIMEOUT_MS = 15_000;

/** Minimal response surface a transport must expose. */
export interface AeoTransportResponse {
  status: number;
  text(): Promise<string>;
}

/** Request a transport receives. Mirrors the relevant `fetch` init fields. */
export interface AeoTransportRequest {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

/** Pluggable HTTP transport (default: global `fetch`; a server can inject an SSRF-guarded one). */
export type AeoTransport = (
  url: string,
  request: AeoTransportRequest,
) => Promise<AeoTransportResponse>;

/** A holder search. */
export interface AeoQuery {
  /** holder name (or AEO number) to search — the service does a substring match */
  holderName: string;
  /** optional 2-letter ISO issuing-country filter */
  issuingCountry?: string;
  /** authorisation type(s) to include; defaults to all three (AEOC, AEOF, AEOS) */
  authorisationType?: AuthorisationType | readonly AuthorisationType[];
}

export interface LookupAeoOptions {
  /** override the HTTP transport (default: global `fetch`) */
  transport?: AeoTransport;
  /** override the service endpoint (default: {@link AEO_RETRIEVE_ENDPOINT}) */
  endpoint?: string;
  /** per-call timeout in ms (default 15000); ignored if `signal` is supplied */
  timeoutMs?: number;
  /** caller-controlled abort signal */
  signal?: AbortSignal;
  /**
   * Per-call rate-limit override. Omit to use the shared process default (100/s, the
   * EU cap). Pass a limiter from `createAeoRateLimiter(n)` (created ONCE and reused)
   * to share a higher granted limit, or `null` to disable throttling for this call.
   */
  rateLimiter?: RateLimiter | null;
}

/** One AEO authorisation returned by the service. */
export interface AeoAuthorisation {
  /** registered authorisation-holder name */
  authorisationHolderName?: string;
  /** issuing country — the full country NAME as returned by the service */
  issuingCountry?: string;
  /** competent customs authority code (e.g. "DE007600") */
  competentCustomsAuthority?: string;
  /** authorisation type: AEOC (customs), AEOS (security), AEOF (combined) */
  authorisationType?: AuthorisationType;
  /** effective date as returned by the service (DD/MM/YYYY) */
  effectiveDate?: string;
}

/** The outcome of an AEO holder lookup. */
export interface AeoLookupResult {
  /** the normalised query that was sent */
  query: { holderName: string; issuingCountry?: string; authorisationTypes: AuthorisationType[] };
  /** whether the service returned at least one matching authorisation */
  found: boolean;
  /** all matching authorisations (a name substring can match several holders/types) */
  matches: AeoAuthorisation[];
  /** request timestamp echoed by the service */
  requestDate?: string;
  /** the authoritative source consulted */
  source: "ec-europa-eos";
  /** ISO 8601 timestamp of when this client produced the result */
  checkedAt: string;
}

interface PreparedAeoQuery {
  holderName: string;
  issuingCountry?: string;
  authorisationTypes: AuthorisationType[];
}

const defaultTransport: AeoTransport = async (url, request) => {
  const res = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
  });
  return { status: res.status, text: () => res.text() };
};

function resolveSignal(options: LookupAeoOptions): AbortSignal | undefined {
  if (options.signal) return options.signal;
  const ms = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return ms > 0 ? AbortSignal.timeout(ms) : undefined;
}

function resolveRateLimiter(options: LookupAeoOptions): RateLimiter | null {
  return options.rateLimiter !== undefined ? options.rateLimiter : defaultAeoRateLimiter;
}

function resolveTypes(input: AeoQuery["authorisationType"]): AuthorisationType[] {
  if (input === undefined || input === null) return [...AUTHORISATION_TYPES];
  const arr = Array.isArray(input) ? input : [input];
  const out: AuthorisationType[] = [];
  for (const v of arr) {
    const up = String(v).toUpperCase();
    if (isAuthorisationType(up) && !out.includes(up)) out.push(up);
  }
  return out.length > 0 ? out.slice(0, 3) : [...AUTHORISATION_TYPES];
}

function prepareQuery(query: AeoQuery): PreparedAeoQuery {
  const holderName = normalizeHolderName(query?.holderName);
  if (!holderName) throw new Error("lookupAeo: query.holderName is required.");

  let issuingCountry: string | undefined;
  const rawCountry = query?.issuingCountry;
  if (rawCountry !== undefined && rawCountry !== null && String(rawCountry).trim() !== "") {
    const code = normalizeCountryCode(rawCountry);
    if (!code) throw new Error("lookupAeo: query.issuingCountry must be a 2-letter ISO country code.");
    issuingCountry = code;
  }

  return { holderName, issuingCountry, authorisationTypes: resolveTypes(query?.authorisationType) };
}

function toAuthorisation(raw: AeoRawResult): AeoAuthorisation {
  const type = raw.authorisationType?.toUpperCase();
  return {
    authorisationHolderName: raw.authorisationHolderName,
    issuingCountry: raw.issuingCountry,
    competentCustomsAuthority: raw.competentCustomsAuthority,
    authorisationType: type && isAuthorisationType(type) ? type : undefined,
    effectiveDate: raw.effectiveDate,
  };
}

async function queryService(
  prepared: PreparedAeoQuery,
  options: LookupAeoOptions,
): Promise<{ results: AeoRawResult[]; requestDate?: string }> {
  const transport = options.transport ?? defaultTransport;
  const endpoint = options.endpoint ?? AEO_RETRIEVE_ENDPOINT;
  const envelope = buildRetrieveAeoEnvelope([
    {
      holderName: prepared.holderName,
      issuingCountry: prepared.issuingCountry,
      authorisationTypes: prepared.authorisationTypes,
    },
  ]);

  // Pace to the service cap BEFORE creating the timeout signal, so the queue wait is
  // bounded by the caller's own signal (if any) but not by the HTTP timeout.
  const limiter = resolveRateLimiter(options);
  if (limiter) await limiter.acquire(options.signal);

  let response: AeoTransportResponse;
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
    throw new AeoServiceError("AEO lookup request failed (transport error).", { cause });
  }

  const text = await response.text();
  if (response.status < 200 || response.status >= 300) {
    if (/<(?:[\w.-]+:)?Fault(?:\s|>)/i.test(text)) {
      // A SOAP Fault may travel with HTTP 500 — let the parser surface the faultstring.
      const parsed = parseRetrieveAeoResponse(text);
      return { results: parsed.results, requestDate: parsed.requestDate };
    }
    throw new AeoServiceError(`AEO retrieval service returned HTTP ${response.status}.`);
  }

  const parsed = parseRetrieveAeoResponse(text);
  if (parsed.errorDescription && parsed.results.length === 0) {
    throw new AeoServiceError(`AEO service error: ${parsed.errorDescription}`);
  }
  return { results: parsed.results, requestDate: parsed.requestDate };
}

/**
 * Look up AEO authorisations for a holder against the EU Commission EOS service.
 * Returns all matching authorisations; `found` is `matches.length > 0`.
 */
export async function lookupAeo(
  query: AeoQuery,
  options: LookupAeoOptions = {},
): Promise<AeoLookupResult> {
  const prepared = prepareQuery(query);
  const { results, requestDate } = await queryService(prepared, options);
  const matches = results.map(toAuthorisation);
  return {
    query: {
      holderName: prepared.holderName,
      issuingCountry: prepared.issuingCountry,
      authorisationTypes: prepared.authorisationTypes,
    },
    found: matches.length > 0,
    matches,
    requestDate,
    source: "ec-europa-eos",
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Look up several holders, one request each (paced by the rate limiter). Returns
 * one result per query, in the input order.
 */
export async function lookupAeoBatch(
  queries: readonly AeoQuery[],
  options: LookupAeoOptions = {},
): Promise<AeoLookupResult[]> {
  const out: AeoLookupResult[] = [];
  for (const query of queries) {
    out.push(await lookupAeo(query, options));
  }
  return out;
}

/** Convenience: resolve to `true` iff the holder has at least one AEO authorisation. */
export async function hasAeoAuthorisation(
  holderName: string,
  options: LookupAeoOptions = {},
): Promise<boolean> {
  const result = await lookupAeo({ holderName }, options);
  return result.found;
}

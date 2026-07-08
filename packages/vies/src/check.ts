/**
 * @opendpp/vies — online VAT-ID existence check (EU Commission VIES)
 *
 * Checks whether an EU VAT identifier is registered, against the European
 * Commission's official VIES REST service — the EU's authoritative cross-border VAT
 * validator, the machine equivalent of the interactive page at
 * https://ec.europa.eu/taxation_customs/vies/
 *
 * The HTTP transport is injectable: by default the global `fetch` is used, but a
 * consumer (e.g. an SSRF-guarded server) can supply its own. The package itself
 * stays zero-dependency.
 *
 * Syntactically-impossible input is answered offline (no network round-trip) with
 * `source: "offline-syntax"`; only well-formed VAT IDs reach the service. VIES is
 * queried one VAT ID per REST call and publishes no fixed numeric rate cap, so
 * batches are sent sequentially and a caller that needs throttling injects it via
 * the transport.
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

import { normalizeVatId, parseVatId } from "./format.js";

/** Official EU Commission VIES REST endpoint (one VAT ID per call). */
export const VIES_CHECK_URL =
  "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

/** Human-facing EU Commission VIES validator (informational). */
export const VIES_HOMEPAGE = "https://ec.europa.eu/taxation_customs/vies/";

const DEFAULT_TIMEOUT_MS = 8_000;

/** Thrown when the VIES service errors, is unreachable, or returns an unreadable response. */
export class ViesServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ViesServiceError";
  }
}

/** Minimal response surface a transport must expose. */
export type ViesTransportResponse = {
  status: number;
  text(): Promise<string>;
};

/** Request a transport receives. Mirrors the relevant `fetch` init fields. */
export type ViesTransportRequest = {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
};

/**
 * Pluggable HTTP transport. The default uses the global `fetch`; a server can inject
 * an SSRF-guarded implementation (the endpoint host is fixed to ec.europa.eu, so
 * pinning is straightforward).
 */
export type ViesTransport = (
  url: string,
  request: ViesTransportRequest,
) => Promise<ViesTransportResponse>;

/** Where the answer in a {@link ViesCheckResult} came from. */
export type ViesCheckSource = "ec-europa-vies" | "offline-syntax";

export type ViesCheckOptions = {
  /** override the HTTP transport (default: global `fetch`) */
  transport?: ViesTransport;
  /** override the service endpoint (default: {@link VIES_CHECK_URL}) */
  endpoint?: string;
  /** per-call timeout in ms (default 8000); ignored if `signal` is supplied */
  timeoutMs?: number;
  /** caller-controlled abort signal */
  signal?: AbortSignal;
};

/** The outcome of checking a single VAT ID. */
export interface ViesCheckResult {
  /** the caller's raw input */
  input: string;
  /** the normalised VAT ID that was (or would have been) queried */
  vatId: string;
  /** whether `input` is even syntactically a possible EU VAT ID (offline pre-check) */
  validSyntax: boolean;
  /** true iff VIES confirms the VAT ID is registered */
  valid: boolean;
  /** whether the online check actually ran (well-formed id + the service answered) */
  checked: boolean;
  /** registered trader name — only present when VIES discloses one */
  name?: string;
  /** registered trader address — only present when VIES discloses one */
  address?: string;
  /** the 2-letter VAT country prefix that was queried */
  countryCode?: string;
  /** request timestamp echoed by the service */
  requestDate?: string;
  /** the service's human-readable status, or a local explanation */
  statusDescription: string;
  /** where this answer came from */
  source: ViesCheckSource;
  /** ISO 8601 timestamp of when this client produced the result */
  checkedAt: string;
}

const defaultTransport: ViesTransport = async (url, request) => {
  const res = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
  });
  return { status: res.status, text: () => res.text() };
};

function resolveSignal(options: ViesCheckOptions): AbortSignal | undefined {
  if (options.signal) return options.signal;
  const ms = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return ms > 0 ? AbortSignal.timeout(ms) : undefined;
}

/**
 * Check whether a single VAT ID is registered in VIES.
 *
 * Syntactically-impossible input is reported offline (no network round-trip) with
 * `source: "offline-syntax"`, `checked: false`. Everything else is sent to the
 * authoritative service.
 */
export async function checkVatId(
  input: string,
  options: ViesCheckOptions = {},
): Promise<ViesCheckResult> {
  const parts = parseVatId(input);
  const checkedAt = new Date().toISOString();

  if (!parts.validSyntax) {
    return {
      input: parts.input,
      vatId: parts.normalized,
      validSyntax: false,
      valid: false,
      checked: false,
      statusDescription: "Not queried: not a syntactically valid EU VAT identifier.",
      source: "offline-syntax",
      checkedAt,
    };
  }

  const transport = options.transport ?? defaultTransport;
  const endpoint = options.endpoint ?? VIES_CHECK_URL;

  let response: ViesTransportResponse;
  try {
    response = await transport(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryCode: parts.countryCode, vatNumber: parts.number }),
      signal: resolveSignal(options),
    });
  } catch (cause) {
    throw new ViesServiceError("VIES VAT validation request failed (transport error).", { cause });
  }

  if (response.status < 200 || response.status >= 300) {
    throw new ViesServiceError(`VIES VAT validation service returned HTTP ${response.status}.`);
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (cause) {
    throw new ViesServiceError("VIES VAT validation service returned an unparseable response.", {
      cause,
    });
  }

  const data = (body ?? {}) as {
    valid?: unknown;
    name?: unknown;
    address?: unknown;
    requestDate?: unknown;
  };
  if (typeof data.valid !== "boolean") {
    throw new ViesServiceError("VIES VAT validation service returned an unrecognised response.");
  }
  const valid = data.valid;

  // VIES fills unavailable fields with "---" — only surface a real name/address.
  const name = typeof data.name === "string" && data.name !== "---" ? data.name : undefined;
  const address =
    typeof data.address === "string" && data.address !== "---" ? data.address : undefined;
  const requestDate = typeof data.requestDate === "string" ? data.requestDate : undefined;

  return {
    input: parts.input,
    vatId: parts.normalized,
    validSyntax: true,
    valid,
    checked: true,
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    countryCode: parts.countryCode,
    ...(requestDate ? { requestDate } : {}),
    statusDescription: valid ? "Valid" : "Not valid",
    source: "ec-europa-vies",
    checkedAt,
  };
}

/** Convenience: resolve to `true` iff VIES confirms the VAT ID is registered. */
export async function isVatRegistered(
  input: string,
  options: ViesCheckOptions = {},
): Promise<boolean> {
  const result = await checkVatId(input, options);
  return result.valid;
}

/**
 * Check many VAT IDs. VIES answers one VAT ID per REST call, so this queries
 * SEQUENTIALLY (a good citizen against a government endpoint — no parallel burst)
 * and caches by normalised id, so a repeated id is only queried once. Returns one
 * result per input, in the input order.
 */
export async function checkVatIdBatch(
  inputs: readonly string[],
  options: ViesCheckOptions = {},
): Promise<ViesCheckResult[]> {
  const byNormalized = new Map<string, ViesCheckResult>();
  const results: ViesCheckResult[] = [];
  for (const input of inputs) {
    const normalized = normalizeVatId(input);
    const cached = byNormalized.get(normalized);
    if (cached) {
      results.push({ ...cached, input: String(input ?? "") });
      continue;
    }
    const result = await checkVatId(input, options);
    byNormalized.set(normalized, result);
    results.push(result);
  }
  return results;
}

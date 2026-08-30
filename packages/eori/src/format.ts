/**
 * @opendpp/eori — offline EORI syntax + parsing
 *
 * Pure, zero-dependency helpers for the *shape* of an EORI number. Existence is
 * NOT verified here — for the authoritative check against the European
 * Commission's EOS validation web service see `validateEori` in `./validate`.
 *
 * The `isValidEoriSyntax` / `validateOperatorRegId` / `REG_ID_SCHEMES` exports are
 * lifted verbatim from the OpenDPP node (src/utils/eori.ts) so the hosted service
 * can consume this package as its single source, mirroring the @opendpp/gs1 flow.
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

/** Registration-id schemes an economic operator's `regId` may follow. */
export const REG_ID_SCHEMES = ["EORI", "VAT", "DUNS", "NATIONAL", "OTHER"] as const;
export type RegIdScheme = (typeof REG_ID_SCHEMES)[number];

/**
 * EORI syntax: 2-letter ISO-3166 country prefix + up to 15 alphanumeric characters
 * (EU eCustoms convention; the country's own national id forms the suffix). Syntax-only —
 * existence is NOT verified against the EU EORI online validation service.
 */
export function isValidEoriSyntax(regId: string): boolean {
  return /^[A-Z]{2}[A-Za-z0-9]{1,15}$/.test(String(regId || "").trim());
}

/**
 * Validate a regId/scheme pair for create/update paths.
 * Returns null when acceptable, else a human-readable error message.
 */
export function validateOperatorRegId(regId: unknown, scheme?: unknown): string | null {
  const id = String(regId ?? "").trim();
  if (!id) return "regId is required";
  if (/^EORI-MOCK/i.test(id)) {
    return "Fabricated registration ids (EORI-MOCK…) are not accepted — register the operator's real registration id.";
  }
  if (scheme === undefined || scheme === null || scheme === "") return null;
  const s = String(scheme).toUpperCase();
  if (!REG_ID_SCHEMES.includes(s as RegIdScheme)) {
    return `regIdScheme must be one of: ${REG_ID_SCHEMES.join(", ")}`;
  }
  if (s === "EORI" && !isValidEoriSyntax(id)) {
    return "regId is not a syntactically valid EORI (expected a 2-letter country code followed by up to 15 alphanumeric characters, e.g. DE1234567890).";
  }
  return null;
}

/**
 * Canonicalise an EORI for transmission/comparison: strip ASCII whitespace and
 * upper-case. The EU service is case-insensitive but conventionally upper-cases;
 * internal punctuation is left intact so genuinely malformed input still fails
 * `isValidEoriSyntax` rather than being silently "repaired".
 */
export function normalizeEori(input: unknown): string {
  return String(input ?? "")
    .replaceAll(/\s+/g, "")
    .toUpperCase();
}

/** Structured view of an EORI number. */
export interface EoriParts {
  /** the caller's raw input */
  input: string;
  /** `input` whitespace-stripped + upper-cased (the form sent to the service) */
  normalized: string;
  /** the 2-letter ISO-3166 country/area prefix, or "" when not parseable */
  countryCode: string;
  /** the national identifier following the country code, or "" */
  identifier: string;
  /** whether `normalized` matches the EORI syntax */
  validSyntax: boolean;
}

/**
 * Split an EORI into its country prefix + national identifier (after normalisation).
 * Never throws; `validSyntax` reports whether the normalised value is well-formed.
 */
export function parseEori(input: unknown): EoriParts {
  const raw = String(input ?? "");
  const normalized = normalizeEori(raw);
  const validSyntax = isValidEoriSyntax(normalized);
  const countryCode = /^[A-Z]{2}/.test(normalized) ? normalized.slice(0, 2) : "";
  const identifier = countryCode ? normalized.slice(2) : "";
  return { input: raw, normalized, countryCode, identifier, validSyntax };
}

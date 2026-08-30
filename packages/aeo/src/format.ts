/**
 * @opendpp/aeo — offline AEO helpers
 *
 * Pure, zero-dependency helpers for AEO authorisation *types* and the *shape* of an
 * AEO authorisation number. Existence / trusted-trader status is NOT verified here —
 * for the authoritative lookup against the European Commission's EOS aeo-retrieve
 * web service see `lookupAeo` in `./lookup`.
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

/**
 * AEO authorisation types (UCC Art. 38):
 *   AEOC — customs simplifications
 *   AEOS — security & safety
 *   AEOF — combined (both C and S)
 */
export const AUTHORISATION_TYPES = ["AEOC", "AEOF", "AEOS"] as const;
export type AuthorisationType = (typeof AUTHORISATION_TYPES)[number];

/** Strict guard: is `value` exactly one of AEOC / AEOF / AEOS? */
export function isAuthorisationType(value: unknown): value is AuthorisationType {
  return typeof value === "string" && (AUTHORISATION_TYPES as readonly string[]).includes(value);
}

/** Trim and collapse internal whitespace in a holder name/search term (case preserved). */
export function normalizeHolderName(input: unknown): string {
  return String(input ?? "").replaceAll(/\s+/g, " ").trim();
}

/**
 * Normalise an issuing-country code to the 2-letter upper-case form the service
 * expects, or "" when the input is not a 2-letter code.
 */
export function normalizeCountryCode(input: unknown): string {
  const code = String(input ?? "").replaceAll(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

/** Structured view of an AEO authorisation number. */
export interface AeoNumberParts {
  /** the caller's raw input */
  input: string;
  /** `input` upper-cased with spaces removed */
  normalized: string;
  /** 2-letter ISO-3166 country prefix, or "" when not parseable */
  countryCode: string;
  /** the authorisation type embedded in the number, or null */
  type: AuthorisationType | null;
  /** the national authorisation number following the type, or "" */
  nationalNumber: string;
  /** whether `normalized` is a well-formed AEO number */
  validSyntax: boolean;
}

/**
 * Parse an AEO authorisation number of the form `<CC><AEOC|AEOF|AEOS><national>`
 * (spaces optional, e.g. "DE AEOF 00025/08" or "DEAEOF00025/08"). Never throws.
 *
 * NOTE: the EOS service is searched by holder name, not by this number (its
 * responses do not echo the number back), so this is an offline convenience for
 * recognising/decomposing a number a user has typed — not a lookup key.
 */
export function parseAeoNumber(input: unknown): AeoNumberParts {
  const raw = String(input ?? "");
  const normalized = raw.replaceAll(/\s+/g, "").toUpperCase();
  const m = /^([A-Z]{2})(AEO[CFS])(.+)$/.exec(normalized);
  if (!m) {
    return { input: raw, normalized, countryCode: "", type: null, nationalNumber: "", validSyntax: false };
  }
  return {
    input: raw,
    normalized,
    countryCode: m[1] as string,
    type: m[2] as AuthorisationType,
    nationalNumber: m[3] as string,
    validSyntax: true,
  };
}

/** Whether `input` is a syntactically valid AEO authorisation number. */
export function isValidAeoNumberSyntax(input: unknown): boolean {
  return parseAeoNumber(input).validSyntax;
}

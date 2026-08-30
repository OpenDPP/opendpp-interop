/**
 * @opendpp/vies — offline EU VAT-ID syntax + parsing
 *
 * Pure, zero-dependency helpers for the *shape* of an EU VAT identifier. Existence
 * is NOT verified here — for the authoritative check against the European
 * Commission's VIES service see `checkVatId` in `./check`.
 *
 * `isValidEuVatId` is behaviour-identical to the OpenDPP node's billing VAT check
 * (src/utils/tax.ts) so the hosted service can consume this package as its single
 * source without changing VAT treatment, mirroring the @opendpp/gs1 / @opendpp/eori
 * flow.
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
 * The 2-letter prefixes the EU VIES service recognises: the 27 EU member states'
 * ISO-3166 codes, EXCEPT Greece, which uses the VAT-style code "EL" (not its ISO
 * code "GR"). GB/XI are deliberately absent — VIES validates neither.
 */
export const EU_VAT_PREFIXES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "EL", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** Whether `prefix` is a 2-letter VAT country prefix VIES recognises (Greece is "EL"). */
export function isEuVatPrefix(prefix: string): boolean {
  return EU_VAT_PREFIXES.has(String(prefix ?? "").toUpperCase());
}

/**
 * Canonicalise a VAT ID for transmission/comparison: strip ASCII whitespace, dots
 * and hyphens (the separators humans sprinkle through VAT numbers) and upper-case,
 * so " ie 1234 567 x " and "ie-1234567x" both become "IE1234567X".
 */
export function normalizeVatId(vatId: string): string {
  return String(vatId ?? "")
    .replaceAll(/[\s.-]/g, "")
    .toUpperCase();
}

/**
 * VAT-ID syntax: a 2-letter country prefix followed by 5–12 alphanumerics. This is
 * the SAME pattern the OpenDPP node's billing check enforces (src/utils/tax.ts).
 */
const VAT_ID_PATTERN = /^[A-Z]{2}[A-Z0-9]{5,12}$/;

/**
 * Whether `vatId` is syntactically a valid EU VAT identifier whose country prefix is
 * a real EU member state. Syntax-only — existence is NOT verified against VIES (that
 * needs a network call; see `checkVatId`).
 *
 * Behaviour-identical to `isValidEuVatId` in the OpenDPP node's src/utils/tax.ts: it
 * upper-cases + trims (leading/trailing only — inner separators are NOT stripped, so
 * a raw "DE 123 4567" still fails), tests the pattern, then checks the prefix against
 * the EU set. Greece is accepted under BOTH "EL" (the VAT convention) and "GR" (its
 * ISO code) exactly as tax.ts does, so the two predicates agree for every input.
 */
export function isValidEuVatId(vatId: string | null | undefined): boolean {
  if (!vatId || vatId.trim() === "") return false;
  const clean = vatId.toUpperCase().trim();
  if (!VAT_ID_PATTERN.test(clean)) return false;
  // Greece's VAT prefix is "EL"; accept its ISO code "GR" as an alias so a "GR…" id is
  // not rejected — mirrors tax.ts's EL→Greece mapping so the predicates never disagree.
  const prefix = clean.slice(0, 2) === "GR" ? "EL" : clean.slice(0, 2);
  return EU_VAT_PREFIXES.has(prefix);
}

/** Structured view of a VAT identifier. */
export interface ParsedVatId {
  /** the caller's raw input */
  input: string;
  /** `input` with whitespace/dots/hyphens stripped + upper-cased (the form sent to VIES) */
  normalized: string;
  /** the 2-letter VAT country prefix as VIES expects it (e.g. "EL" for Greece), or "" */
  countryCode: string;
  /** the national number following the country prefix, or "" */
  number: string;
  /** whether `normalized` is a syntactically valid EU VAT identifier */
  validSyntax: boolean;
}

/**
 * Split a VAT ID into its country prefix + national number (after normalisation).
 * Never throws; `validSyntax` reports whether the normalised value is well-formed.
 */
export function parseVatId(vatId: string): ParsedVatId {
  const raw = String(vatId ?? "");
  const normalized = normalizeVatId(raw);
  const validSyntax = isValidEuVatId(normalized);
  const countryCode = /^[A-Z]{2}/.test(normalized) ? normalized.slice(0, 2) : "";
  const number = countryCode ? normalized.slice(2) : "";
  return { input: raw, normalized, countryCode, number, validSyntax };
}

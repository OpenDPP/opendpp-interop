/**
 * @opendpp/eori — offline EORI syntax + parsing, and the EN 18219 clause 6 operator-identifier schemes
 *
 * Pure, zero-dependency helpers for the *shape* of an EORI number. Existence is
 * NOT verified here — for the authoritative check against the European
 * Commission's EOS validation web service see `validateEori` in `./validate`.
 *
 * The `validateOperatorRegId` / `REG_ID_SCHEMES` / `economicOperatorIdentifier` exports are the
 * OpenDPP node's single source for what an economic-operator identifier IS (EN 18219 clause 6, an
 * ISO/IEC 6523 scheme) and how the EN 18223 header writes it; `isValidEoriSyntax` and the EORI
 * helpers cover the customs identifier carried beside it, mirroring the @opendpp/gs1 flow.
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

import { EU_EORI_COUNTRIES } from "./countries.js";

/**
 * The EN 18219:2026 clause 6 schemes an economic operator's `regId` is issued under — every one carries an
 * ISO/IEC 6523 International Code Designator (EN 18219 Table C.10), so the EN 18223 `economicOperatorId` can
 * always be written in the `ICD:identifier` form the standard names. An EORI is not among them: it is a
 * customs identifier with no ICD, carried beside the operator's registration id (see `isValidEoriSyntax`).
 */
export const REG_ID_SCHEMES = ["VAT", "DUNS", "LEI", "GLN"] as const;
export type RegIdScheme = (typeof REG_ID_SCHEMES)[number];

/** EN 18219 Table C.10 — the ISO/IEC 6523 ICD of each accepted scheme. */
export const ISO6523_ICD_BY_SCHEME: Readonly<Record<RegIdScheme, string>> = {
  VAT: "0223",
  DUNS: "0060",
  LEI: "0199",
  GLN: "0088",
};

/**
 * The scheme value a stored operator carries when it predates the clause 6 declaration and its registration
 * id could not be classified by the migration. Never accepted from a caller; an operator carrying it is
 * declared once, through the update path, before its identifier can be written in ICD form.
 */
export const UNDECLARED_REG_ID_SCHEME = "UNDECLARED";

export function isRegIdScheme(value: unknown): value is RegIdScheme {
  return typeof value === "string" && (REG_ID_SCHEMES as readonly string[]).includes(value);
}

/**
 * EN 18223 Table 1 `economicOperatorId`: `ICD:identifier` for a clause 6 scheme (`0223:DE811907980`),
 * and the identifier as registered for an operator whose scheme is still undeclared.
 */
export function economicOperatorIdentifier(regId: string, scheme: string | null | undefined): string {
  return isRegIdScheme(scheme) ? `${ISO6523_ICD_BY_SCHEME[scheme]}:${regId}` : regId;
}

/**
 * EORI syntax: 2-letter ISO-3166 country prefix + up to 15 alphanumeric characters
 * (EU eCustoms convention; the country's own national id forms the suffix). Syntax-only —
 * existence is NOT verified against the EU EORI online validation service.
 */
export function isValidEoriSyntax(regId: string): boolean {
  return /^[A-Z]{2}[A-Za-z0-9]{1,15}$/.test(String(regId || "").trim());
}

/** An EU VAT identification number: a member-state prefix (Greece as `EL` or `GR`) and 5–12 alphanumerics. */
export function isValidEuVatSyntax(vatId: string): boolean {
  const v = String(vatId || "").trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{5,12}$/.test(v)) return false;
  const prefix = v.startsWith("EL") ? "GR" : v.slice(0, 2);
  return EU_EORI_COUNTRIES.has(prefix);
}

/** A D-U-N-S number: nine digits. */
export function isValidDuns(duns: string): boolean {
  return /^\d{9}$/.test(String(duns || "").trim());
}

/** An LEI per ISO 17442: 20 characters, the last two the ISO/IEC 7064 MOD 97-10 check of the whole. */
export function isValidLei(lei: string): boolean {
  const v = String(lei || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{18}\d{2}$/.test(v)) return false;
  // MOD 97-10 over the digit expansion (A=10 … Z=35), streamed so the number never overflows.
  let remainder = 0;
  for (const ch of v) {
    const digits = ch >= "A" ? String((ch.codePointAt(0) ?? 0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}


/**
 * GS1 mod-10 over a 13-digit GLN. Deliberately a COPY of `isValidGLN` in `@opendpp/gs1` rather than an
 * import of it: this package ships with zero runtime dependencies (see the README), which is what lets
 * an integrator drop it into a browser or a lambda, and one sibling import would end that. The two must
 * stay in lockstep — if the rule changes there, change it here in the same breath.
 */
export function isValidGln(gln: string): boolean {
  const v = String(gln || "").trim();
  if (!/^\d{13}$/.test(v) || /^0+$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(v[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(v[12]);
}

const SCHEME_RULES: Readonly<Record<RegIdScheme, { ok: (id: string) => boolean; refusal: string }>> = {
  VAT: { ok: isValidEuVatSyntax, refusal: "regId is not a valid EU VAT identification number (a member-state prefix followed by 5–12 alphanumerics, e.g. DE811907980)." },
  DUNS: { ok: isValidDuns, refusal: "regId is not a valid D-U-N-S number (nine digits)." },
  LEI: { ok: isValidLei, refusal: "regId is not a valid LEI (20 characters with ISO 17442 check digits)." },
  GLN: { ok: isValidGln, refusal: "regId is not a valid GS1 GLN (13 digits with a valid check digit)." },
};

/**
 * Validate a regId/scheme pair for the operator create and declare paths. Returns null when acceptable,
 * else a human-readable refusal. The scheme is required: EN 18219 §6.1 makes an operator identifier one
 * issued under a clause 6 scheme, and without the scheme the identifier cannot be written in ICD form.
 */
export function validateOperatorRegId(regId: unknown, scheme: unknown): string | null {
  const id = String(regId ?? "").trim();
  if (!id) return "regId is required";
  if (/^EORI-MOCK/i.test(id)) {
    return "Fabricated registration ids (EORI-MOCK…) are not accepted — register the operator's real registration id.";
  }
  if (scheme === undefined || scheme === null || scheme === "") {
    return `regIdScheme is required — one of ${REG_ID_SCHEMES.join(", ")} (EN 18219 clause 6).`;
  }
  const s = String(scheme).toUpperCase();
  if (!isRegIdScheme(s)) {
    return `regIdScheme must be one of: ${REG_ID_SCHEMES.join(", ")}`;
  }
  const rule = SCHEME_RULES[s];
  return rule.ok(id) ? null : rule.refusal;
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

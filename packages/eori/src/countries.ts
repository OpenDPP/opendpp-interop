/**
 * @opendpp/eori — EORI country-prefix awareness
 *
 * Advisory classification of an EORI's 2-letter prefix. This is *metadata only*:
 * it explains which register a number belongs to and whether the EU Commission
 * EOS service is the authoritative source for it. It never decides validity — the
 * live service `status` always wins.
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
 * ISO-3166 alpha-2 codes of the 27 EU member states that issue EORI numbers. The
 * EU Commission EOS service is the authoritative register for these prefixes.
 */
export const EU_EORI_COUNTRIES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** Which register an EORI prefix belongs to. */
export type EoriCountryScope =
  | "eu" // EU member state — covered by the EU Commission EOS register
  | "northern-ireland" // XI — issued by HMRC under the Windsor Framework, used for EU-facing NI trade
  | "great-britain" // GB — UK register, validated by HMRC, NOT the EU register
  | "unknown"; // not a recognised EORI-issuing prefix

/** Advisory information about an EORI country/area prefix. */
export interface EoriCountryInfo {
  /** the (upper-cased) 2-letter prefix examined */
  countryCode: string;
  scope: EoriCountryScope;
  /** whether the EU Commission EOS validation service is the authoritative register for this prefix */
  euAuthoritative: boolean;
  /** human-readable context (present when the prefix needs a caveat) */
  note?: string;
}

/**
 * Classify an EORI country/area prefix. Accepts a full EORI or a bare 2-letter
 * code; only the first two characters are considered.
 *
 * "EL" (the VAT-style code for Greece) is accepted as an alias of the ISO "GR".
 */
export function classifyEoriCountry(eoriOrCode: unknown): EoriCountryInfo {
  const code = String(eoriOrCode ?? "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 2);

  if (code === "GB") {
    return {
      countryCode: code,
      scope: "great-britain",
      euAuthoritative: false,
      note: "GB (Great Britain) EORIs are held in the UK register and are validated by HMRC, not by the EU Commission EOS service. A 'not valid' result from the EU service does not mean the GB number is unregistered.",
    };
  }
  if (code === "XI") {
    return {
      countryCode: code,
      scope: "northern-ireland",
      euAuthoritative: true,
      note: "XI (Northern Ireland) EORIs are issued by HMRC under the Windsor Framework and are used for EU-facing trade; treat the live EU service status as authoritative.",
    };
  }
  if (EU_EORI_COUNTRIES.has(code)) {
    return { countryCode: code, scope: "eu", euAuthoritative: true };
  }
  if (code === "EL") {
    // VAT-style code for Greece; EORIs use the ISO "GR" prefix.
    return {
      countryCode: code,
      scope: "eu",
      euAuthoritative: true,
      note: "EL is the VAT-style code for Greece; EORIs are issued under the ISO country code 'GR'.",
    };
  }
  return {
    countryCode: code,
    scope: "unknown",
    euAuthoritative: false,
    note: code
      ? `'${code}' is not a recognised EORI-issuing country prefix.`
      : "No country prefix could be read from the input.",
  };
}

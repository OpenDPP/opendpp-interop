/**
 * @opendpp/gs1 — OpenDPP GS1 Digital Link helpers
 *
 * GS1 Digital Link URI parsing/generation + GS1 Modulo-10 check-digit validation
 * (GTIN / GLN / GRAI) and the ESPR/DPP-oriented ingest guards. Pure module, zero
 * runtime dependencies.
 *
 * Extracted verbatim from the OpenDPP node (src/utils/digital-link.ts) and kept in
 * lockstep by tests/functional/gs1-package-parity.test.ts until the backend is
 * migrated to consume this package.
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
 * Validates a GS1 numeric identifier using Modulo-10 checksum check digit algorithm.
 */
export function isValidGTIN(gtin: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(gtin)) {
    return false;
  }
  // Hygiene (audit "GS1 hygiene"): an all-zeros key has a zero GS1 Company Prefix and names no real
  // allocation, yet its mod-10 check digit is itself 0 so it would otherwise pass the checksum. Reject
  // it so an all-zeros GTIN/GLN is never treated as a scannable GS1 key. (Leading zeros from a
  // zero-padded GTIN-8/12 are fine — only an ENTIRELY zero value is structurally impossible.)
  if (/^0+$/.test(gtin)) {
    return false;
  }
  const digits = gtin.split("").map(Number);
  const checkDigit = digits[digits.length - 1];
  const dataDigits = digits.slice(0, -1);
  let sum = 0;
  let weight = 3;
  for (let i = dataDigits.length - 1; i >= 0; i--) {
    sum += dataDigits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheckDigit;
}

/**
 * Checks if a string is a valid GS1 GTIN-14.
 * Must be exactly 14 numeric digits with a valid Modulo-10 check digit.
 */
export function isGTINVal(val: string): boolean {
  if (!/^\d{14}$/.test(val)) return false;
  return isValidGTIN(val);
}

/**
 * Checks if a string is a valid GS1 GLN (Global Location Number).
 * Must be exactly 13 numeric digits with a valid Modulo-10 check digit. The GLN check digit
 * uses the same GS1 weighting algorithm as the GTIN, so isValidGTIN handles a 13-digit value.
 */
export function isValidGLN(gln: string): boolean {
  if (!/^\d{13}$/.test(gln)) return false;
  return isValidGTIN(gln);
}

/**
 * Checks if a string is a valid GS1 GRAI (Global Returnable Asset Identifier).
 * Format: 14-digit asset identification (starts with '0') + optional up to 16 alphanumeric characters.
 * Total length between 14 and 30 characters.
 */
export function isGRAIVal(val: string): boolean {
  if (val.length < 14 || val.length > 30) return false;
  const assetId = val.substring(0, 14);
  const serialPart = val.substring(14);
  
  if (!/^\d{14}$/.test(assetId)) return false;
  if (!isValidGTIN(assetId)) return false;
  if (serialPart && !/^[a-zA-Z0-9]+$/.test(serialPart)) return false;
  return true;
}

/**
 * GS1 Modulo-10 check digit for a numeric body — the shared algorithm behind GTIN-14 and GLN-13
 * (weights 3/1 from the rightmost body digit). The generation-side complement of the validators
 * above, so synthetic identifiers (demo seeds, @opendpp/testdata samples) can be MINTED with a
 * valid check digit from the same single source that validates them.
 */
export function gs1CheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) {
    throw new Error(`gs1CheckDigit expects a numeric body, got "${body}"`);
  }
  const digits = body.split("").map(Number);
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Build a valid 14-digit GTIN from a 13-digit numeric body (appends the mod-10 check digit). */
export function makeGtin(body13: string): string {
  if (!/^\d{13}$/.test(body13)) {
    throw new Error(`makeGtin expects a 13-digit body, got "${body13}"`);
  }
  return body13 + gs1CheckDigit(body13);
}

/** Build a valid 13-digit GLN from a 12-digit numeric body (appends the mod-10 check digit). */
export function makeGln(body12: string): string {
  if (!/^\d{12}$/.test(body12)) {
    throw new Error(`makeGln expects a 12-digit body, got "${body12}"`);
  }
  return body12 + gs1CheckDigit(body12);
}

/**
 * #249: whether a productId resolves to a scannable GS1 Digital Link — a valid GTIN-14 (`/01`) or a
 * valid GRAI (`/8003`). A non-GS1 SKU resolves via the internal `/passport/{id}` route instead.
 */
export function isGs1Keyed(productId: string): boolean {
  const t = productId.trim();
  return isGTINVal(t) || isGRAIVal(t);
}

/**
 * #249: ingest-time guard. Returns a clear error when a productId is *clearly intended* as a GTIN-14
 * (exactly 14 digits) but fails the GS1 modulo-10 check digit — so a typo'd GTIN is rejected at ingest
 * instead of silently falling back to a non-scannable `/passport/{id}` link (which the #155-strict
 * resolver/QR would then disagree with). Non-numeric / non-14-digit SKUs are legitimate non-GS1
 * identifiers and return null (accepted). Uses the same `isGTINVal` the resolver + link builder use,
 * so ingest and resolution agree by construction.
 */
export function gtinIngestError(productId: string): string | null {
  const t = productId.trim();
  if (/^\d{14}$/.test(t) && !isGTINVal(t)) {
    return `productId "${t}" looks like a GTIN-14 but its modulo-10 check digit is invalid. Correct the GTIN, or use a non-numeric SKU for a non-GS1 product.`;
  }
  return null;
}

/**
 * #249: the single non-blocking advisory for a non-GS1 productId, shared by every ingest path
 * (create / bulk / AAS / validate-only) so the wording can't drift. The passport still saves and
 * resolves via `/passport/{id}`; it just has no scannable GS1 Digital Link / QR.
 */
export function nonGs1Warning(productId: string): { path: string; message: string; friendlyMessage: string } {
  return {
    path: "productId",
    message: `productId "${productId.trim()}" is not a GS1 GTIN-14 or GRAI; this passport resolves via /passport/{id} and has no scannable GS1 Digital Link / QR.`,
    friendlyMessage: "This product has no GS1 GTIN, so it won't have a scannable GS1 QR code — it resolves via its internal link instead.",
  };
}

/**
 * Parses a GS1 Digital Link URI path after the AI prefix.
 * e.g. "09501101531000/21/ABC" -> { primaryId: "09501101531000", additionalAttributes: { "21": "ABC" } }
 */
export function parseDigitalLinkPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const primaryId = decodeURIComponent(segments[0]);
  const additionalAttributes: Record<string, string> = {};
  for (let i = 1; i < segments.length; i += 2) {
    const ai = decodeURIComponent(segments[i]);
    const value = segments[i + 1] ? decodeURIComponent(segments[i + 1]) : "";
    if (ai && value) {
      additionalAttributes[ai] = value;
    }
  }
  return {
    primaryId,
    additionalAttributes
  };
}

/**
 * Resolves the GS1 primary Application Identifier ('01' GTIN / '8003' GRAI) for an id.
 * GTIN is checked first: a bare 14-digit value is a GTIN (AI 01). A GRAI also satisfies the
 * permissive GRAI check, so it must only win when the value is NOT a plain GTIN (i.e. it has
 * the GRAI alphanumeric serial component, making it longer than 14 chars).
 */
function resolvePrimaryAi(trimId: string): string {
  if (isGTINVal(trimId)) return "01";
  if (isGRAIVal(trimId)) return "8003";
  return "01"; // default to GTIN AI for non-GS1 SKU strings
}

/**
 * Generates a valid GS1 Digital Link conforming URI for the SKU/type-level passport
 * based on its identifier (GTIN key '01' or GRAI key '8003') and database passport ID (serial number key '21').
 *
 * NOTE: this is the SKU/type-level link; AI-21 here carries the passport id, not a physical
 * unit serial. Individual serialised units (e.g. each battery, Art. 77(2)) use
 * generateUnitDigitalLinkUri, which carries the real physical serial in AI-21.
 */
export function generateDigitalLinkUri(productId: string, passportId: string): string {
  const trimId = productId.trim();
  const baseUrl = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  // A GS1 Digital Link for a SKU/MODEL passport is the BARE primary key — `/01/{gtin}` or
  // `/8003/{grai}`. The passport resolves by its GTIN/GRAI (src/routes/digital-link.ts), so we MUST
  // NOT append AI-21: that AI is the per-UNIT serial (generateUnitDigitalLinkUri), and putting the
  // internal passport id there is non-conformant — it overruns AI-21's 20-char limit AND AI-21 is not
  // a valid GRAI key-qualifier; both are REJECTED by GS1's Barcode Syntax Engine (#155 T2).
  if (isGTINVal(trimId)) return `${baseUrl}/01/${trimId}`;
  if (isGRAIVal(trimId)) return `${baseUrl}/8003/${encodeURIComponent(trimId)}`;
  // Non-GS1 SKU identifier (no GTIN/GRAI): there is no conformant GS1 Digital Link for it, so resolve
  // via the internal passport route rather than emit a malformed `/01/<non-gtin>` link.
  return `${baseUrl}/passport/${encodeURIComponent(passportId.trim())}`;
}

/**
 * Generates a GS1 Digital Link URI for an INDIVIDUAL serialised unit:
 * /{01|8003}/{productId}/21/{serialNumber}, where AI-21 carries the real physical serial.
 * This is what makes a battery passport "unique to each individual battery" (Art. 77(2)).
 */
export function generateUnitDigitalLinkUri(productId: string, serialNumber: string): string {
  const trimId = productId.trim();
  const cleanSerial = encodeURIComponent(serialNumber.trim());
  const baseUrl = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const ai = resolvePrimaryAi(trimId);
  return `${baseUrl}/${ai}/${encodeURIComponent(trimId)}/21/${cleanSerial}`;
}

/** Canonical app host — the BASE_URL fallback when the env var is unset (dev/test only; prod always
 *  sets BASE_URL). Matches the rest of the codebase (did-web.ts/vc-emitter.ts); never the dead opendpp.io. */
const DEFAULT_BASE_URL = "https://opendpp-node.eu";

/** GS1 canonical resolver host — the host-independent IDENTITY namespace for a Digital Link. */
const GS1_CANONICAL_HOST = "https://id.gs1.org";

/**
 * Canonical GS1 Digital Link for a PRODUCT/MODEL key, on the host-independent GS1 identity host
 * (`https://id.gs1.org/{01|8003}/{productId}`) — i.e. a stable Unique Product Identifier (UPI),
 * NOT a resolver URL. Use this as the registry `upi`/`modelUpi` (#171), where the value must
 * identify the product class independently of which node currently hosts the passport.
 */
export function canonicalProductUpi(productId: string): string {
  const trimId = productId.trim();
  const ai = resolvePrimaryAi(trimId);
  return `${GS1_CANONICAL_HOST}/${ai}/${encodeURIComponent(trimId)}`;
}

/**
 * Canonical GS1 Digital Link for an INDIVIDUAL serialised unit on the GS1 identity host
 * (`https://id.gs1.org/{01|8003}/{productId}/21/{serialNumber}`) — the item-level UPI (#171).
 */
export function canonicalUnitUpi(productId: string, serialNumber: string): string {
  const trimId = productId.trim();
  const cleanSerial = encodeURIComponent(serialNumber.trim());
  const ai = resolvePrimaryAi(trimId);
  return `${GS1_CANONICAL_HOST}/${ai}/${encodeURIComponent(trimId)}/21/${cleanSerial}`;
}

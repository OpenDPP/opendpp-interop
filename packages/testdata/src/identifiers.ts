/**
 * @opendpp/testdata — synthetic GS1 identifier minting (internal).
 *
 * GTINs are minted via @opendpp/gs1 (valid mod-10 by construction) under a FICTIONAL
 * company prefix, deliberately distinct from the hosted demo tenant's `0950110153`
 * dataset so generated samples never collide with the live demo passports.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { makeGtin } from "@opendpp/gs1";
import { ESPR_CATEGORIES, type EsprCategory } from "@opendpp/csv";

/** Fictional 10-digit GS1 company prefix for generated sample identifiers (no real GS1 licence). */
export const TESTDATA_GS1_PREFIX = "0950110154";

/**
 * Unique-GTIN capacity per category per prefix: the 3-digit item reference allocates one
 * 100-slot block per ESPR category (9 × 100 = 000–899; 900–999 is reserved for the synthetic
 * component/pallet EPCs used by event chains).
 */
export const MAX_ITEMS_PER_CATEGORY = 100;

/** Mints the deterministic, valid GTIN-14 for (category, index) under the given prefix. */
export function sampleGtin(category: EsprCategory, index: number, companyPrefix: string = TESTDATA_GS1_PREFIX): string {
  if (!/^\d{10}$/.test(companyPrefix)) {
    throw new Error(`companyPrefix must be exactly 10 digits, got "${companyPrefix}".`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= MAX_ITEMS_PER_CATEGORY) {
    throw new Error(`index must be an integer in [0, ${MAX_ITEMS_PER_CATEGORY}), got ${index}.`);
  }
  const catIdx = (ESPR_CATEGORIES as readonly string[]).indexOf(category);
  if (catIdx < 0) {
    throw new Error(`Unknown ESPR category "${category}".`);
  }
  const itemRef = String(catIdx * MAX_ITEMS_PER_CATEGORY + index).padStart(3, "0");
  return makeGtin(`${companyPrefix}${itemRef}`);
}

/**
 * Synthetic SGTIN EPC URI for a GTIN-14 + serial, mirroring the shape of the OpenDPP demo
 * dataset (`urn:epc:id:sgtin:<7-digit prefix>.<6-digit item ref>.<serial>`). Sample data —
 * not a canonical GS1 EPC partition of the company prefix.
 */
export function sgtinEpc(gtin14: string, serial: number | string): string {
  if (!/^\d{14}$/.test(gtin14)) {
    throw new Error(`sgtinEpc expects a 14-digit GTIN, got "${gtin14}".`);
  }
  return `urn:epc:id:sgtin:${gtin14.slice(0, 7)}.${gtin14.slice(7, 13)}.${serial}`;
}

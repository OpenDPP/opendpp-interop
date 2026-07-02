/**
 * @opendpp/testdata — sample passport generation.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { isEsprCategory, type EsprCategory, type PassportCreateInput } from "@opendpp/csv";
import { makeRng } from "./prng.js";
import { buildMetadata } from "./categories.js";
import { MAX_ITEMS_PER_CATEGORY, sampleGtin } from "./identifiers.js";

/** The default deterministic seed — same seed, same samples, every run, every machine. */
export const DEFAULT_SEED = 42;

export interface GeneratePassportOptions {
  /** ESPR category slug (any of @opendpp/csv's ESPR_CATEGORIES). */
  category: EsprCategory;
  /** Deterministic seed (default 42) — vary it to get a different, equally reproducible dataset. */
  seed?: number | string;
  /** Which item of the (seed, category) stream to mint (default 0); also selects the GTIN slot. */
  index?: number;
  /** 10-digit GS1 company prefix for the minted GTIN-14s (default: the fictional TESTDATA_GS1_PREFIX). */
  companyPrefix?: string;
  /** Copied onto the payload verbatim — bind the sample to YOUR workspace's operator. */
  operatorId?: string;
  /** Copied onto the payload verbatim — link YOUR Facility (what makes a passport vcReady). */
  facilityId?: string;
}

/**
 * Generates ONE synthetic sample passport in the public passport-create shape
 * (`POST /api/v1/passports`): a valid GTIN-14 `productId` plus category-valid `metadata`.
 * Deterministic in (seed, category, index).
 */
export function generatePassport(opts: GeneratePassportOptions): PassportCreateInput {
  const { category, seed = DEFAULT_SEED, index = 0 } = opts;
  if (!isEsprCategory(category)) {
    throw new Error(`Unknown ESPR category "${category}".`);
  }
  const rng = makeRng(seed, category, index);
  const out: PassportCreateInput = {
    productId: sampleGtin(category, index, opts.companyPrefix),
    metadata: buildMetadata(category, rng),
  };
  if (opts.operatorId !== undefined) out.operatorId = opts.operatorId;
  if (opts.facilityId !== undefined) out.facilityId = opts.facilityId;
  return out;
}

export interface GeneratePassportsOptions extends Omit<GeneratePassportOptions, "index"> {
  /** How many samples to mint (default 5, max MAX_ITEMS_PER_CATEGORY unique GTIN slots). */
  count?: number;
}

/** Generates `count` samples for a category — indexes 0..count-1 of the (seed, category) stream. */
export function generatePassports(opts: GeneratePassportsOptions): PassportCreateInput[] {
  const { count = 5, ...rest } = opts;
  if (!Number.isInteger(count) || count < 1 || count > MAX_ITEMS_PER_CATEGORY) {
    throw new Error(`count must be an integer in [1, ${MAX_ITEMS_PER_CATEGORY}], got ${count}.`);
  }
  return Array.from({ length: count }, (_, index) => generatePassport({ ...rest, index }));
}

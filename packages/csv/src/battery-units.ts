/**
 * @opendpp/csv — battery-unit half: CSV row → the public unit-create shape
 *
 * Maps a parsed CSV row to what `POST /api/v1/passports/{passportId}/units` accepts. A unit CSV
 * names its passport PER ROW, so one file serialises a whole fleet across products: the mapping
 * carries `productId` (which selects the route's path segment) alongside the request body.
 *
 * Same contract as the passport half in `./index.ts`: pure, parser-agnostic, zero dependencies —
 * bring your own RFC-4180 parser. Nothing here validates. The hosted node stays authoritative for
 * GS1 AI-21 conformance, duplicate serials, passport resolution and lifecycle rules.
 *
 * DATA INTEGRITY (load-bearing): a blank cell yields an ABSENT field, never a fabricated default,
 * so the server refuses an incomplete row rather than the importer inventing a fact nobody supplied.
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
import type { CsvColumn } from "./index.js";

/** One parsed CSV row: column header → cell value (an absent/blank cell is `undefined`). */
export type BatteryUnitCsvRow = Record<string, string | undefined>;

/**
 * The eight lifecycle states a unit may be created in (Annex XIII / Article 77). Declared here
 * because this package is standalone and can import nothing from the node — the hosted repo pins
 * this list against its own source so the two cannot drift.
 *
 * `RECYCLED` is FINAL: a unit created in it arrives already ceased and accepts no later change.
 */
export const BATTERY_UNIT_STATUSES = [
  "IN_SERVICE",
  "DECOMMISSIONED",
  "RECALLED",
  "REPURPOSED",
  "REMANUFACTURED",
  "REUSED",
  "WASTE",
  "RECYCLED",
] as const;

export type BatteryUnitStatus = (typeof BATTERY_UNIT_STATUSES)[number];

/** True when `value` is one of the documented statuses. Unknown values are passed through, not thrown. */
export function isBatteryUnitStatus(value: string | undefined): value is BatteryUnitStatus {
  return typeof value === "string" && (BATTERY_UNIT_STATUSES as readonly string[]).includes(value);
}

/**
 * One row's mapping: the product the unit belongs to, and the unit itself.
 *
 * Flat on purpose — `productId` selects the passport (the route's path segment) and the remaining
 * fields are the request body, so a caller destructures rather than reaching through a wrapper:
 *
 *   const { productId, ...body } = mapping;
 */
export interface BatteryUnitCsvMapping {
  /** The passport this unit belongs to. The route resolves a productId or a passport UUID. */
  productId: string;
  /** The unit's own serial — GS1 Application Identifier 21. */
  serialNumber: string;
  status?: string;
  manufacturedAt?: string;
}

/** The canonical column set for the battery-unit CSV template, in order. */
export const BATTERY_UNIT_TEMPLATE_COLUMNS: readonly CsvColumn[] = [
  { name: "productId", required: true, description: "Product ID of the passport this unit belongs to." },
  { name: "serialNumber", required: true, description: "The unit's own serial (GS1 AI-21): 1–20 characters, letters, digits and . _ -" },
  { name: "status", required: false, description: `One of ${BATTERY_UNIT_STATUSES.join(", ")}. Blank means IN_SERVICE.` },
  { name: "manufacturedAt", required: false, description: "Date of manufacture (YYYY-MM-DD)." },
  { name: "predecessorUnitId", required: false, description: "Present for a lossless round trip; NOT read on import." },
  { name: "category", required: false, description: "Present for a lossless round trip; NOT read on import." },
];

/**
 * Offered by the template and by the units export, deliberately NOT read on import.
 *
 * `predecessorUnitId`: the pre-flight does field checks only, while predecessor resolution runs at
 * write time — so an importable lineage column would be the one field outside the only check
 * protecting a write that cannot be undone. `category` belongs to the passport, not to the unit.
 * Both ship in the template so a round trip is not lossy by accident.
 */
export const BATTERY_UNIT_COLUMNS_IGNORED_ON_IMPORT = ["predecessorUnitId", "category"] as const;

/** The battery-unit CSV template: the canonical columns, in order. */
export function batteryUnitCsvTemplate(): { columns: CsvColumn[] } {
  return { columns: [...BATTERY_UNIT_TEMPLATE_COLUMNS] };
}

/** The comma-joined CSV header row for the battery-unit template. */
export function batteryUnitCsvTemplateHeader(): string {
  return BATTERY_UNIT_TEMPLATE_COLUMNS.map((c) => c.name).join(",");
}

/**
 * The one date shape this product documents — the template says "(YYYY-MM-DD)" and the passport
 * metadata schema enforces it server-side.
 *
 * Exposed because the shape is worth SHOWING an operator before an irreversible write, not because
 * this package refuses anything: `03/04/2026` is read as 4 March by a caller who meant 3 April, and
 * a spreadsheet rewrites ISO dates into the locale format on save, so the round trip is exactly what
 * produces it. Mapping passes the cell through untouched either way.
 */
export function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Trim a cell, returning `undefined` when it is absent or blank (never a fabricated default).
 *
 * Exported because a consumer doing per-line error reporting needs the SAME answer this mapper gives
 * — a second implementation beside it is how "row has no productId" and "the mapper rejected the row"
 * drift apart. Takes `unknown` on purpose: a parser that coerces types hands back numbers, and a
 * non-string cell must read as absent rather than throw.
 */
export function csvCell(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s.length ? s : undefined;
}

const str = csvCell;

/** True when every cell of the row is blank — the trailing newline of a well-formed file. */
export function isEmptyBatteryUnitRow(row: BatteryUnitCsvRow | null | undefined): boolean {
  if (!row) return true;
  return Object.values(row).every((v) => str(v) === undefined);
}

/** The required columns, in the order a message should name them. */
const REQUIRED: readonly ("productId" | "serialNumber")[] = ["productId", "serialNumber"];

/** What `tryMapCsvRowToBatteryUnit` answers: the mapping, or exactly which required cells were blank. */
export type BatteryUnitCsvRowResult =
  | { ok: true; mapping: BatteryUnitCsvMapping }
  | { ok: false; missing: ("productId" | "serialNumber")[] };

/**
 * The non-throwing mapper. A blank required cell is the most common thing wrong with a real CSV, so
 * an importer that reports problems per line should not be driven by exceptions — and it should not
 * have to work out WHICH cell was missing by re-trimming the row itself.
 *
 * `mapCsvRowToBatteryUnit` is this, with the failure raised instead.
 */
export function tryMapCsvRowToBatteryUnit(row: BatteryUnitCsvRow): BatteryUnitCsvRowResult {
  const missing = REQUIRED.filter((key) => str(row[key]) === undefined);
  if (missing.length) return { ok: false, missing };

  const mapping: BatteryUnitCsvMapping = {
    productId: str(row.productId)!,
    serialNumber: str(row.serialNumber)!,
  };
  const status = str(row.status);
  if (status !== undefined) mapping.status = status.toUpperCase();
  const manufacturedAt = str(row.manufacturedAt);
  if (manufacturedAt !== undefined) mapping.manufacturedAt = manufacturedAt;
  return { ok: true, mapping };
}

/**
 * Maps one parsed CSV row to a unit-create mapping. Throws if `productId` or `serialNumber` is
 * missing — a unit with no serial is not a unit, and with no product there is nowhere to put it.
 *
 * `status` is upper-cased so a spreadsheet's `in_service` reaches the API in its documented form; an
 * unrecognised value is passed through for the node to refuse, rather than silently corrected.
 */
export function mapCsvRowToBatteryUnit(row: BatteryUnitCsvRow): BatteryUnitCsvMapping {
  const result = tryMapCsvRowToBatteryUnit(row);
  if (!result.ok) {
    throw new Error(`CSV row is missing a "${result.missing.join('" and a "')}".`);
  }
  return result.mapping;
}

/**
 * Maps parsed CSV rows to unit-create mappings. Wholly-empty rows are skipped; a non-empty row
 * missing a required cell throws. No per-line error reporting and no duplicate handling — that
 * productized UX stays in the hosted portal, which knows the CSV line each row came from.
 */
export function mapCsvRowsToBatteryUnits(rows: BatteryUnitCsvRow[]): BatteryUnitCsvMapping[] {
  const out: BatteryUnitCsvMapping[] = [];
  for (const row of rows) {
    if (isEmptyBatteryUnitRow(row)) continue;
    out.push(mapCsvRowToBatteryUnit(row));
  }
  return out;
}

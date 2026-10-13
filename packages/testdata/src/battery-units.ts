/**
 * Deterministic battery-unit samples, and their CSV rendering.
 *
 * A unit is one physical battery under a SKU passport, carrying its own serial in GS1 Application
 * Identifier 21. This mints serials that satisfy AI-21's character set and length so a generated file
 * exercises the importer rather than its rejection path, and renders them under the official template
 * header from `@opendpp/csv` — the same arrangement `passportsToCsv` already uses, so the two cannot
 * disagree about what a column is called.
 *
 * Deterministic by construction rather than by seeded noise: unit N of a product is always unit N.
 * A fixture whose serials move between runs cannot be asserted against, and every consumer here is a
 * test or a demo seed.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  BATTERY_UNIT_STATUSES,
  batteryUnitCsvTemplate,
  type BatteryUnitCsvMapping,
} from "@opendpp/csv";

/** GS1 AI-21 permits 1–20 characters from this set; a serial outside it is refused at ingest. */
const AI21_MAX = 20;

/** An upper bound on one call, mirroring MAX_ITEMS_PER_CATEGORY's role for passports. */
export const MAX_BATTERY_UNITS = 10_000;

export interface GenerateBatteryUnitsOptions {
  /** The passport these units hang under — its productId, exactly as the CSV names it per row. */
  productId: string;
  /** How many units to mint (default 5). */
  count?: number;
  /** Serial prefix; trimmed so `${prefix}-${index}` always fits AI-21's 20 characters. */
  prefix?: string;
  /**
   * Cycle through every lifecycle status instead of leaving them all implicit.
   *
   * Off by default: a blank status means IN_SERVICE, which is the shape most files have and the one
   * worth exercising. On, the sample spans all eight — including `RECYCLED`, which arrives ALREADY
   * CEASED and accepts no later change, so a generated file carrying it is a fixture and never a
   * starting point for real data.
   */
  spanStatuses?: boolean;
  /** First date of manufacture, ISO `YYYY-MM-DD`; successive units step one day. Omit for none. */
  firstManufacturedAt?: string;
}

/**
 * One day later, in ISO `YYYY-MM-DD`. Returns null for anything that is not a REAL date in that shape.
 *
 * The shape check alone is not enough: `2026-02-30` passes it, and `new Date` then rolls it forward to
 * 2 March rather than failing — so a caller's typo would come back as a date they never wrote, which
 * is exactly the fabrication this package refuses to do elsewhere. Round-tripping the parsed date is
 * what catches it. The year bound is the other half: past 9999 `toISOString` emits `+010000-01-01`,
 * whose first ten characters are neither a date nor unique between successive units.
 */
function nextDay(iso: string, step: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const at = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return null;
  if (at.toISOString().slice(0, 10) !== iso) return null; // 2026-02-30 and friends
  at.setUTCDate(at.getUTCDate() + step);
  if (at.getUTCFullYear() > 9999) return null;
  return at.toISOString().slice(0, 10);
}

/**
 * Mints `count` units for one product. Serials are `${prefix}-${index}`, zero-padded so they sort
 * lexically in the order they were generated — a list that sorts differently from how it was written
 * is a fixture that reads as a bug.
 */
export function generateBatteryUnits(opts: GenerateBatteryUnitsOptions): BatteryUnitCsvMapping[] {
  const { productId, count = 5, spanStatuses = false, firstManufacturedAt } = opts;
  if (!productId.trim()) throw new Error("generateBatteryUnits needs a productId — a unit has nowhere to live without one.");
  // Same contract as generatePassports in this package: a fixture generator that silently accepts
  // 2.5, NaN or Infinity is one that fails somewhere unrelated. Infinity was measured as a V8
  // out-of-memory abort, and 2.5 as three units — neither is what the caller asked for.
  if (!Number.isInteger(count) || count < 0 || count > MAX_BATTERY_UNITS) {
    throw new Error(`generateBatteryUnits count must be an integer between 0 and ${MAX_BATTERY_UNITS} (got ${count}).`);
  }

  const width = String(Math.max(count - 1, 0)).length;
  const rawPrefix = (opts.prefix ?? "BAT").replaceAll(/[^A-Za-z0-9._-]/g, "");
  // Reserve the separator and the widest index so every serial fits AI-21 rather than the first N.
  const prefix = rawPrefix.slice(0, Math.max(AI21_MAX - width - 1, 1));

  const units: BatteryUnitCsvMapping[] = [];
  for (let i = 0; i < count; i++) {
    const unit: BatteryUnitCsvMapping = {
      productId,
      serialNumber: `${prefix}-${String(i).padStart(width, "0")}`,
    };
    if (spanStatuses) {
      unit.status = BATTERY_UNIT_STATUSES[i % BATTERY_UNIT_STATUSES.length];
    }
    if (firstManufacturedAt) {
      const at = nextDay(firstManufacturedAt, i);
      if (at) unit.manufacturedAt = at;
    }
    units.push(unit);
  }
  return units;
}

/** RFC-4180 cell quoting: wrap when the cell contains a comma, quote, or newline. */
const quoteCell = (cell: string): string => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);

/**
 * Renders units as CSV text under the official battery-unit template header (column order from
 * `@opendpp/csv`), ready for the portal importer or your own tooling.
 *
 * Columns the importer ignores — `predecessorUnitId`, `category` — are emitted EMPTY rather than
 * omitted, so the file matches the template an operator downloads and a round trip stays honest.
 */
export function batteryUnitsToCsv(units: BatteryUnitCsvMapping[]): string {
  const columns = batteryUnitCsvTemplate().columns.map((c) => c.name);
  const lines = [columns.join(",")];
  for (const unit of units) {
    const row: Record<string, string | undefined> = {
      productId: unit.productId,
      serialNumber: unit.serialNumber,
      status: unit.status,
      manufacturedAt: unit.manufacturedAt,
    };
    lines.push(columns.map((name) => quoteCell(row[name] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

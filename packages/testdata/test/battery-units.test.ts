/**
 * Generated battery-unit samples round-trip through the official template
 *
 * The property worth pinning is the JOIN, not the generation: this package renders CSV under a header
 * it takes from `@opendpp/csv`, and the portal importer reads that same header. If the two ever
 * disagree, a generated fixture silently stops exercising the importer and starts exercising its
 * rejection path — which still looks like a passing suite from here. So the header is asserted
 * against the package rather than against a literal, exactly as `csv-roundtrip.test.ts` does for
 * passports.
 *
 * Also pinned: serials stay inside GS1 AI-21's 20 characters however long the prefix or the count,
 * because a fixture that trips ingest validation tests nothing about ingest.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import { batteryUnitCsvTemplateHeader, BATTERY_UNIT_STATUSES } from "@opendpp/csv";
import { generateBatteryUnits, batteryUnitsToCsv, MAX_BATTERY_UNITS } from "../src/index.ts";

const AI21 = /^[A-Za-z0-9._-]{1,20}$/;

test("the rendered header is the package's, not a copy", () => {
  const header = batteryUnitsToCsv(generateBatteryUnits({ productId: "SKU-1", count: 2 })).split("\n")[0];
  assert.equal(header, batteryUnitCsvTemplateHeader());
});

test("generation is deterministic — unit N is always unit N", () => {
  const a = generateBatteryUnits({ productId: "SKU-1", count: 5 });
  const b = generateBatteryUnits({ productId: "SKU-1", count: 5 });
  assert.deepEqual(a, b);
});

test("every serial satisfies GS1 AI-21, however long the prefix or the count", () => {
  for (const [prefix, count] of [["BAT", 5], ["A-VERY-LONG-PREFIX-INDEED", 1000], ["", 3]] as const) {
    for (const unit of generateBatteryUnits({ productId: "SKU-1", count, prefix })) {
      assert.match(unit.serialNumber, AI21, `serial ${unit.serialNumber} would be refused at ingest`);
    }
  }
});

test("serials sort in the order they were generated", () => {
  const serials = generateBatteryUnits({ productId: "SKU-1", count: 12 }).map((u) => u.serialNumber);
  assert.deepEqual([...serials].sort(), serials, "zero-padding must survive crossing a power of ten");
});

test("status is absent by default — a blank cell means IN_SERVICE at the node", () => {
  for (const unit of generateBatteryUnits({ productId: "SKU-1", count: 3 })) {
    assert.equal("status" in unit, false);
  }
});

test("spanStatuses cycles every documented status, RECYCLED included", () => {
  const units = generateBatteryUnits({ productId: "SKU-1", count: BATTERY_UNIT_STATUSES.length, spanStatuses: true });
  assert.deepEqual(units.map((u) => u.status), [...BATTERY_UNIT_STATUSES]);
});

test("dates step one day and stay ISO across a month boundary", () => {
  const units = generateBatteryUnits({ productId: "SKU-1", count: 3, firstManufacturedAt: "2026-01-30" });
  assert.deepEqual(units.map((u) => u.manufacturedAt), ["2026-01-30", "2026-01-31", "2026-02-01"]);
});

test("ignored columns are emitted EMPTY, so the file matches the downloaded template", () => {
  const [header, row] = batteryUnitsToCsv(generateBatteryUnits({ productId: "SKU-1", count: 1 })).split("\n");
  assert.equal(header!.split(",").length, row!.split(",").length, "every template column must be present");
  assert.ok(row!.endsWith(","), "predecessorUnitId and category ship blank rather than missing");
});

test("a cell containing a comma is quoted rather than splitting the row", () => {
  const csv = batteryUnitsToCsv([{ productId: "SKU,1", serialNumber: "BAT-1" }]);
  assert.ok(csv.includes('"SKU,1"'), "an unquoted comma would shift every later column by one");
});

test("a productId is required — a unit has nowhere to live without one", () => {
  assert.throws(() => generateBatteryUnits({ productId: "  ", count: 1 }), /productId/);
});

// --- guard rails, added after review -----------------------------------------------------------
// `generatePassports` in this same package refuses a non-integer, a zero and an over-cap count. This
// one accepted all three silently: 2.5 produced three units, NaN produced none, and Infinity was a
// measured V8 out-of-memory abort. Two functions of the same kind in one package must not answer
// differently.

test("count must be a real, bounded integer — the same contract as generatePassports", () => {
  for (const bad of [2.5, NaN, -1, Infinity, MAX_BATTERY_UNITS + 1]) {
    assert.throws(
      () => generateBatteryUnits({ productId: "SKU-1", count: bad }),
      /count must be an integer/,
      `count ${bad} must be refused, not silently reinterpreted`,
    );
  }
  assert.equal(generateBatteryUnits({ productId: "SKU-1", count: 0 }).length, 0);
});

test("an impossible date is refused, not rolled forward into one nobody typed", () => {
  // `2026-02-30` passes a shape check, and `new Date` rolls it to 2 March — so a typo would come back
  // as a date the caller never wrote. That is the fabrication this package refuses everywhere else.
  for (const impossible of ["2026-02-30", "2026-13-01", "2026-00-10"]) {
    const units = generateBatteryUnits({ productId: "SKU-1", count: 2, firstManufacturedAt: impossible });
    assert.ok(units.every((u) => u.manufacturedAt === undefined), `${impossible} must yield no date at all`);
  }
});

test("a date that would overflow the four-digit year yields nothing, never a malformed stub", () => {
  // Past 9999, toISOString emits `+010000-01-01`; its first ten characters are neither a date nor
  // distinct between successive units, which would silently break "unit N steps one day".
  const units = generateBatteryUnits({ productId: "SKU-1", count: 4, firstManufacturedAt: "9999-12-30" });
  const dates = units.map((u) => u.manufacturedAt);
  assert.deepEqual(dates.slice(0, 2), ["9999-12-30", "9999-12-31"]);
  assert.deepEqual(dates.slice(2), [undefined, undefined]);
});

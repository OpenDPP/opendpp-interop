/**
 * @opendpp/csv battery-unit mapping, proven standalone
 *
 * Pins the same rule the passport half rests on — a BLANK CELL YIELDS AN ABSENT FIELD — for the unit
 * shape, plus the three behaviours a caller depends on that are easy to get wrong silently: the
 * mapping is flat so `productId` can be destructured away as the route's path segment; `status` is
 * upper-cased so a spreadsheet's `in_service` arrives in its documented form; and an UNRECOGNISED
 * status is passed through rather than corrected, because this package never decides what the node
 * will accept.
 *
 * NOT asserted here: RFC-4180 tokenisation, per-line error reporting and duplicate handling, which
 * stay in the portal importer; and whether a serial, a passport or a status is actually valid, which
 * only the hosted node can say.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BATTERY_UNIT_STATUSES,
  BATTERY_UNIT_COLUMNS_IGNORED_ON_IMPORT,
  batteryUnitCsvTemplate,
  batteryUnitCsvTemplateHeader,
  isBatteryUnitStatus,
  csvCell,
  tryMapCsvRowToBatteryUnit,
  isIsoDateString,
  isEmptyBatteryUnitRow,
  mapCsvRowToBatteryUnit,
  mapCsvRowsToBatteryUnits,
  type BatteryUnitCsvRow,
} from "../src/index.ts";

test("maps a fully specified row to the flat unit shape", () => {
  const row: BatteryUnitCsvRow = {
    productId: "09506000134352",
    serialNumber: "BAT-0001",
    status: "IN_SERVICE",
    manufacturedAt: "2026-03-14",
  };
  assert.deepEqual(mapCsvRowToBatteryUnit(row), {
    productId: "09506000134352",
    serialNumber: "BAT-0001",
    status: "IN_SERVICE",
    manufacturedAt: "2026-03-14",
  });
});

test("a blank optional cell stays ABSENT — never an empty string, never a default", () => {
  const mapped = mapCsvRowToBatteryUnit({ productId: "SKU-1", serialNumber: "BAT-1", status: "  ", manufacturedAt: "" });
  // The node treats a missing status as IN_SERVICE; an empty string is a value it would refuse. The
  // difference is invisible in a spreadsheet and decisive at the API.
  assert.equal("status" in mapped, false);
  assert.equal("manufacturedAt" in mapped, false);
  assert.deepEqual(mapped, { productId: "SKU-1", serialNumber: "BAT-1" });
});

test("the mapping is flat, so the product destructures away from the request body", () => {
  const { productId, ...body } = mapCsvRowToBatteryUnit({ productId: "SKU-9", serialNumber: "BAT-9", status: "WASTE" });
  assert.equal(productId, "SKU-9"); // the route's path segment
  assert.deepEqual(body, { serialNumber: "BAT-9", status: "WASTE" }); // the POST body
});

test("status is upper-cased, so a spreadsheet's lower-case value arrives documented", () => {
  assert.equal(mapCsvRowToBatteryUnit({ productId: "S", serialNumber: "B", status: "in_service" }).status, "IN_SERVICE");
});

test("an UNRECOGNISED status is passed through, not corrected or dropped", () => {
  // The package must not decide what the node accepts: silently dropping this would turn an operator's
  // typo into a unit created IN_SERVICE, which is a different battery from the one they described.
  assert.equal(mapCsvRowToBatteryUnit({ productId: "S", serialNumber: "B", status: "nonsense" }).status, "NONSENSE");
  assert.equal(isBatteryUnitStatus("NONSENSE"), false);
});

test("a row missing productId or serialNumber throws, and names what is absent", () => {
  assert.throws(() => mapCsvRowToBatteryUnit({ serialNumber: "BAT-1" }), /productId/);
  assert.throws(() => mapCsvRowToBatteryUnit({ productId: "SKU-1" }), /serialNumber/);
  assert.throws(() => mapCsvRowToBatteryUnit({ productId: " ", serialNumber: " " }), /productId.*serialNumber/s);
});

test("wholly-empty rows are skipped in bulk, and a populated row still throws", () => {
  const rows: BatteryUnitCsvRow[] = [
    { productId: "SKU-1", serialNumber: "BAT-1" },
    { productId: "", serialNumber: "  " }, // the trailing newline of a well-formed file
    { productId: "SKU-2", serialNumber: "BAT-2" },
  ];
  assert.equal(mapCsvRowsToBatteryUnits(rows).length, 2);
  assert.equal(isEmptyBatteryUnitRow(rows[1]!), true);
  assert.throws(() => mapCsvRowsToBatteryUnits([{ productId: "SKU-1" }]), /serialNumber/);
});

test("one file spans several products — the passport is named per row", () => {
  const mapped = mapCsvRowsToBatteryUnits([
    { productId: "SKU-A", serialNumber: "BAT-1" },
    { productId: "SKU-B", serialNumber: "BAT-1" }, // same serial, different product: both are real
  ]);
  assert.deepEqual(mapped.map((m) => m.productId), ["SKU-A", "SKU-B"]);
});

test("the template offers the documented columns, in order, with the required two first", () => {
  const names = batteryUnitCsvTemplate().columns.map((c) => c.name);
  assert.deepEqual(names, ["productId", "serialNumber", "status", "manufacturedAt", "predecessorUnitId", "category"]);
  assert.equal(batteryUnitCsvTemplateHeader(), names.join(","));
  assert.deepEqual(
    batteryUnitCsvTemplate().columns.filter((c) => c.required).map((c) => c.name),
    ["productId", "serialNumber"],
  );
});

test("the template names its own ignored columns, so a round trip is not lossy by accident", () => {
  const names = batteryUnitCsvTemplate().columns.map((c) => c.name);
  for (const ignored of BATTERY_UNIT_COLUMNS_IGNORED_ON_IMPORT) {
    assert.ok(names.includes(ignored), `${ignored} must ship in the template even though import ignores it`);
    assert.equal(mapCsvRowToBatteryUnit({ productId: "S", serialNumber: "B", [ignored]: "x" })[
      ignored as keyof ReturnType<typeof mapCsvRowToBatteryUnit>
    ], undefined);
  }
});

test("the status column documents every value the node accepts", () => {
  const status = batteryUnitCsvTemplate().columns.find((c) => c.name === "status")!;
  for (const s of BATTERY_UNIT_STATUSES) {
    assert.ok(status.description.includes(s), `the template must name ${s} — it is what an operator types`);
  }
  assert.equal(BATTERY_UNIT_STATUSES.length, 8);
});

test("the ISO date check accepts the documented shape and rejects the locale one", () => {
  // `03/04/2026` is 4 March to a parser and 3 April to the person who typed it. The package does not
  // refuse it — it exposes the question so a caller can show it before an irreversible write.
  assert.equal(isIsoDateString("2026-03-14"), true);
  assert.equal(isIsoDateString("03/04/2026"), false);
  assert.equal(isIsoDateString("14-03-2026"), false);
  assert.equal(mapCsvRowToBatteryUnit({ productId: "S", serialNumber: "B", manufacturedAt: "03/04/2026" }).manufacturedAt, "03/04/2026");
});

// --- the non-throwing path, added after review -------------------------------------------------
// A blank required cell is the most common thing wrong with a real CSV, so an importer reporting
// problems per line must not be driven by exceptions — and must not have to re-trim the row to work
// out WHICH cell was missing. Without these two exports a consumer writes its own trim, which is how
// "the mapper rejected this row" and "the row has no productId" drift apart.

test("tryMapCsvRowToBatteryUnit names exactly which required cells are blank", () => {
  assert.deepEqual(tryMapCsvRowToBatteryUnit({ serialNumber: "B1" }), { ok: false, missing: ["productId"] });
  assert.deepEqual(tryMapCsvRowToBatteryUnit({ productId: "S1" }), { ok: false, missing: ["serialNumber"] });
  assert.deepEqual(tryMapCsvRowToBatteryUnit({ productId: " ", serialNumber: "" }), {
    ok: false,
    missing: ["productId", "serialNumber"],
  });
});

test("the throwing and non-throwing mappers cannot disagree — one delegates to the other", () => {
  const row = { productId: "SKU-1", serialNumber: "BAT-1", status: "waste", manufacturedAt: "2026-03-14" };
  const viaTry = tryMapCsvRowToBatteryUnit(row);
  assert.equal(viaTry.ok, true);
  assert.deepEqual(viaTry.ok && viaTry.mapping, mapCsvRowToBatteryUnit(row));
});

test("csvCell is the trim a consumer needs, and treats a non-string cell as absent", () => {
  assert.equal(csvCell("  BAT-1 "), "BAT-1");
  assert.equal(csvCell("   "), undefined);
  assert.equal(csvCell(undefined), undefined);
  // A parser with type coercion hands back numbers; absent is the safe answer, not a TypeError.
  assert.equal(csvCell(42 as unknown), undefined);
  assert.equal(csvCell(null as unknown), undefined);
});

test("a non-string required cell reports as missing rather than throwing a TypeError", () => {
  assert.deepEqual(tryMapCsvRowToBatteryUnit({ productId: 42 as unknown as string, serialNumber: "B1" }), {
    ok: false,
    missing: ["productId"],
  });
});

test("the empty-row check tolerates a null row from a parser", () => {
  assert.equal(isEmptyBatteryUnitRow(null), true);
  assert.equal(isEmptyBatteryUnitRow(undefined), true);
});

test("the exported template columns are readonly, so a consumer cannot corrupt them process-wide", () => {
  // `batteryUnitsToCsv` reads the template at render time, so a mutation here would change every
  // generated file for the life of the process.
  const columns = batteryUnitCsvTemplate().columns;
  columns.push({ name: "PWNED", required: false, description: "" });
  assert.equal(batteryUnitCsvTemplateHeader().includes("PWNED"), false, "the template must not be a shared mutable array");
});

/**
 * @opendpp/csv smoke test — the row→passport mapping, proven standalone
 *
 * Proves the package works with nothing else installed, and pins the one behaviour that makes it
 * safe to point at regulated data: a BLANK CELL YIELDS AN ABSENT FIELD. Defaulting a missing cell to
 * an empty string or a plausible value would let a row pass ESPR validation carrying a fact nobody
 * supplied — so the absence has to survive the mapper, and that is asserted here rather than left to
 * the portal importer that consumes it. Also pins the category templates' canonical columns and the
 * two row-level failure modes (an empty row is skipped; a non-empty row without a productId throws).
 *
 * NOT asserted here: papaparse/RFC-4180 tokenisation and the per-line importer UX, which stay in the
 * portal; and the schema the mapped payload is later validated against, which lives in the node.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  mapCsvRowToPassport,
  mapCsvRowsToPassports,
  passportCsvTemplate,
  passportCsvTemplateHeader,
  ESPR_CATEGORIES,
  isEsprCategory,
  type PassportCsvRow,
} from "../src/index.ts";

test("maps a battery row to the public passport-create shape", () => {
  const row: PassportCsvRow = {
    productId: "09501101531000",
    operatorId: "op_1",
    facilityId: "fac_1",
    category: "batteries",
    materials: "Lithium:60|Cobalt:40",
    origin: "PT",
    facilities: "Cell Plant:Lisbon:manufacturing:PT123456789",
    ceMarking: "true",
    batteryCategory: "EV",
    chemistry: "NMC",
    electrochemicalCapacity: "100:Ah",
    carbonFootprint: "12.5",
    manufacturerName: "Iberia Energy Cells GmbH",
    dateOfManufacture: "2026-05-14",
    placeOfManufactureCountry: "PT",
  };
  const out = mapCsvRowToPassport(row);
  assert.equal(out.productId, "09501101531000");
  assert.equal(out.operatorId, "op_1");
  assert.equal(out.facilityId, "fac_1");
  const m = out.metadata as Record<string, any>;
  assert.equal(m.category, "batteries");
  assert.deepEqual(m.materialComposition, [
    { material: "Lithium", percentage: 60 },
    { material: "Cobalt", percentage: 40 },
  ]);
  assert.equal(m.originCountry, "PT");
  assert.deepEqual(m.facilityDetails[0], {
    facilityName: "Cell Plant",
    location: "Lisbon",
    activity: "manufacturing",
    eori: "PT123456789",
  });
  assert.equal(m.regulatoryCompliance.ceMarking, true);
  assert.equal(m.batteryCategory, "EV");
  assert.deepEqual(m.electrochemicalCapacity, { value: 100, unit: "Ah" });
  assert.deepEqual(m.carbonFootprint, { unit: "kg CO2e", co2eKg: 12.5 });
  // Annex XIII identity columns → nested objects (only the provided sub-fields; no fabricated blanks).
  assert.deepEqual(m.manufacturer, { name: "Iberia Energy Cells GmbH" });
  assert.equal(m.dateOfManufacture, "2026-05-14");
  assert.deepEqual(m.placeOfManufacture, { country: "PT" });
  assert.equal("city" in (m.placeOfManufacture ?? {}), false, "a blank city column must not fabricate a key");
});

test("DATA INTEGRITY: a blank cell yields an absent field (never a fabricated default)", () => {
  const out = mapCsvRowToPassport({
    productId: "WIDGET-1",
    category: "textiles",
    materials: "Cotton:100",
    origin: "  ", // blank-ish
    facilities: "",
    fiberComposition: "Cotton:100",
  });
  const m = out.metadata as Record<string, any>;
  assert.equal("originCountry" in m, false, "blank origin must be absent, not empty string");
  assert.equal("facilityDetails" in m, false, "blank facilities must be absent");
  assert.equal(out.facilityId, undefined);
  assert.equal(out.operatorId, undefined);
  assert.deepEqual(m.fiberComposition, [{ fiber: "Cotton", percentage: 100 }]);
});

test("mapCsvRowsToPassports skips empty rows and throws on a non-empty row with no productId", () => {
  const rows: PassportCsvRow[] = [
    { productId: "A", category: "toys", materials: "Wood:100", origin: "PT", facilities: "F:Lx:make" },
    { productId: "", category: "", materials: "", origin: "", facilities: "" }, // wholly empty -> skipped
  ];
  const out = mapCsvRowsToPassports(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].productId, "A");

  assert.throws(() => mapCsvRowToPassport({ category: "toys", materials: "Wood:100" }), /productId/);
});

test("templates expose the canonical columns per category", () => {
  assert.equal(ESPR_CATEGORIES.length, 9);
  assert.equal(isEsprCategory("batteries"), true);
  assert.equal(isEsprCategory("widgets"), false);

  const tpl = passportCsvTemplate("batteries");
  const names = tpl.columns.map((c) => c.name);
  assert.ok(names.includes("productId"));
  assert.ok(names.includes("category"));
  assert.ok(names.includes("chemistry"));
  assert.equal(tpl.columns.find((c) => c.name === "productId")?.required, true);

  const header = passportCsvTemplateHeader("textiles");
  assert.ok(header.startsWith("productId,operatorId,facilityId,category,materials,origin,facilities"));
  assert.ok(header.includes("fiberComposition"));
});

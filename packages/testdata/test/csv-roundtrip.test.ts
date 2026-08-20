// @opendpp/testdata ⇄ @opendpp/csv round-trip guard — proves generated samples serialize to the
// public CSV templates and map back to the SAME passport payload, so the generator and the
// mapper cannot drift apart silently (Apache-2.0, (c) Opendpp UAB).
import test from "node:test";
import assert from "node:assert/strict";
import { mapCsvRowToPassport, passportCsvTemplateHeader } from "@opendpp/csv";
import { ESPR_CATEGORIES, generatePassport, passportToCsvRow, passportsToCsv } from "../src/index.js";

test("every category round-trips row → mapCsvRowToPassport losslessly (minus productName)", () => {
  for (const category of ESPR_CATEGORIES) {
    for (const index of [0, 1, 2]) {
      const p = generatePassport({ category, index, operatorId: "op_rt", facilityId: "fac_rt" });
      const roundTripped = mapCsvRowToPassport(passportToCsvRow(p));
      // productName is the ONE generated field the public CSV template has no column for.
      const { productName, ...expectedMetadata } = p.metadata as Record<string, unknown>;
      assert.ok(productName, `${category}: samples carry a productName`);
      assert.deepEqual(
        roundTripped,
        { productId: p.productId, metadata: expectedMetadata, operatorId: "op_rt", facilityId: "fac_rt" },
        `${category}[${index}]: CSV round-trip must be lossless`,
      );
    }
  }
});

test("battery samples carry Annex XIII identity fields that round-trip via the CSV template (audit H4)", () => {
  const p = generatePassport({ category: "batteries", index: 0, operatorId: "op_x13", facilityId: "fac_x13" });
  const m = p.metadata as Record<string, any>;
  assert.ok(m.manufacturer?.name, "sample carries manufacturer.name");
  assert.ok(m.dateOfManufacture, "sample carries dateOfManufacture");
  assert.ok(m.placeOfManufacture?.country, "sample carries placeOfManufacture.country");
  const rt = mapCsvRowToPassport(passportToCsvRow(p)).metadata as Record<string, any>;
  assert.deepEqual(rt.manufacturer, m.manufacturer, "manufacturer must survive the CSV round-trip");
  assert.equal(rt.dateOfManufacture, m.dateOfManufacture, "dateOfManufacture must survive the CSV round-trip");
  assert.deepEqual(rt.placeOfManufacture, m.placeOfManufacture, "placeOfManufacture must survive the CSV round-trip");
});

test("row cells never contain the ':' / '|' micro-format separators unescaped", () => {
  // ',' is fine (the CSV writer quotes it) — but ':' and '|' would corrupt the cell micro-formats,
  // so generated values must simply never contain them outside the joins that produce them.
  const MICROFORMAT_CELLS = new Set([
    "materials", "facilities", "regulatoryCertificates", "fiberComposition", "careInstructions",
    "electrochemicalCapacity", "standbyPower", "hazardClassification", "ingredientList",
    "chemicalContentCertificates",
  ]);
  for (const category of ESPR_CATEGORIES) {
    const row = passportToCsvRow(generatePassport({ category }));
    for (const [cell, value] of Object.entries(row)) {
      if (MICROFORMAT_CELLS.has(cell) || cell === "declarationOfConformityUrl" || cell === "declarationOfPerformanceUrl" || cell === "dueDiligenceReportUrl" || cell === "safetyDatasheetUrl") continue;
      assert.doesNotMatch(value, /[:|]/, `${category}.${cell} leaked a separator: "${value}"`);
    }
  }
});

test("passportsToCsv emits the official template header and RFC-4180 quoting", () => {
  for (const category of ESPR_CATEGORIES) {
    const csv = passportsToCsv(category, [generatePassport({ category })]);
    const [header, dataLine] = csv.split("\n");
    assert.equal(header, passportCsvTemplateHeader(category), `${category}: header must match @opendpp/csv`);
    assert.ok(dataLine.length > 0);
  }
  // Facility locations contain commas → the cell must be quoted.
  const csv = passportsToCsv("batteries", [generatePassport({ category: "batteries" })]);
  assert.match(csv, /"[^"]*\(SAMPLE\):[^"]*, [^"]*"/, "comma-bearing facility cell must be quoted");
});

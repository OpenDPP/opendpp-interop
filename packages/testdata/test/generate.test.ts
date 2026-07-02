// @opendpp/testdata generation tests — determinism + GS1 validity + option handling
// (Apache-2.0, (c) Opendpp UAB). Runs via tsx against ../src; lives outside src/ so it
// is not compiled into the published dist.
import test from "node:test";
import assert from "node:assert/strict";
import { isGTINVal } from "@opendpp/gs1";
import {
  DEFAULT_SEED,
  ESPR_CATEGORIES,
  MAX_ITEMS_PER_CATEGORY,
  TESTDATA_GS1_PREFIX,
  generatePassport,
  generatePassports,
  sampleGtin,
} from "../src/index.js";

test("every ESPR category generates a structurally coherent sample", () => {
  for (const category of ESPR_CATEGORIES) {
    const p = generatePassport({ category });
    assert.equal(isGTINVal(p.productId), true, `${category}: productId must be a valid GTIN-14`);
    assert.ok(p.productId.startsWith(TESTDATA_GS1_PREFIX), `${category}: fictional prefix expected`);
    const m = p.metadata as Record<string, any>;
    assert.equal(m.category, category);
    assert.match(String(m.productName), / \(SAMPLE\)$/, `${category}: synthetic marker expected`);
    // Universal regulatory base shape.
    const shares = (m.materialComposition as { percentage: number }[]).map((x) => x.percentage);
    assert.equal(shares.reduce((a, b) => a + b, 0), 100, `${category}: composition must sum to 100`);
    assert.match(String(m.originCountry), /^[A-Z]{2}$/);
    assert.equal(m.originCountry, (m.facilityDetails[0].eori as string).slice(0, 2));
    assert.equal(m.regulatoryCompliance.ceMarking, true);
    assert.ok(m.regulatoryCompliance.certificates.length >= 1);
    const cf = m.carbonFootprint;
    assert.equal(cf.co2eKg, cf.scope1 + cf.scope2 + cf.scope3, `${category}: footprint must equal scope sum`);
  }
});

test("output is deterministic in (seed, category, index) — and independent of generation order", () => {
  const a = generatePassports({ category: "batteries", count: 5 });
  const b = generatePassports({ category: "batteries", count: 5 });
  assert.deepEqual(a, b, "same seed must reproduce identical samples");
  // The 3rd item of a batch equals the standalone index-2 generation — no cross-item state.
  assert.deepEqual(a[2], generatePassport({ category: "batteries", index: 2 }));
  assert.deepEqual(a[0], generatePassport({ category: "batteries", seed: DEFAULT_SEED }));

  const other = generatePassport({ category: "batteries", seed: "another-dataset" });
  // GTIN slots are (category, index)-addressed — stable across seeds — while content varies.
  assert.equal(other.productId, a[0].productId);
  assert.notDeepEqual(other.metadata, a[0].metadata, "a different seed must vary the content");
});

test("GTIN slots never collide across categories or with the event-chain 900+ block", () => {
  const seen = new Set<string>();
  for (const category of ESPR_CATEGORIES) {
    for (const index of [0, 1, MAX_ITEMS_PER_CATEGORY - 1]) {
      const gtin = sampleGtin(category, index);
      assert.equal(seen.has(gtin), false, `duplicate GTIN ${gtin}`);
      seen.add(gtin);
      assert.ok(Number(gtin.slice(10, 13)) < 900, "product item refs stay below the component block");
    }
  }
});

test("operatorId / facilityId / companyPrefix options pass through", () => {
  const p = generatePassport({
    category: "toys",
    operatorId: "op_123",
    facilityId: "fac_456",
    companyPrefix: "0999999999",
  });
  assert.equal(p.operatorId, "op_123");
  assert.equal(p.facilityId, "fac_456");
  assert.ok(p.productId.startsWith("0999999999"));
  assert.equal(isGTINVal(p.productId), true);
  // Absent options stay absent — the payload mirrors what a caller would POST.
  const bare = generatePassport({ category: "toys" });
  assert.equal("operatorId" in bare, false);
  assert.equal("facilityId" in bare, false);
});

test("guard rails: bad category / count / index / prefix throw", () => {
  assert.throws(() => generatePassport({ category: "spaceships" as never }), /Unknown ESPR category/);
  assert.throws(() => generatePassports({ category: "toys", count: 0 }), /count must be/);
  assert.throws(() => generatePassports({ category: "toys", count: MAX_ITEMS_PER_CATEGORY + 1 }), /count must be/);
  assert.throws(() => generatePassport({ category: "toys", index: MAX_ITEMS_PER_CATEGORY }), /index must be/);
  assert.throws(() => generatePassport({ category: "toys", companyPrefix: "123" }), /10 digits/);
});

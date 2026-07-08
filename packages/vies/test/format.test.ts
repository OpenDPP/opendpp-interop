// @opendpp/vies format test — offline VAT-ID syntax/parse helpers (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EU_VAT_PREFIXES,
  isEuVatPrefix,
  isValidEuVatId,
  normalizeVatId,
  parseVatId,
} from "../src/index.ts";

test("isValidEuVatId — accepts well-formed ids across member states (incl. Greece 'EL')", () => {
  assert.equal(isValidEuVatId("DE123456789"), true);
  assert.equal(isValidEuVatId("IE1234567X"), true);
  assert.equal(isValidEuVatId("FR12345678901"), true);
  assert.equal(isValidEuVatId("EL123456789"), true); // Greece uses the VAT prefix "EL"
  assert.equal(isValidEuVatId("GR123456789"), true); // ISO code accepted too (src/utils/tax.ts parity)
  assert.equal(isValidEuVatId("lt123456789"), true); // lower-case is upper-cased first
});

test("isValidEuVatId — rejects malformed / non-EU ids", () => {
  assert.equal(isValidEuVatId("DE123"), false); // too short (needs 5–12 after the prefix)
  assert.equal(isValidEuVatId("US1234567"), false); // not an EU prefix
  assert.equal(isValidEuVatId("D1234567"), false); // one-letter prefix
  assert.equal(isValidEuVatId("DE12-34567"), false); // bad char (hyphen) in the raw form
  assert.equal(isValidEuVatId("DE 123 4567"), false); // inner spaces are NOT stripped (tax.ts parity)
  assert.equal(isValidEuVatId(""), false);
  assert.equal(isValidEuVatId("   "), false);
  assert.equal(isValidEuVatId(null), false);
  assert.equal(isValidEuVatId(undefined), false);
});

test("normalizeVatId — strips whitespace/dots/hyphens and upper-cases", () => {
  assert.equal(normalizeVatId(" ie 1234 567 x "), "IE1234567X");
  assert.equal(normalizeVatId("de.123.456.789"), "DE123456789");
  assert.equal(normalizeVatId("el-123-456-789"), "EL123456789");
  assert.equal(normalizeVatId(""), "");
});

test("parseVatId — splits country prefix from the national number", () => {
  const p = parseVatId("el 123 456 789");
  assert.equal(p.input, "el 123 456 789");
  assert.equal(p.normalized, "EL123456789");
  assert.equal(p.countryCode, "EL");
  assert.equal(p.number, "123456789");
  assert.equal(p.validSyntax, true);

  const bad = parseVatId("12345");
  assert.equal(bad.countryCode, "");
  assert.equal(bad.number, "");
  assert.equal(bad.validSyntax, false);
});

test("EU_VAT_PREFIXES — the 27 member states, Greece as 'EL' not 'GR'", () => {
  assert.equal(EU_VAT_PREFIXES.size, 27);
  assert.equal(EU_VAT_PREFIXES.has("EL"), true);
  assert.equal(EU_VAT_PREFIXES.has("GR"), false);
  assert.equal(EU_VAT_PREFIXES.has("DE"), true);
  assert.equal(EU_VAT_PREFIXES.has("GB"), false); // GB is not a VIES prefix
  assert.equal(isEuVatPrefix("el"), true);
  assert.equal(isEuVatPrefix("us"), false);
});

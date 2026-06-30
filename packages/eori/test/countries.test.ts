// @opendpp/eori countries test — prefix classification (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
import test from "node:test";
import assert from "node:assert/strict";
import { EU_EORI_COUNTRIES, classifyEoriCountry } from "../src/index.ts";

test("EU member set has all 27 issuing countries", () => {
  assert.equal(EU_EORI_COUNTRIES.size, 27);
  for (const c of ["DE", "FR", "IT", "NL", "PT", "IE", "SE"]) {
    assert.equal(EU_EORI_COUNTRIES.has(c), true);
  }
  assert.equal(EU_EORI_COUNTRIES.has("GB"), false);
});

test("classifyEoriCountry — EU member", () => {
  const info = classifyEoriCountry("DE1234567890");
  assert.equal(info.scope, "eu");
  assert.equal(info.euAuthoritative, true);
  assert.equal(info.countryCode, "DE");
  assert.equal(info.note, undefined);
});

test("classifyEoriCountry — GB is HMRC, not the EU register", () => {
  const info = classifyEoriCountry("GB123456789000");
  assert.equal(info.scope, "great-britain");
  assert.equal(info.euAuthoritative, false);
  assert.match(info.note ?? "", /HMRC/);
});

test("classifyEoriCountry — XI Northern Ireland", () => {
  const info = classifyEoriCountry("XI123456789000");
  assert.equal(info.scope, "northern-ireland");
  assert.equal(info.euAuthoritative, true);
  assert.match(info.note ?? "", /Windsor Framework/);
});

test("classifyEoriCountry — EL is a Greece alias", () => {
  const info = classifyEoriCountry("EL123456789");
  assert.equal(info.scope, "eu");
  assert.equal(info.euAuthoritative, true);
  assert.match(info.note ?? "", /Greece/);
});

test("classifyEoriCountry — unknown / empty", () => {
  const zz = classifyEoriCountry("ZZ12345");
  assert.equal(zz.scope, "unknown");
  assert.equal(zz.euAuthoritative, false);
  assert.match(zz.note ?? "", /not a recognised EORI-issuing country/);

  const empty = classifyEoriCountry("");
  assert.equal(empty.scope, "unknown");
  assert.match(empty.note ?? "", /No country prefix/);
});

test("classifyEoriCountry — accepts a bare 2-letter code and is case-insensitive", () => {
  assert.equal(classifyEoriCountry("de").scope, "eu");
  assert.equal(classifyEoriCountry(" fr ").scope, "eu");
});

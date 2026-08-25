/**
 * @opendpp/eori countries test — which register answers for a given prefix
 *
 * Classification decides WHERE an EORI is verifiable, and getting it wrong sends a caller to a
 * register that will never know the number. The four cases that are easy to collapse and must stay
 * distinct are pinned here: the 27 EU member states, GB (HMRC, not the EU register), XI (Northern
 * Ireland, which is in the EU register despite the UK prefix), and EL as the alias Greece actually
 * issues under. Unknown and empty inputs are pinned too, and the classifier accepts a bare 2-letter
 * code case-insensitively as well as a full number.
 *
 * NOT asserted here: whether the number EXISTS in whichever register it routes to — that is
 * validate.test.ts against a mock transport.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
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

/**
 * @opendpp/eori format test — offline syntax and parsing
 *
 * Pins the SHAPE rules only: a country code followed by 1–15 alphanumerics, normalisation that
 * strips whitespace and upper-cases while leaving punctuation visible (so a malformed value stays
 * visibly malformed rather than being silently repaired), and the split of a number into prefix and
 * identifier. `validateOperatorRegId` is pinned here too, including its rejection of fabricated ids —
 * the node consumes these helpers as its single source for operator registration identifiers, so a
 * loosened rule here widens what the hosted service accepts at ingest.
 *
 * NOT asserted here: existence. A syntactically perfect EORI that no register has ever issued passes
 * every assertion in this file; that question belongs to validate.test.ts.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  REG_ID_SCHEMES,
  isValidEoriSyntax,
  validateOperatorRegId,
  normalizeEori,
  parseEori,
} from "../src/index.ts";

test("isValidEoriSyntax — country code + 1..15 alphanumerics", () => {
  assert.equal(isValidEoriSyntax("DE1234567890"), true);
  assert.equal(isValidEoriSyntax("PT883921029"), true);
  assert.equal(isValidEoriSyntax("IE2025292W"), true);
  assert.equal(isValidEoriSyntax("DEX"), true); // 1-char suffix is allowed
  assert.equal(isValidEoriSyntax("DE"), false); // needs at least one suffix char
  assert.equal(isValidEoriSyntax("D1234"), false); // one-letter prefix
  assert.equal(isValidEoriSyntax("de1234"), false); // lower-case prefix rejected
  assert.equal(isValidEoriSyntax("DE1234567890123456"), false); // suffix > 15
  assert.equal(isValidEoriSyntax("DE 12 34"), false); // spaces not allowed in the raw form
  assert.equal(isValidEoriSyntax(""), false);
});

test("normalizeEori — strips whitespace, upper-cases, keeps punctuation visible", () => {
  assert.equal(normalizeEori(" de 123 456 "), "DE123456");
  assert.equal(normalizeEori("ie2025292w"), "IE2025292W");
  assert.equal(normalizeEori("DE-123"), "DE-123"); // punctuation kept so it still fails syntax
  assert.equal(normalizeEori(null), "");
});

test("parseEori — splits country prefix from identifier", () => {
  const p = parseEori("ie2025292w");
  assert.equal(p.normalized, "IE2025292W");
  assert.equal(p.countryCode, "IE");
  assert.equal(p.identifier, "2025292W");
  assert.equal(p.validSyntax, true);
  assert.equal(p.input, "ie2025292w");

  const bad = parseEori("12345");
  assert.equal(bad.countryCode, "");
  assert.equal(bad.identifier, "");
  assert.equal(bad.validSyntax, false);

  const prefixOnly = parseEori("DE");
  assert.equal(prefixOnly.countryCode, "DE");
  assert.equal(prefixOnly.identifier, "");
  assert.equal(prefixOnly.validSyntax, false);
});

test("validateOperatorRegId — scheme rules + fabricated-id rejection", () => {
  assert.equal(validateOperatorRegId("DE1234567890", "EORI"), null);
  assert.equal(validateOperatorRegId("anything"), null); // no scheme → only presence checked
  assert.equal(validateOperatorRegId(""), "regId is required");
  assert.match(validateOperatorRegId("EORI-MOCK-1") ?? "", /Fabricated registration ids/);
  assert.match(validateOperatorRegId("DE123", "BOGUS") ?? "", /regIdScheme must be one of/);
  assert.match(validateOperatorRegId("not-an-eori", "EORI") ?? "", /not a syntactically valid EORI/);
  assert.deepEqual([...REG_ID_SCHEMES], ["EORI", "VAT", "DUNS", "NATIONAL", "OTHER"]);
});

// @opendpp/aeo format test — offline helpers (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORISATION_TYPES,
  isAuthorisationType,
  normalizeHolderName,
  normalizeCountryCode,
  parseAeoNumber,
  isValidAeoNumberSyntax,
} from "../src/index.ts";

test("AUTHORISATION_TYPES are the three UCC types", () => {
  assert.deepEqual([...AUTHORISATION_TYPES], ["AEOC", "AEOF", "AEOS"]);
});

test("isAuthorisationType is strict (exact upper-case)", () => {
  assert.equal(isAuthorisationType("AEOF"), true);
  assert.equal(isAuthorisationType("AEOC"), true);
  assert.equal(isAuthorisationType("AEOS"), true);
  assert.equal(isAuthorisationType("aeof"), false);
  assert.equal(isAuthorisationType("AEOX"), false);
  assert.equal(isAuthorisationType(123), false);
});

test("normalizeHolderName trims + collapses whitespace, preserves case", () => {
  assert.equal(normalizeHolderName("  BMW   M  GmbH "), "BMW M GmbH");
  assert.equal(normalizeHolderName(null), "");
});

test("normalizeCountryCode → 2-letter upper, else empty", () => {
  assert.equal(normalizeCountryCode("de"), "DE");
  assert.equal(normalizeCountryCode(" fr "), "FR");
  assert.equal(normalizeCountryCode("DEU"), ""); // 3 letters
  assert.equal(normalizeCountryCode("D"), "");
  assert.equal(normalizeCountryCode(""), "");
});

test("parseAeoNumber decomposes CC + AEO[C/F/S] + national number", () => {
  const a = parseAeoNumber("DE AEOF 00025/08");
  assert.equal(a.countryCode, "DE");
  assert.equal(a.type, "AEOF");
  assert.equal(a.nationalNumber, "00025/08");
  assert.equal(a.validSyntax, true);

  const b = parseAeoNumber("NLAEOC1234");
  assert.equal(b.type, "AEOC");
  assert.equal(b.nationalNumber, "1234");
  assert.equal(b.validSyntax, true);

  assert.equal(parseAeoNumber("XX123").validSyntax, false); // no AEO type
  assert.equal(parseAeoNumber("DEAEOF").validSyntax, false); // no national number
  assert.equal(parseAeoNumber("").validSyntax, false);
  assert.equal(isValidAeoNumberSyntax("FR AEOS 1"), true);
});

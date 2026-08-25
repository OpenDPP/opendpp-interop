/**
 * @opendpp/aeo format test — offline shape helpers
 *
 * Pins the pure half of the package: the three UCC authorisation types, strict (exact upper-case)
 * type recognition, holder-name and country-code normalisation, and the decomposition of an AEO
 * number into country code + AEO[C/F/S] + national identifier. Nothing here touches a transport, so
 * a failure is a helper defect and never a service or fixture problem.
 *
 * NOT asserted here: whether an authorisation actually EXISTS. That is the EU EOS service's answer,
 * and it is covered in lookup.test.ts against an injected mock transport.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
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

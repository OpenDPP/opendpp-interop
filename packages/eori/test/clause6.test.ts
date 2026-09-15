/**
 * EN 18219 clause 6 — the operator-identifier schemes and the ICD form of the EN 18223 header value.
 *
 * Each validator is pinned on one accepted and one refused shape; the LEI and GLN cases use published
 * check-digit examples so a wrong weight or modulus fails here rather than at an operator's registration.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ISO6523_ICD_BY_SCHEME,
  REG_ID_SCHEMES,
  UNDECLARED_REG_ID_SCHEME,
  economicOperatorIdentifier,
  isRegIdScheme,
  isValidDuns,
  isValidEuVatSyntax,
  isValidGln,
  isValidLei,
} from "../src/index.js";

test("every accepted scheme has an ISO/IEC 6523 ICD, and only those schemes are accepted", () => {
  for (const s of REG_ID_SCHEMES) assert.match(ISO6523_ICD_BY_SCHEME[s], /^\d{4}$/);
  assert.ok(isRegIdScheme("LEI"));
  assert.ok(!isRegIdScheme("EORI"));
  assert.ok(!isRegIdScheme(UNDECLARED_REG_ID_SCHEME));
});

test("economicOperatorIdentifier — ICD:identifier for a clause 6 scheme, as registered when undeclared", () => {
  assert.equal(economicOperatorIdentifier("DE811907980", "VAT"), "0223:DE811907980");
  assert.equal(economicOperatorIdentifier("150483782", "DUNS"), "0060:150483782");
  assert.equal(economicOperatorIdentifier("529900T8BM49AURSDO55", "LEI"), "0199:529900T8BM49AURSDO55");
  assert.equal(economicOperatorIdentifier("4012345000009", "GLN"), "0088:4012345000009");
  assert.equal(economicOperatorIdentifier("EU-LEGACY-1", UNDECLARED_REG_ID_SCHEME), "EU-LEGACY-1");
  assert.equal(economicOperatorIdentifier("EU-LEGACY-1", null), "EU-LEGACY-1");
});

test("isValidEuVatSyntax — member-state prefix (Greece as EL or GR) and 5–12 alphanumerics", () => {
  assert.ok(isValidEuVatSyntax("DE811907980"));
  assert.ok(isValidEuVatSyntax("EL123456789"));
  assert.ok(isValidEuVatSyntax("GR123456789"));
  assert.ok(isValidEuVatSyntax("LT000000000001"));
  assert.ok(!isValidEuVatSyntax("GB123456789"), "not an EU member state");
  assert.ok(!isValidEuVatSyntax("DE1234"), "too short");
  assert.ok(!isValidEuVatSyntax("EU-DEFAULT-001"), "not a VAT shape");
});

test("isValidDuns — nine digits", () => {
  assert.ok(isValidDuns("150483782"));
  assert.ok(!isValidDuns("15048378"));
  assert.ok(!isValidDuns("15048378A"));
});

test("isValidLei — ISO 17442 MOD 97-10 (published examples)", () => {
  assert.ok(isValidLei("529900T8BM49AURSDO55"), "Deutsche Bank's LEI, GLEIF sample");
  assert.ok(isValidLei("5493001KJTIIGC8Y1R12"), "Bloomberg's LEI, GLEIF sample");
  assert.ok(!isValidLei("529900T8BM49AURSDO56"), "one check digit off");
  assert.ok(!isValidLei("529900T8BM49AURSDO5"), "19 characters");
});

test("isValidGln — 13 digits and the GS1 mod-10 check digit", () => {
  assert.ok(isValidGln("4012345000009"), "GS1 documentation example");
  assert.ok(!isValidGln("4012345000008"), "check digit off");
  assert.ok(!isValidGln("0000000000000"), "an all-zero key names no allocation");
  assert.ok(!isValidGln("401234500000"), "12 digits");
});

/**
 * @opendpp/aeo numeric character references — an unrepresentable one is text, never a throw
 *
 * `String.fromCodePoint` throws a RangeError above U+10FFFF, and the string being decoded is a
 * third-party SOAP body. So `&#x110000;` in a response used to escape this package as a RangeError,
 * past a documented contract that promises `AeoServiceError` — an external consumer catching that
 * type would have seen an uncaught error instead. A lenient XML reader leaves a reference it cannot
 * represent as literal text; these tests pin that, and pin that valid references (including astral
 * ones and the U+10FFFF boundary itself) still decode.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRetrieveAeoResponse } from "../src/soap.js";

/** A found-result envelope whose holder name carries whatever reference a case wants to test. */
const withName = (name: string) =>
  `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">` +
  `<S:Body><ns0:retrieveAEOResponse xmlns:ns0="http://aeo.ws.eos.dds.s/"><return>` +
  `<requestDate>2026-06-30</requestDate><result><authorisationHolderName>${name}</authorisationHolderName>` +
  `<issuingCountry>Germany</issuingCountry><authorisation.type>AEOF</authorisation.type>` +
  `</result></return></ns0:retrieveAEOResponse></S:Body></S:Envelope>`;

const holderName = (xml: string) => parseRetrieveAeoResponse(xml).results[0]?.authorisationHolderName;

test("an out-of-range character reference is left as text instead of throwing", () => {
  // 0x110000 is one past Unicode's last code point — the exact input fromCodePoint rejects.
  assert.equal(holderName(withName("ACME&#x110000;GmbH")), "ACME&#x110000;GmbH");
  assert.equal(holderName(withName("ACME&#1114112;GmbH")), "ACME&#1114112;GmbH");
});

test("a numerically overflowing reference is left as text too", () => {
  // parseInt("99999999999999999999", 10) is Infinity, which fromCodePoint also rejects.
  assert.equal(holderName(withName("A&#99999999999999999999;B")), "A&#99999999999999999999;B");
});

test("valid references still decode, including astral planes and the boundary itself", () => {
  assert.equal(holderName(withName("&#x41;&#66;")), "AB");
  assert.equal(holderName(withName("caf&#233;")), "café");
  // U+1F600 is astral (a surrogate pair once encoded) and U+10FFFF is the last legal code point.
  assert.equal(holderName(withName("x&#x1F600;y")), "x\u{1F600}y");
  assert.equal(holderName(withName("x&#x10FFFF;y")), "x\u{10FFFF}y");
});

test("a mixed body decodes what it can and leaves the rest, in one pass", () => {
  const parsed = parseRetrieveAeoResponse(withName("&#x41;&#x110000;&#x42;"));
  assert.equal(parsed.results[0]?.authorisationHolderName, "A&#x110000;B");
});

test("the parser still surfaces the rest of the record around a bad reference", () => {
  const parsed = parseRetrieveAeoResponse(withName("Bad&#x110000;Name"));
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0]?.issuingCountry, "Germany");
  assert.equal(parsed.requestDate, "2026-06-30");
});

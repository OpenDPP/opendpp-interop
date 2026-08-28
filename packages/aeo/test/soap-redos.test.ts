/**
 * @opendpp/aeo SOAP ReDoS regression test — linear-time parsing, behaviour unchanged
 *
 * Regression guard for js/polynomial-redos (CodeQL). The old parser used lazy `[\s\S]*?` regexes whose
 * backtracking was O(n²): a ~1 MB crafted body stalled the event loop for tens of seconds. The readers
 * are now linear (indexOf) with a coarse size cap. These tests pin BOTH the DoS fix and behaviour
 * preservation on the tricky shapes.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRetrieveAeoResponse, MAX_RESPONSE_BYTES } from "../src/soap.js";

test("a 2 MB adversarial body parses in well under a second (was O(n²) seconds)", () => {
  for (const chunk of ["<result ", "<fault ", "<![CDATA[", "</result", "<aeo:"]) {
    const body = chunk.repeat(Math.ceil((2 * 1024 * 1024) / chunk.length));
    const t0 = process.hrtime.bigint();
    // No wrapper / no fault → throws; the point is TIMING, not the outcome.
    assert.throws(() => parseRetrieveAeoResponse(body));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 2500, `parsing a 2 MB "${chunk}"×N body took ${ms.toFixed(0)}ms (linear; O(n²) was seconds — the 2500ms ceiling tolerates a saturated CI runner)`);
  }
});

test("a body past MAX_RESPONSE_BYTES is rejected before any scanning", () => {
  const huge = "a".repeat(MAX_RESPONSE_BYTES + 1);
  assert.throws(() => parseRetrieveAeoResponse(huge), /too large to parse/);
});

test("MANY well-formed sibling <result> blocks parse in linear time (not O(n²))", () => {
  // The DoS trigger the first perf test MISSED: a response with N valid result blocks. The scanners
  // must lowercase the body ONCE per parse, not once per block (that was quadratic).
  const N = 20000;
  const body =
    "<retrieveAEOResponse>" +
    "<result><authorisationHolderName>ACME</authorisationHolderName><issuingCountry>Germany</issuingCountry></result>".repeat(N) +
    "</retrieveAEOResponse>";
  const t0 = process.hrtime.bigint();
  const parsed = parseRetrieveAeoResponse(body);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(parsed.results.length, N);
  assert.ok(ms < 2500, `parsing ${N} result blocks took ${ms.toFixed(0)}ms (linear; O(n²) was seconds — the 2500ms ceiling tolerates a saturated CI runner)`);
});

test("an empty-prefix element (<:result>) is NOT matched (parity with the old [\\w.-]+: regex)", () => {
  // The wrapper IS present, but the sole block is empty-prefixed → not a <result> → no-match (results: []).
  const body = "<retrieveAEOResponse><:result><authorisationHolderName>X</authorisationHolderName></:result></retrieveAEOResponse>";
  const parsed = parseRetrieveAeoResponse(body);
  assert.deepEqual(parsed.results, []);
});

test("behaviour preserved: prefixes, attributes, CDATA, entities, dotted local name, multi-result", () => {
  const body =
    "<soapenv:Envelope><soapenv:Body><ns2:retrieveAEOResponse><ns2:return>" +
    '<result attr="x"><authorisationHolderName><![CDATA[ACME & <Co>]]></authorisationHolderName>' +
    "<issuingCountry>Germany</issuingCountry><ns3:authorisation.type>AEOF</ns3:authorisation.type></result>" +
    "<result><authorisationHolderName>Globex &amp; Sons</authorisationHolderName></result>" +
    // NUMERIC CHARACTER REFERENCES, the two unescaper branches nothing here reached. The live service
    // returns UTF-8 directly, so no capture contains them — but XML permits them wherever a character
    // is legal, and a conformant service may emit them at any time. `für` in the live holder name is
    // exactly the sort of character that arrives this way. Hex and decimal are separate branches.
    "<result><authorisationHolderName>B&#xFC;chner &#38; S&#246;hne</authorisationHolderName></result>" +
    "</ns2:return></ns2:retrieveAEOResponse></soapenv:Body></soapenv:Envelope>";
  const parsed = parseRetrieveAeoResponse(body);
  assert.equal(parsed.results.length, 3);
  assert.equal(parsed.results[0]!.authorisationHolderName, "ACME & <Co>"); // CDATA unwrapped
  assert.equal(parsed.results[0]!.issuingCountry, "Germany");
  assert.equal(parsed.results[0]!.authorisationType, "AEOF"); // dotted local name via prefix
  assert.equal(parsed.results[1]!.authorisationHolderName, "Globex & Sons");
  assert.equal(parsed.results[2]!.authorisationHolderName, "Büchner & Söhne");
});

test("behaviour preserved: a present wrapper with no <result> is a valid no-match (results: [])", () => {
  const body = "<ns2:retrieveAEOResponse></ns2:retrieveAEOResponse>";
  const parsed = parseRetrieveAeoResponse(body);
  assert.deepEqual(parsed.results, []);
});

test("behaviour preserved: a body with neither wrapper nor fault throws", () => {
  assert.throws(() => parseRetrieveAeoResponse("<something-else/>"), /did not contain a retrieveAEOResponse/);
});

test("behaviour preserved: a SOAP Fault throws with its faultstring", () => {
  const body =
    "<S:Envelope><S:Body><S:Fault><faultstring>service unavailable</faultstring></S:Fault></S:Body></S:Envelope>";
  assert.throws(() => parseRetrieveAeoResponse(body), (e: unknown) => {
    assert.ok(e instanceof Error && /service unavailable/.test(e.message));
    return true;
  });
});

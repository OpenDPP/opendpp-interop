import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValidateEoriResponse, MAX_RESPONSE_BYTES } from "../src/soap.js";

/**
 * Regression guard for js/polynomial-redos (CodeQL). The old parser used lazy `[\s\S]*?` regexes whose
 * backtracking was O(n²): a ~1 MB crafted body stalled the event loop for tens of seconds. The readers
 * are now linear (indexOf) with a coarse size cap. These tests pin BOTH the DoS fix (a 2 MB adversarial
 * body parses in milliseconds, not seconds) AND behaviour preservation on the tricky shapes.
 */

test("a 2 MB adversarial body parses in well under a second (was O(n²) seconds)", () => {
  // Each of these shapes drove one of the three vulnerable patterns to end-of-string re-scanning.
  for (const chunk of ["<result ", "<fault ", "<![CDATA[", "</result", "<eori:"]) {
    const body = chunk.repeat(Math.ceil((2 * 1024 * 1024) / chunk.length));
    const t0 = process.hrtime.bigint();
    // No fault, no closable result/eori → "no recognisable response" throw. The point is TIMING.
    assert.throws(() => parseValidateEoriResponse(body));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 500, `parsing a 2 MB "${chunk}"×N body took ${ms.toFixed(0)}ms (expected < 500ms)`);
  }
});

test("a body past MAX_RESPONSE_BYTES is rejected before any scanning", () => {
  const huge = "a".repeat(MAX_RESPONSE_BYTES + 1);
  assert.throws(() => parseValidateEoriResponse(huge), /too large to parse/);
});

test("MANY well-formed sibling <result> blocks parse in linear time (not O(n²))", () => {
  // The DoS trigger the first perf test MISSED: a response with N valid result blocks. The scanners
  // must lowercase the body ONCE per parse, not once per block (that was quadratic: 20k blocks ≈ 7s).
  const N = 20000;
  const body =
    "<validateEORIResponse>" +
    "<result><eori>DE1</eori><status>1</status><statusDescr>x</statusDescr></result>".repeat(N) +
    "</validateEORIResponse>";
  const t0 = process.hrtime.bigint();
  const parsed = parseValidateEoriResponse(body);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(parsed.results.length, N);
  assert.ok(ms < 500, `parsing ${N} result blocks took ${ms.toFixed(0)}ms (expected < 500ms; O(n²) was ~7000ms)`);
});

test("an empty-prefix element (<:result>) is NOT matched (parity with the old [\\w.-]+: regex)", () => {
  const body = "<validateEORIResponse><:result><eori>DE9</eori><status>0</status><statusDescr>x</statusDescr></:result></validateEORIResponse>";
  assert.throws(() => parseValidateEoriResponse(body)); // no real <result> → "no recognisable response"
});

test("behaviour preserved: namespace prefixes, attributes, CDATA, entities, multi-result", () => {
  const body =
    "<soapenv:Envelope><soapenv:Body><ns2:validateEORIResponse>" +
    '<result attr="x"><eori>DE123456789012345</eori><status>0</status>' +
    "<statusDescr><![CDATA[Valid & <ok>]]></statusDescr>" +
    "<name>ACME &amp; Co</name></result>" +
    "<result><eori>FR000000000000</eori><status>1</status><statusDescr>Not valid</statusDescr></result>" +
    "</ns2:validateEORIResponse></soapenv:Body></soapenv:Envelope>";
  const parsed = parseValidateEoriResponse(body);
  assert.equal(parsed.results.length, 2);
  assert.equal(parsed.results[0]!.eori, "DE123456789012345");
  assert.equal(parsed.results[0]!.status, 0);
  assert.equal(parsed.results[0]!.statusDescription, "Valid & <ok>"); // CDATA unwrapped, entities decoded
  assert.equal(parsed.results[0]!.name, "ACME & Co");
  assert.equal(parsed.results[1]!.status, 1);
});

test("behaviour preserved: a <resultfoo> sibling is NOT read as a <result>", () => {
  const body =
    "<validateEORIResponse><resultfoo><eori>X</eori></resultfoo>" +
    "<result><eori>DE1</eori><status>0</status><statusDescr>ok</statusDescr></result>" +
    "</validateEORIResponse>";
  const parsed = parseValidateEoriResponse(body);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0]!.eori, "DE1");
});

test("behaviour preserved: a SOAP Fault (prefixed, whitespace close tag) throws with its faultstring", () => {
  const body =
    "<soapenv:Envelope><soapenv:Body><soapenv:Fault>" +
    "<faultcode>soapenv:Server</faultcode><faultstring>backend down</faultstring>" +
    "</soapenv:Fault ></soapenv:Body></soapenv:Envelope>";
  assert.throws(() => parseValidateEoriResponse(body), (e: unknown) => {
    assert.ok(e instanceof Error && /backend down/.test(e.message));
    return true;
  });
});

// @opendpp/aeo soap test — envelope builder + response parser (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
// Fixtures are VERBATIM captures from the live EU EOS aeo-retrieve service.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRetrieveAeoEnvelope,
  parseRetrieveAeoResponse,
  AeoServiceError,
} from "../src/index.ts";

// Live capture: holderName "BMW", issuingCountry DE, type AEOF → one match.
const RESPONSE_FOUND = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:retrieveAEOResponse xmlns:ns0="http://aeo.ws.eos.dds.s/"><return><requestDate>2026-06-30</requestDate><result><authorisationHolderName>BMW M GmbH Gesellschaft für individuelle Automobile</authorisationHolderName><issuingCountry>Germany</issuingCountry><competentCustomsAuthority>DE007600</competentCustomsAuthority><authorisation.type>AEOF</authorisation.type><effectiveDate>17/02/2015</effectiveDate></result></return></ns0:retrieveAEOResponse></S:Body></S:Envelope>`;

// Live capture: gibberish holder → wrapper present, NO <result>.
const RESPONSE_NOT_FOUND = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:retrieveAEOResponse xmlns:ns0="http://aeo.ws.eos.dds.s/"><return><requestDate>2026-06-30</requestDate></return></ns0:retrieveAEOResponse></S:Body></S:Envelope>`;

// Live capture: omitting authorisationType → SOAP Fault.
const RESPONSE_FAULT = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:Fault xmlns:ns0="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>ns0:Client</faultcode><faultstring>cvc-complex-type.2.4.b: The content of element 'aeo:aeoRequestType' is not complete.</faultstring></ns0:Fault></S:Body></S:Envelope>`;

test("buildRetrieveAeoEnvelope — qualified wrapper + children, ordered, escaped", () => {
  const env = buildRetrieveAeoEnvelope([
    { holderName: "BMW & Co", issuingCountry: "DE", authorisationTypes: ["AEOC", "AEOF", "AEOS"] },
  ]);
  assert.match(env, /xmlns:aeo="http:\/\/aeo\.ws\.eos\.dds\.s\/"/);
  assert.match(env, /<aeo:retrieveAEO><aeo:aeoRequestType>/);
  assert.match(env, /<aeo:authorisationHolderName>BMW &amp; Co<\/aeo:authorisationHolderName>/);
  assert.match(env, /<aeo:issuingCountry>DE<\/aeo:issuingCountry>/);
  assert.match(env, /<aeo:authorisationType>AEOC<\/aeo:authorisationType>/);
  // XSD sequence order: holderName before issuingCountry before authorisationType
  assert.ok(
    env.indexOf("authorisationHolderName") <
      env.indexOf("issuingCountry") &&
      env.indexOf("issuingCountry") < env.indexOf("authorisationType"),
    "element order must follow the XSD sequence",
  );
});

test("buildRetrieveAeoEnvelope — omits issuingCountry when absent", () => {
  const env = buildRetrieveAeoEnvelope([{ holderName: "Bosch", authorisationTypes: ["AEOF"] }]);
  assert.doesNotMatch(env, /issuingCountry/);
  assert.match(env, /<aeo:authorisationType>AEOF<\/aeo:authorisationType>/);
});

test("parseRetrieveAeoResponse — parses a match incl. dotted authorisation.type", () => {
  const parsed = parseRetrieveAeoResponse(RESPONSE_FOUND);
  assert.equal(parsed.requestDate, "2026-06-30");
  assert.equal(parsed.results.length, 1);
  const r = parsed.results[0];
  assert.equal(r?.authorisationHolderName, "BMW M GmbH Gesellschaft für individuelle Automobile");
  assert.equal(r?.issuingCountry, "Germany"); // full name, not a code
  assert.equal(r?.competentCustomsAuthority, "DE007600");
  assert.equal(r?.authorisationType, "AEOF"); // read from <authorisation.type>
  assert.equal(r?.effectiveDate, "17/02/2015");
});

test("parseRetrieveAeoResponse — no <result> is a valid empty result", () => {
  const parsed = parseRetrieveAeoResponse(RESPONSE_NOT_FOUND);
  assert.equal(parsed.results.length, 0);
  assert.equal(parsed.requestDate, "2026-06-30");
});

test("parseRetrieveAeoResponse — SOAP Fault throws AeoServiceError", () => {
  assert.throws(
    () => parseRetrieveAeoResponse(RESPONSE_FAULT),
    (err: unknown) =>
      err instanceof AeoServiceError &&
      /not complete/.test(err.message) &&
      err.faultCode === "ns0:Client",
  );
});

test("parseRetrieveAeoResponse — unrecognised body throws", () => {
  assert.throws(() => parseRetrieveAeoResponse("<html>nope</html>"), AeoServiceError);
});

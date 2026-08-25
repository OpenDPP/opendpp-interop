/**
 * @opendpp/aeo lookup test — the authoritative EOS lookup, driven entirely offline
 *
 * Pins the whole request/response contract of `lookupAeo`: the envelope actually sent (holder,
 * country, the chosen authorisation types, and the default of all three), the typed shape of a
 * match, a clean no-match, batch ordering, rate-limit slot acquisition, and the three failure modes
 * that must stay distinguishable — a non-2xx with no fault, an HTTP 500 carrying a SOAP fault whose
 * faultstring has to survive, and a transport error wrapped as AeoServiceError.
 *
 * NO NETWORK: every service call goes through an injected mock transport, and the fixtures are
 * VERBATIM captures from the live EU EOS aeo-retrieve service — so this file pins OUR handling of
 * the real payloads without depending on the service being up, or on it not having changed.
 *
 * NOT asserted here: the ReDoS hardening of the parser (soap-redos.test.ts) and the offline shape
 * helpers (format.test.ts).
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  lookupAeo,
  lookupAeoBatch,
  hasAeoAuthorisation,
  AeoServiceError,
  AEO_RETRIEVE_ENDPOINT,
  MAX_CRITERIA_PER_REQUEST,
  type AeoTransport,
} from "../src/index.ts";

const RESPONSE_FOUND = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:retrieveAEOResponse xmlns:ns0="http://aeo.ws.eos.dds.s/"><return><requestDate>2026-06-30</requestDate><result><authorisationHolderName>BMW M GmbH Gesellschaft für individuelle Automobile</authorisationHolderName><issuingCountry>Germany</issuingCountry><competentCustomsAuthority>DE007600</competentCustomsAuthority><authorisation.type>AEOF</authorisation.type><effectiveDate>17/02/2015</effectiveDate></result></return></ns0:retrieveAEOResponse></S:Body></S:Envelope>`;
const RESPONSE_NOT_FOUND = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:retrieveAEOResponse xmlns:ns0="http://aeo.ws.eos.dds.s/"><return><requestDate>2026-06-30</requestDate></return></ns0:retrieveAEOResponse></S:Body></S:Envelope>`;
const RESPONSE_FAULT = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:Fault xmlns:ns0="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>ns0:Client</faultcode><faultstring>cvc-complex-type.2.4.b: not complete</faultstring></ns0:Fault></S:Body></S:Envelope>`;

function fixedTransport(body: string, status = 200): AeoTransport {
  return async () => ({ status, text: async () => body });
}

/** Captures each request body so we can assert on the envelope that was sent. */
function capturingTransport(body: string): { transport: AeoTransport; bodies: string[] } {
  const bodies: string[] = [];
  const transport: AeoTransport = async (_url, req) => {
    bodies.push(req.body);
    return { status: 200, text: async () => body };
  };
  return { transport, bodies };
}

test("lookupAeo — a match is surfaced with typed fields", async () => {
  const result = await lookupAeo(
    { holderName: "BMW", issuingCountry: "DE" },
    { transport: fixedTransport(RESPONSE_FOUND) },
  );
  assert.equal(result.found, true);
  assert.equal(result.matches.length, 1);
  const m = result.matches[0];
  assert.equal(m?.authorisationHolderName, "BMW M GmbH Gesellschaft für individuelle Automobile");
  assert.equal(m?.issuingCountry, "Germany");
  assert.equal(m?.competentCustomsAuthority, "DE007600");
  assert.equal(m?.authorisationType, "AEOF");
  assert.equal(m?.effectiveDate, "17/02/2015");
  assert.equal(result.source, "ec-europa-eos");
  assert.equal(result.requestDate, "2026-06-30");
  assert.equal(result.query.issuingCountry, "DE");
});

test("lookupAeo — default authorisationType is all three", async () => {
  const result = await lookupAeo({ holderName: "BMW" }, { transport: fixedTransport(RESPONSE_FOUND) });
  assert.deepEqual(result.query.authorisationTypes, ["AEOC", "AEOF", "AEOS"]);
});

test("lookupAeo — no match → found:false, empty matches", async () => {
  const result = await lookupAeo({ holderName: "ZZQXNOTAREAL" }, {
    transport: fixedTransport(RESPONSE_NOT_FOUND),
  });
  assert.equal(result.found, false);
  assert.deepEqual(result.matches, []);
  assert.equal(result.requestDate, "2026-06-30");
});

test("lookupAeo — sends a well-formed envelope (holder, country, chosen types)", async () => {
  const { transport, bodies } = capturingTransport(RESPONSE_FOUND);
  await lookupAeo({ holderName: "Bosch", issuingCountry: "de", authorisationType: ["AEOF"] }, { transport });
  const sent = bodies[0] ?? "";
  assert.match(sent, /<aeo:authorisationHolderName>Bosch<\/aeo:authorisationHolderName>/);
  assert.match(sent, /<aeo:issuingCountry>DE<\/aeo:issuingCountry>/); // normalised upper-case
  assert.match(sent, /<aeo:authorisationType>AEOF<\/aeo:authorisationType>/);
  assert.doesNotMatch(sent, /AEOC|AEOS/); // only the chosen type
});

test("lookupAeo — invalid authorisationType falls back to all three", async () => {
  const result = await lookupAeo(
    { holderName: "BMW", authorisationType: "AEOX" as never },
    { transport: fixedTransport(RESPONSE_FOUND) },
  );
  assert.deepEqual(result.query.authorisationTypes, ["AEOC", "AEOF", "AEOS"]);
});

test("lookupAeo — rejects empty holderName", async () => {
  await assert.rejects(
    () => lookupAeo({ holderName: "  " }, { transport: fixedTransport(RESPONSE_FOUND) }),
    /holderName is required/,
  );
});

test("lookupAeo — rejects a malformed issuingCountry", async () => {
  await assert.rejects(
    () => lookupAeo({ holderName: "BMW", issuingCountry: "DEU" }, { transport: fixedTransport(RESPONSE_FOUND) }),
    /2-letter ISO country code/,
  );
});

test("lookupAeo — acquires a rate-limit slot once per request", async () => {
  let acquired = 0;
  const limiter = { acquire: async () => { acquired++; } };
  await lookupAeo({ holderName: "BMW" }, { transport: fixedTransport(RESPONSE_FOUND), rateLimiter: limiter });
  assert.equal(acquired, 1);
});

test("lookupAeoBatch — one request per query, in order", async () => {
  const { transport, bodies } = capturingTransport(RESPONSE_NOT_FOUND);
  const results = await lookupAeoBatch(
    [{ holderName: "Alpha" }, { holderName: "Beta" }, { holderName: "Gamma" }],
    { transport, rateLimiter: null },
  );
  assert.equal(results.length, 3);
  assert.equal(bodies.length, 3);
  assert.match(bodies[0] ?? "", /Alpha/);
  assert.match(bodies[2] ?? "", /Gamma/);
});

test("lookupAeo — non-2xx without a fault throws", async () => {
  await assert.rejects(
    () => lookupAeo({ holderName: "BMW" }, { transport: fixedTransport("down", 503) }),
    (err: unknown) => err instanceof AeoServiceError && /HTTP 503/.test(err.message),
  );
});

test("lookupAeo — HTTP 500 carrying a SOAP fault surfaces the faultstring", async () => {
  await assert.rejects(
    () => lookupAeo({ holderName: "BMW" }, { transport: fixedTransport(RESPONSE_FAULT, 500) }),
    (err: unknown) => err instanceof AeoServiceError && /not complete/.test(err.message),
  );
});

test("lookupAeo — transport error is wrapped in AeoServiceError", async () => {
  const boom: AeoTransport = async () => {
    throw new Error("ECONNREFUSED");
  };
  await assert.rejects(
    () => lookupAeo({ holderName: "BMW" }, { transport: boom }),
    (err: unknown) =>
      err instanceof AeoServiceError &&
      /transport error/.test(err.message) &&
      (err as Error).cause instanceof Error,
  );
});

test("hasAeoAuthorisation — boolean convenience", async () => {
  assert.equal(await hasAeoAuthorisation("BMW", { transport: fixedTransport(RESPONSE_FOUND) }), true);
  assert.equal(await hasAeoAuthorisation("nope", { transport: fixedTransport(RESPONSE_NOT_FOUND) }), false);
});

test("endpoint + criteria constants", () => {
  assert.equal(
    AEO_RETRIEVE_ENDPOINT,
    "https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/aeo-retrieve",
  );
  assert.equal(MAX_CRITERIA_PER_REQUEST, 10);
});

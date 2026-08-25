/**
 * @opendpp/eori validate test — the authoritative EU check, driven entirely offline
 *
 * Pins the full contract of `validateEori` and `validateEoriBatch`: the envelope built (namespaced
 * wrapper, unqualified children, escaped), namespace-tolerant parsing, and the three answers a
 * caller must be able to tell apart — valid with name/address, a service verdict of not-valid, and a
 * transport or fault failure surfaced as EoriServiceError with the faultstring intact.
 *
 * Three behaviours here are the load-bearing ones. A syntactically invalid input is NEVER sent to the
 * service — it is answered offline, so a typo cannot burn a rate-limit slot. A GB number carries an
 * HMRC caveat EVEN WHEN the EU service says not-valid, because the EU register is not authoritative
 * for GB and reporting its "no" as the answer would be wrong. And the batch path chunks to ≤10 per
 * request while preserving input order and de-duplicating repeats into one slot — the service's own
 * limit, where a silent reorder would attach one company's verdict to another's number.
 *
 * NO NETWORK: every service call goes through an injected mock transport.
 *
 * NOT asserted here: prefix classification (countries.test.ts), offline shape rules
 * (format.test.ts), and the parser's linear-time guarantee (soap-redos.test.ts).
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildValidateEoriEnvelope,
  parseValidateEoriResponse,
  validateEori,
  validateEoriBatch,
  isEoriRegistered,
  EoriServiceError,
  EORI_VALIDATION_ENDPOINT,
  type EoriTransport,
} from "../src/index.ts";

// --- fixtures -------------------------------------------------------------

// A realistic, namespace-prefixed response: one valid (with name/address split
// fields), one not-valid. Mirrors the EU EOS validateEORIResponse shape.
const RESPONSE_MIXED = `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Body>
    <ns2:validateEORIResponse xmlns:ns2="http://eori.ws.eos.dds.s/">
      <return>
        <requestDate>2026-06-30+02:00</requestDate>
        <result>
          <eori>IE2025292W</eori>
          <status>0</status>
          <statusDescr>Valid</statusDescr>
          <name>EXAMPLE TRADING LTD</name>
          <address>1 SAMPLE STREET, DUBLIN</address>
          <street>1 SAMPLE STREET</street>
          <postalCode>D01 AB12</postalCode>
          <city>DUBLIN</city>
          <country>IE</country>
        </result>
        <result>
          <eori>DE000000000000000</eori>
          <status>1</status>
          <statusDescr>Not valid</statusDescr>
        </result>
      </return>
    </ns2:validateEORIResponse>
  </S:Body>
</S:Envelope>`;

const RESPONSE_FAULT = `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Body>
    <S:Fault>
      <faultcode>S:Server</faultcode>
      <faultstring>Number of EORI exceeds the maximum allowed</faultstring>
    </S:Fault>
  </S:Body>
</S:Envelope>`;

/** Build a mock transport that echoes each requested EORI back as valid (status 0). */
function echoTransport(calls: string[][]): EoriTransport {
  return async (_url, req) => {
    const eoris = [...req.body.matchAll(/<eori:eori>([^<]*)<\/eori:eori>/g)].map((m) => m[1] ?? "");
    calls.push(eoris);
    const results = eoris
      .map(
        (e) =>
          `<result><eori>${e}</eori><status>0</status><statusDescr>Valid</statusDescr></result>`,
      )
      .join("");
    const body = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:validateEORIResponse xmlns:ns2="http://eori.ws.eos.dds.s/"><return><requestDate>2026-06-30+02:00</requestDate>${results}</return></ns2:validateEORIResponse></S:Body></S:Envelope>`;
    return { status: 200, text: async () => body };
  };
}

/** A transport that always returns a fixed body/status. */
function fixedTransport(body: string, status = 200): EoriTransport {
  return async () => ({ status, text: async () => body });
}

// --- envelope builder -----------------------------------------------------

test("buildValidateEoriEnvelope — namespaced wrapper, unqualified eori children, escaped", () => {
  const env = buildValidateEoriEnvelope(["IE2025292W", "DE<bad>"]);
  assert.match(env, /xmlns:eori="http:\/\/eori\.ws\.eos\.dds\.s\/"/);
  assert.match(env, /<eori:validateEORI>/);
  assert.match(env, /<eori:eori>IE2025292W<\/eori:eori>/);
  assert.match(env, /<eori:eori>DE&lt;bad&gt;<\/eori:eori>/); // escaped + namespace-qualified
});

// --- response parser ------------------------------------------------------

test("parseValidateEoriResponse — flat, namespace-tolerant", () => {
  const parsed = parseValidateEoriResponse(RESPONSE_MIXED);
  assert.equal(parsed.requestDate, "2026-06-30+02:00");
  assert.equal(parsed.results.length, 2);

  const [ok, no] = parsed.results;
  assert.equal(ok?.eori, "IE2025292W");
  assert.equal(ok?.status, 0);
  assert.equal(ok?.statusDescription, "Valid");
  assert.equal(ok?.name, "EXAMPLE TRADING LTD");
  assert.equal(ok?.city, "DUBLIN");
  assert.equal(ok?.country, "IE");

  assert.equal(no?.status, 1);
  assert.equal(no?.name, undefined);
});

test("parseValidateEoriResponse — SOAP Fault throws EoriServiceError", () => {
  assert.throws(
    () => parseValidateEoriResponse(RESPONSE_FAULT),
    (err: unknown) =>
      err instanceof EoriServiceError &&
      /exceeds the maximum/.test(err.message) &&
      err.faultCode === "S:Server",
  );
});

// --- high-level validateEori ----------------------------------------------

test("validateEori — valid number is surfaced with name/address + EU scope", async () => {
  const result = await validateEori("ie2025292w", { transport: fixedTransport(RESPONSE_MIXED) });
  assert.equal(result.eori, "IE2025292W");
  assert.equal(result.input, "ie2025292w");
  assert.equal(result.valid, true);
  assert.equal(result.validSyntax, true);
  assert.equal(result.status, 0);
  assert.equal(result.name, "EXAMPLE TRADING LTD");
  assert.equal(result.countryScope, "eu");
  assert.equal(result.source, "ec-europa-eos");
  assert.equal(result.requestDate, "2026-06-30+02:00");
  assert.ok(result.checkedAt);
});

test("validateEori — not-valid number reports status 1, not valid", async () => {
  const result = await validateEori("DE000000000000000", {
    transport: fixedTransport(RESPONSE_MIXED),
  });
  assert.equal(result.valid, false);
  assert.equal(result.status, 1);
  assert.equal(result.statusDescription, "Not valid");
  assert.equal(result.source, "ec-europa-eos");
});

test("validateEori — syntactically invalid input is NOT sent to the service", async () => {
  let called = false;
  const transport: EoriTransport = async () => {
    called = true;
    return { status: 200, text: async () => RESPONSE_MIXED };
  };
  const result = await validateEori("not an eori!", { transport });
  assert.equal(called, false); // short-circuited offline
  assert.equal(result.valid, false);
  assert.equal(result.validSyntax, false);
  assert.equal(result.source, "offline-syntax");
  assert.match(result.statusDescription, /Not queried/);
});

test("validateEori — GB number carries an HMRC caveat even when the EU service says not valid", async () => {
  const notValidGb = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:validateEORIResponse xmlns:ns2="http://eori.ws.eos.dds.s/"><return><result><eori>GB123456789000</eori><status>1</status><statusDescr>Not valid</statusDescr></result></return></ns2:validateEORIResponse></S:Body></S:Envelope>`;
  const result = await validateEori("GB123456789000", { transport: fixedTransport(notValidGb) });
  assert.equal(result.valid, false);
  assert.equal(result.countryScope, "great-britain");
  assert.match(result.countryNote ?? "", /HMRC/);
});

test("validateEoriBatch — chunks to <=10 per request and preserves input order", async () => {
  const calls: string[][] = [];
  const inputs = Array.from({ length: 12 }, (_, i) => `DE${String(i).padStart(10, "0")}`);
  const results = await validateEoriBatch(inputs, { transport: echoTransport(calls) });

  assert.equal(results.length, 12);
  assert.equal(calls.length, 2); // 10 + 2
  assert.equal(calls[0]?.length, 10);
  assert.equal(calls[1]?.length, 2);
  assert.equal(results[0]?.eori, "DE0000000000");
  assert.equal(results[11]?.eori, "DE0000000011");
  assert.ok(results.every((r) => r.valid && r.source === "ec-europa-eos"));
});

test("validateEoriBatch — de-duplicates identical numbers into one slot", async () => {
  const calls: string[][] = [];
  const results = await validateEoriBatch(["DE111111111", "DE111111111", "FR222222222"], {
    transport: echoTransport(calls),
  });
  assert.equal(results.length, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.length, 2); // de-duped to 2 unique
  assert.equal(results[0]?.eori, "DE111111111");
  assert.equal(results[1]?.eori, "DE111111111"); // both copies resolved
  assert.equal(results[1]?.valid, true);
});

test("validateEoriBatch — mixes offline + service results", async () => {
  const results = await validateEoriBatch(["DE111111111", "bad!"], {
    transport: fixedTransport(
      `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:validateEORIResponse xmlns:ns2="http://eori.ws.eos.dds.s/"><return><result><eori>DE111111111</eori><status>0</status><statusDescr>Valid</statusDescr></result></return></ns2:validateEORIResponse></S:Body></S:Envelope>`,
    ),
  });
  assert.equal(results[0]?.source, "ec-europa-eos");
  assert.equal(results[0]?.valid, true);
  assert.equal(results[1]?.source, "offline-syntax");
  assert.equal(results[1]?.valid, false);
});

test("validateEori — non-2xx without a fault throws", async () => {
  await assert.rejects(
    () => validateEori("DE111111111", { transport: fixedTransport("upstream down", 503) }),
    (err: unknown) => err instanceof EoriServiceError && /HTTP 503/.test(err.message),
  );
});

test("validateEori — HTTP 500 carrying a SOAP fault surfaces the faultstring", async () => {
  await assert.rejects(
    () => validateEori("DE111111111", { transport: fixedTransport(RESPONSE_FAULT, 500) }),
    (err: unknown) => err instanceof EoriServiceError && /exceeds the maximum/.test(err.message),
  );
});

test("validateEori — transport error is wrapped in EoriServiceError", async () => {
  const boom: EoriTransport = async () => {
    throw new Error("ECONNREFUSED");
  };
  await assert.rejects(
    () => validateEori("DE111111111", { transport: boom }),
    (err: unknown) =>
      err instanceof EoriServiceError &&
      /transport error/.test(err.message) &&
      (err as Error).cause instanceof Error,
  );
});

test("isEoriRegistered — boolean convenience", async () => {
  assert.equal(
    await isEoriRegistered("ie2025292w", { transport: fixedTransport(RESPONSE_MIXED) }),
    true,
  );
});

test("validateEoriBatch — acquires a rate-limit slot once per HTTP request", async () => {
  const calls: string[][] = [];
  let acquired = 0;
  const limiter = {
    acquire: async () => {
      acquired++;
    },
  };
  const inputs = Array.from({ length: 12 }, (_, i) => `DE${String(i).padStart(10, "0")}`);
  await validateEoriBatch(inputs, { transport: echoTransport(calls), rateLimiter: limiter });
  assert.equal(calls.length, 2); // 2 chunks (10 + 2)
  assert.equal(acquired, 2); // limiter acquired before each request
});

test("validateEori — rateLimiter:null bypasses throttling", async () => {
  const calls: string[][] = [];
  const result = await validateEori("DE111111111", {
    transport: echoTransport(calls),
    rateLimiter: null,
  });
  assert.equal(result.valid, true);
  assert.equal(calls.length, 1);
});

test("endpoint constant points at the official EU EOS service", () => {
  assert.equal(
    EORI_VALIDATION_ENDPOINT,
    "https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation",
  );
});

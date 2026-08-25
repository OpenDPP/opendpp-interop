/**
 * @opendpp/vies check test — the EU VAT existence check, driven entirely offline
 *
 * Pins what `checkVatId` sends and what it makes of every answer: the {countryCode, vatNumber} JSON
 * built from the NORMALISED id, a registered result surfaced with name and address, a not-registered
 * result as valid:false, and batch behaviour that returns one result per input, in order,
 * de-duplicating repeats.
 *
 * Two behaviours carry the weight. A syntactically invalid id short-circuits offline and NEVER calls
 * the transport, so a typo cannot spend a request against a service that rate-limits. And every
 * malformed answer is an ERROR, not a verdict — a non-2xx, a transport failure, an unparseable body,
 * and a body missing a boolean `valid` all throw ViesServiceError rather than degrading to
 * valid:false. That distinction is the whole point: "VIES says this VAT number is not registered" and
 * "VIES did not answer" are different facts, and collapsing them would let an outage read as a
 * customer being unregistered.
 *
 * VIES also returns the literal '---' placeholder for an unknown name or address; that is dropped
 * rather than stored, so the placeholder never reaches a record as if it were a company's name.
 *
 * NO NETWORK: every service call goes through an injected mock transport.
 *
 * NOT asserted here: offline syntax rules, which are format.test.ts.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkVatId,
  checkVatIdBatch,
  isVatRegistered,
  ViesServiceError,
  VIES_CHECK_URL,
  type ViesTransport,
} from "../src/index.ts";

/** A transport that returns a fixed JSON payload/status and records the request bodies it saw. */
function jsonTransport(payload: unknown, status = 200, calls: string[] = []): ViesTransport {
  return async (_url, req) => {
    calls.push(req.body);
    return { status, text: async () => JSON.stringify(payload) };
  };
}

test("checkVatId — a registered id is surfaced with valid + name + address", async () => {
  const result = await checkVatId("DE123456789", {
    transport: jsonTransport({ valid: true, name: "ACME GMBH", address: "1 SAMPLE STR, BERLIN" }),
  });
  assert.equal(result.checked, true);
  assert.equal(result.valid, true);
  assert.equal(result.validSyntax, true);
  assert.equal(result.name, "ACME GMBH");
  assert.equal(result.address, "1 SAMPLE STR, BERLIN");
  assert.equal(result.countryCode, "DE");
  assert.equal(result.statusDescription, "Valid");
  assert.equal(result.source, "ec-europa-vies");
  assert.ok(result.checkedAt);
});

test("checkVatId — VIES '---' placeholder name/address is dropped", async () => {
  const result = await checkVatId("DE123456789", {
    transport: jsonTransport({ valid: true, name: "---", address: "---" }),
  });
  assert.equal(result.valid, true);
  assert.equal(result.name, undefined);
  assert.equal(result.address, undefined);
});

test("checkVatId — a not-registered id reports valid:false", async () => {
  const result = await checkVatId("DE123456789", { transport: jsonTransport({ valid: false }) });
  assert.equal(result.checked, true);
  assert.equal(result.valid, false);
  assert.equal(result.statusDescription, "Not valid");
  assert.equal(result.source, "ec-europa-vies");
});

test("checkVatId — posts {countryCode, vatNumber} JSON from the normalised id", async () => {
  const calls: string[] = [];
  await checkVatId(" el 123 456 789 ", { transport: jsonTransport({ valid: true }, 200, calls) });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0] ?? "{}"), { countryCode: "EL", vatNumber: "123456789" });
});

test("checkVatId — syntactically invalid input short-circuits offline, never calls the transport", async () => {
  let called = false;
  const transport: ViesTransport = async () => {
    called = true;
    return { status: 200, text: async () => JSON.stringify({ valid: true }) };
  };
  const result = await checkVatId("US1234567", { transport });
  assert.equal(called, false); // never queried
  assert.equal(result.checked, false);
  assert.equal(result.valid, false);
  assert.equal(result.validSyntax, false);
  assert.equal(result.source, "offline-syntax");
  assert.match(result.statusDescription, /Not queried/);
});

test("checkVatId — a non-2xx response throws ViesServiceError", async () => {
  await assert.rejects(
    () => checkVatId("DE123456789", { transport: jsonTransport({ valid: true }, 503) }),
    (err: unknown) => err instanceof ViesServiceError && /HTTP 503/.test(err.message),
  );
});

test("checkVatId — a transport error is wrapped in ViesServiceError", async () => {
  const boom: ViesTransport = async () => {
    throw new Error("ECONNREFUSED");
  };
  await assert.rejects(
    () => checkVatId("DE123456789", { transport: boom }),
    (err: unknown) =>
      err instanceof ViesServiceError &&
      /transport error/.test(err.message) &&
      (err as Error).cause instanceof Error,
  );
});

test("checkVatId — an unparseable body throws ViesServiceError", async () => {
  const garbage: ViesTransport = async () => ({ status: 200, text: async () => "not json" });
  await assert.rejects(
    () => checkVatId("DE123456789", { transport: garbage }),
    (err: unknown) => err instanceof ViesServiceError,
  );
});

test("checkVatId — a response without a boolean 'valid' throws ViesServiceError", async () => {
  await assert.rejects(
    () => checkVatId("DE123456789", { transport: jsonTransport({ foo: "bar" }) }),
    (err: unknown) => err instanceof ViesServiceError,
  );
});

test("isVatRegistered — boolean convenience", async () => {
  assert.equal(
    await isVatRegistered("DE123456789", { transport: jsonTransport({ valid: true }) }),
    true,
  );
  assert.equal(
    await isVatRegistered("DE123456789", { transport: jsonTransport({ valid: false }) }),
    false,
  );
});

test("checkVatIdBatch — one result per input, in order, de-duplicating repeats", async () => {
  const calls: string[] = [];
  const results = await checkVatIdBatch(["DE123456789", "DE123456789", "US1234567"], {
    transport: jsonTransport({ valid: true }, 200, calls),
  });
  assert.equal(results.length, 3);
  assert.equal(calls.length, 1); // repeated DE queried once; the US id is answered offline
  assert.equal(results[0]?.valid, true);
  assert.equal(results[0]?.source, "ec-europa-vies");
  assert.equal(results[1]?.valid, true); // duplicate resolved from cache
  assert.equal(results[1]?.source, "ec-europa-vies");
  assert.equal(results[2]?.source, "offline-syntax"); // non-EU prefix, never queried
  assert.equal(results[2]?.checked, false);
});

test("endpoint constant points at the official EU VIES REST service", () => {
  assert.equal(VIES_CHECK_URL, "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number");
});

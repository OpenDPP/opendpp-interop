/**
 * @opendpp/testdata event-chain test — EPCIS 2.0 shape rules and the UNSIGNED UNTP envelope
 *
 * Pins that a generated chain obeys the same EPCIS 2.0 rules the node enforces at ingest, so sample
 * data an integrator generates is data the hosted service will actually accept — a generator that
 * drifts from the ingest rules produces samples that fail on first use, which is worse than no
 * samples. Determinism is pinned alongside it, including that component EPCs stay inside the
 * reserved 900+ block so a sample can never collide with a real product identifier.
 *
 * The load-bearing assertion is that `toUntpEventCredential` wraps the event UNSIGNED and NEVER
 * fabricates a proof. Sample data that carried a proof-shaped object would be a forged credential the
 * moment someone published it; the absence of the proof is the honest signal that this is a sample.
 *
 * `toEpcisDocument` is pinned for its envelope shape, CBV URN → short-name mapping, location
 * wrapping, type-gated EPC fields, and content-addressed eventID — the last so re-capturing the same
 * event is idempotent rather than minting a duplicate.
 *
 * Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EPCIS_CONTEXT,
  generateEventChain,
  generatePassport,
  sgtinEpc,
  toEpcisDocument,
  toUntpEventCredential,
} from "../src/index.js";

const passport = generatePassport({ category: "batteries" });

test("chain follows the EPCIS 2.0 rules the node enforces at ingest", () => {
  const chain = generateEventChain(passport);
  assert.equal(chain.length, 4);
  const [commissioning, transformation, packing, shipping] = chain;

  // TransformationEvent NEVER carries an action; every other event type always does.
  assert.equal(transformation.eventType, "TransformationEvent");
  assert.equal(transformation.action, null);
  for (const e of [commissioning, packing, shipping]) {
    assert.notEqual(e.eventType, "TransformationEvent");
    assert.ok(e.action, `${e.eventType} must carry an action`);
  }

  // The transformation consumes the commissioned components and outputs the product EPC.
  assert.deepEqual(transformation.inputEpcList, commissioning.epcList);
  const productEpc = sgtinEpc(passport.productId, 1);
  assert.deepEqual(transformation.outputEpcList, [productEpc]);
  assert.deepEqual(packing.childEpcs, [productEpc]);
  assert.ok(packing.parentEpc, "aggregation needs a parent EPC");
  assert.deepEqual(shipping.epcList, [productEpc]);

  // CBV URNs + geo read points + strictly ascending ISO timestamps.
  for (const e of chain) {
    assert.match(e.bizStep, /^urn:epcglobal:cbv:bizstep:/);
    assert.match(e.disposition, /^urn:epcglobal:cbv:disp:/);
    assert.match(e.readPoint, /^geo:-?\d+\.\d+,-?\d+\.\d+$/);
    assert.ok(!Number.isNaN(Date.parse(e.eventTime)));
  }
  for (let i = 1; i < chain.length; i++) {
    assert.ok(Date.parse(chain[i].eventTime) > Date.parse(chain[i - 1].eventTime), "eventTime must ascend");
  }
});

test("chain is deterministic and component EPCs stay in the reserved 900+ block", () => {
  assert.deepEqual(generateEventChain(passport), generateEventChain(passport));
  const chain = generateEventChain(passport, { baseTime: "2027-03-01T00:00:00.000Z" });
  assert.equal(chain[0].eventTime, "2027-03-01T00:00:00.000Z");
  for (const epc of chain[1].inputEpcList ?? []) {
    // sgtin middle segment = GTIN digits 8–13: the prefix tail (3) + the 3-digit item ref.
    const itemRef = Number(epc.split(".")[1]!.slice(3));
    assert.ok(itemRef >= 900, `component item ref must be >= 900, got ${itemRef} in ${epc}`);
  }
  assert.throws(() => generateEventChain({ productId: "WIDGET-1" }), /GTIN-14 productId/);
});

test("toUntpEventCredential wraps the event UNSIGNED — never a fabricated proof", () => {
  const [event] = generateEventChain(passport);
  const vc = toUntpEventCredential(event) as Record<string, any>;
  assert.deepEqual(vc.credentialSubject, { ...event });
  assert.equal(vc.issuer, "did:web:issuer.example.opendpp-node.eu");
  assert.equal(vc.issuanceDate, event.eventTime);
  assert.equal("proof" in vc, false, "the caller signs; this package must not fabricate proofs");
  const custom = toUntpEventCredential(event, { issuerDid: "did:web:acme.example", issuanceDate: "2026-02-01T00:00:00.000Z" }) as Record<string, any>;
  assert.equal(custom.issuer, "did:web:acme.example");
  assert.equal(custom.issuanceDate, "2026-02-01T00:00:00.000Z");
});

test("toEpcisDocument emits a conformant-shaped EPCIS 2.0 document envelope", () => {
  const chain = generateEventChain(passport);
  const doc = toEpcisDocument(chain) as Record<string, any>;
  assert.deepEqual(doc["@context"], [EPCIS_CONTEXT]);
  assert.equal(doc.type, "EPCISDocument");
  assert.equal(doc.schemaVersion, "2.0");
  // creationDate is derived from the LATEST eventTime (deterministic, not the wall clock).
  const latest = Math.max(...chain.map((e) => Date.parse(e.eventTime)));
  assert.equal(doc.creationDate, new Date(latest).toISOString());
  assert.equal(doc.epcisBody.eventList.length, chain.length);
});

test("toEpcisDocument maps CBV URNs → short names, wraps locations, gates EPC fields by type", () => {
  const chain = generateEventChain(passport);
  const [commissioning, transformation, packing, shipping] = toEpcisDocument(chain).epcisBody.eventList as Record<string, any>[];

  // CBV URN → official short name (schema rejects the urn:epcglobal:cbv:* form).
  assert.equal(commissioning.bizStep, "commissioning");
  assert.equal(commissioning.disposition, "active");
  assert.match(commissioning.eventID, /^urn:opendpp:testdata:event:[0-9a-f]{32}$/);
  assert.equal(commissioning.eventTimeZoneOffset, "+00:00");

  // Locations become {id} URIs: a geo: read point passes through, a bare biz location is URN-wrapped.
  assert.match(commissioning.readPoint.id, /^geo:/);
  assert.match(commissioning.bizLocation.id, /^urn:opendpp:location:/);

  // EPC-list fields are gated to their type-correct home (EPCIS 2.0 JSON casing).
  assert.ok(Array.isArray(commissioning.epcList) && !("childEPCs" in commissioning));
  assert.equal(transformation.type, "TransformationEvent");
  assert.equal("action" in transformation, false, "TransformationEvent must carry no action");
  assert.ok(Array.isArray(transformation.inputEPCList) && Array.isArray(transformation.outputEPCList));
  assert.equal("epcList" in transformation, false);
  assert.equal(packing.type, "AggregationEvent");
  assert.ok(typeof packing.parentID === "string" && Array.isArray(packing.childEPCs));
  assert.equal("epcList" in packing, false, "an epcList on an AggregationEvent fails the official schema");
  assert.equal(shipping.action, "OBSERVE");
});

test("toEpcisDocument is deterministic and content-addresses eventID (idempotent re-capture)", () => {
  assert.equal(
    JSON.stringify(toEpcisDocument(generateEventChain(passport))),
    JSON.stringify(toEpcisDocument(generateEventChain(passport))),
  );
  // Same event content → same eventID regardless of how chains are combined (identity, not position).
  const other = generatePassport({ category: "electronics" });
  const solo = toEpcisDocument(generateEventChain(passport)).epcisBody.eventList as Record<string, any>[];
  const combined = toEpcisDocument([...generateEventChain(other), ...generateEventChain(passport)]).epcisBody.eventList as Record<string, any>[];
  const soloIds = solo.map((e) => e.eventID);
  const combinedIds = new Set(combined.map((e) => e.eventID));
  for (const id of soloIds) assert.ok(combinedIds.has(id), "an event keeps its content-addressed id when combined");
});

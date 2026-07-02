// @opendpp/testdata event-chain tests — EPCIS 2.0 shape rules + the unsigned UNTP envelope
// (Apache-2.0, (c) Opendpp UAB).
import test from "node:test";
import assert from "node:assert/strict";
import { generateEventChain, generatePassport, sgtinEpc, toUntpEventCredential } from "../src/index.js";

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

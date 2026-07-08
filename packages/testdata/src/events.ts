/**
 * @opendpp/testdata — synthetic EPCIS-shaped event chains.
 *
 * Emits the canonical supply-chain event shape the OpenDPP traceability surface stores
 * (EPCIS 2.0 event types + CBV bizStep/disposition URNs): commissioning of input
 * components → a TransformationEvent into the finished product → packing (aggregation)
 * → shipping. `toUntpEventCredential` wraps one event as the UNSIGNED credential
 * envelope `POST /api/v1/events` expects — the node verifies issuer signatures, so YOU
 * sign it with your issuer key before POSTing; this package never fabricates proofs.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 */
import { createHash } from "node:crypto";
import { makeGtin } from "@opendpp/gs1";
import { makeRng } from "./prng.js";
import { SAMPLE_FACILITIES } from "./categories.js";
import { DEFAULT_SEED } from "./passports.js";
import { sgtinEpc, TESTDATA_GS1_PREFIX } from "./identifiers.js";

export type EpcisEventType = "ObjectEvent" | "AggregationEvent" | "TransformationEvent" | "AssociationEvent";
export type EpcisAction = "ADD" | "OBSERVE" | "DELETE";

/** One synthetic supply-chain event in OpenDPP's canonical EPCIS 2.0-aligned field set. */
export interface EpcisTestEvent {
  eventType: EpcisEventType;
  /** EPCIS 2.0 rule the node enforces at ingest: null on TransformationEvent, set otherwise. */
  action: EpcisAction | null;
  /** CBV business step URN (e.g. urn:epcglobal:cbv:bizstep:commissioning). */
  bizStep: string;
  /** CBV disposition URN (e.g. urn:epcglobal:cbv:disp:active). */
  disposition: string;
  /** "geo:lat,lng" read point. */
  readPoint: string;
  /** Business location identifier. */
  bizLocation: string;
  /** ISO 8601 timestamp. */
  eventTime: string;
  epcList: string[];
  parentEpc?: string;
  childEpcs?: string[];
  inputEpcList?: string[];
  outputEpcList?: string[];
}

export interface GenerateEventChainOptions {
  /** Deterministic seed (default 42). */
  seed?: number | string;
  /** ISO 8601 start of the chain (default "2026-01-15T08:00:00.000Z"); steps advance one day each. */
  baseTime?: string;
  /** 10-digit GS1 company prefix for the synthetic component/pallet EPCs (default TESTDATA_GS1_PREFIX). */
  companyPrefix?: string;
}

const DEFAULT_BASE_TIME = "2026-01-15T08:00:00.000Z";
const bizStep = (step: string): string => `urn:epcglobal:cbv:bizstep:${step}`;
const disp = (d: string): string => `urn:epcglobal:cbv:disp:${d}`;

/**
 * Generates a deterministic 4-event upstream chain for a product: component commissioning →
 * transformation into the product → packing onto a pallet → shipping. Component/pallet GTINs
 * are minted in the 900–999 item-reference block, so they never collide with generated passports.
 */
export function generateEventChain(
  passport: { productId: string },
  opts: GenerateEventChainOptions = {},
): EpcisTestEvent[] {
  const { seed = DEFAULT_SEED, baseTime = DEFAULT_BASE_TIME, companyPrefix = TESTDATA_GS1_PREFIX } = opts;
  const productId = passport.productId;
  if (!/^\d{14}$/.test(productId)) {
    throw new Error(`generateEventChain needs a GTIN-14 productId, got "${productId}".`);
  }
  const base = Date.parse(baseTime);
  if (Number.isNaN(base)) {
    throw new Error(`baseTime must be an ISO 8601 timestamp, got "${baseTime}".`);
  }
  const rng = makeRng(seed, "events", productId);
  const at = (day: number): string => new Date(base + day * 86_400_000).toISOString();

  const site = rng.pick(SAMPLE_FACILITIES);
  const downstream = rng.pick(SAMPLE_FACILITIES);
  const country = site.eori.slice(0, 2);
  const bizLocation = `${country}-SAMPLE-SITE-${rng.int(1, 9)}`;
  const readPoint = `geo:${site.geo}`;

  const componentEpcs = [
    sgtinEpc(makeGtin(`${companyPrefix}${900 + rng.int(0, 44)}`), 1),
    sgtinEpc(makeGtin(`${companyPrefix}${945 + rng.int(0, 44)}`), 1),
  ];
  const productEpc = sgtinEpc(productId, 1);
  const palletEpc = sgtinEpc(makeGtin(`${companyPrefix}999`), rng.int(1, 99));

  return [
    {
      eventType: "ObjectEvent",
      action: "ADD",
      bizStep: bizStep("commissioning"),
      disposition: disp("active"),
      readPoint,
      bizLocation,
      eventTime: at(0),
      epcList: componentEpcs,
    },
    {
      eventType: "TransformationEvent",
      action: null,
      bizStep: bizStep("commissioning"),
      disposition: disp("in_progress"),
      readPoint,
      bizLocation,
      eventTime: at(1),
      epcList: [],
      inputEpcList: componentEpcs,
      outputEpcList: [productEpc],
    },
    {
      eventType: "AggregationEvent",
      action: "ADD",
      bizStep: bizStep("packing"),
      disposition: disp("in_progress"),
      readPoint,
      bizLocation,
      eventTime: at(2),
      epcList: [],
      parentEpc: palletEpc,
      childEpcs: [productEpc],
    },
    {
      eventType: "ObjectEvent",
      action: "OBSERVE",
      bizStep: bizStep("shipping"),
      disposition: disp("in_transit"),
      readPoint: `geo:${downstream.geo}`,
      bizLocation,
      eventTime: at(3),
      epcList: [productEpc],
    },
  ];
}

export interface ToUntpEventCredentialOptions {
  /** did:web (or other DID) of the issuer — defaults to a fictional sample DID. */
  issuerDid?: string;
  /** ISO 8601 issuance date — defaults to the event's own eventTime. */
  issuanceDate?: string;
}

/**
 * Wraps one event as the UNSIGNED credential envelope `POST /api/v1/events` accepts
 * (`credentialSubject` carries the event). Deliberately proof-less: the node verifies the
 * issuer's signature at ingest, so sign this with your own key material before POSTing.
 */
export function toUntpEventCredential(
  event: EpcisTestEvent,
  opts: ToUntpEventCredentialOptions = {},
): Record<string, unknown> {
  const { issuerDid = "did:web:issuer.example.opendpp-node.eu", issuanceDate = event.eventTime } = opts;
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "DigitalTraceabilityEvent"],
    issuer: issuerDid,
    issuanceDate,
    credentialSubject: { ...event },
  };
}

/** GS1 EPCIS 2.0 JSON-LD context — the `@context` value `POST /api/v1/events/epcis` expects. */
export const EPCIS_CONTEXT = "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld";

/** A conformant EPCIS 2.0 document envelope (validates against the official GS1 EPCIS 2.0 JSON Schema). */
export interface EpcisDocument {
  "@context": string[];
  type: "EPCISDocument";
  schemaVersion: "2.0";
  creationDate: string;
  epcisBody: { eventList: Record<string, unknown>[] };
}

/** Whether a string already carries a URI scheme (RFC 3986 `scheme:`). */
const hasUriScheme = (value: string): boolean => /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);

/** CBV URN → the official short name the schema requires (`urn:epcglobal:cbv:bizstep:commissioning`
 *  → `commissioning`); a non-CBV custom URI passes through unchanged (the standard's extension point). */
const cbvShortName = (urn: string): string =>
  urn.match(/^urn:epcglobal:cbv:(?:bizstep|disp):(.+)$/)?.[1] ?? urn;

/** A location string → its `{id}` URI form; a non-URI value is wrapped in the node's location URN
 *  (mirrors the hosted node's own emit path, so a captured location round-trips identically). */
const locationUri = (value: string): string =>
  hasUriScheme(value) ? value : `urn:opendpp:location:${value}`;

/**
 * Deterministic, content-addressed `eventID` so re-capturing the SAME event is idempotent
 * (the node stores it as the capture identity). Content-derived, NOT positional, so an event
 * keeps its id regardless of how chains are combined into a document.
 */
const eventId = (e: EpcisTestEvent): string => {
  const canonical = JSON.stringify([
    e.eventType,
    e.eventTime,
    e.epcList,
    e.parentEpc ?? null,
    e.childEpcs ?? null,
    e.inputEpcList ?? null,
    e.outputEpcList ?? null,
  ]);
  return `urn:opendpp:testdata:event:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
};

/** Projects one synthetic event into an official-schema EPCIS 2.0 JSON event. */
function toEpcisEvent(e: EpcisTestEvent): Record<string, unknown> {
  const event: Record<string, unknown> = {
    eventID: eventId(e),
    type: e.eventType,
    eventTime: e.eventTime,
    eventTimeZoneOffset: "+00:00",
  };
  // EPCIS 2.0: a TransformationEvent takes NO action; every other supported type requires one.
  if (e.eventType !== "TransformationEvent" && e.action) event.action = e.action;
  event.bizStep = cbvShortName(e.bizStep);
  event.disposition = cbvShortName(e.disposition);
  event.readPoint = { id: locationUri(e.readPoint) };
  event.bizLocation = { id: locationUri(e.bizLocation) };
  // Each EPC-list field is valid ONLY on its type-correct event under the official schema — an
  // epcList on an AggregationEvent is a propertyNames violation that fails the WHOLE document — so
  // gate each field to its home: ObjectEvent→epcList, Agg/Assoc→parentID+childEPCs, Transformation
  // →inputEPCList+outputEPCList. (Note the EPCIS 2.0 JSON casing: childEPCs, parentID, *EPCList.)
  const isAggOrAssoc = e.eventType === "AggregationEvent" || e.eventType === "AssociationEvent";
  if (e.eventType === "ObjectEvent") event.epcList = e.epcList;
  if (isAggOrAssoc && e.parentEpc) event.parentID = e.parentEpc;
  if (isAggOrAssoc && e.childEpcs && e.childEpcs.length > 0) event.childEPCs = e.childEpcs;
  if (e.eventType === "TransformationEvent" && e.inputEpcList && e.inputEpcList.length > 0) event.inputEPCList = e.inputEpcList;
  if (e.eventType === "TransformationEvent" && e.outputEpcList && e.outputEpcList.length > 0) event.outputEPCList = e.outputEpcList;
  return event;
}

/**
 * Wraps a generated event chain (or several chains, flattened) as a conformant EPCIS 2.0 document
 * — the shape `POST /api/v1/events/epcis` captures natively (#472). It maps CBV URNs → the official
 * short names the schema demands, wraps non-URI locations as `{id}` URIs, and content-addresses each
 * `eventID` so re-capture is idempotent.
 *
 * `creationDate` is derived from the LATEST `eventTime` — a stable function of the data, not the wall
 * clock — so the same chain always emits byte-identical bytes (deterministic, like the rest of the
 * package). Complements `toUntpEventCredential`, which targets the per-event `POST /api/v1/events`.
 */
export function toEpcisDocument(events: EpcisTestEvent[]): EpcisDocument {
  const eventList = events.map(toEpcisEvent);
  const times = events.map((e) => Date.parse(e.eventTime)).filter((t) => !Number.isNaN(t));
  const creationDate = times.length ? new Date(Math.max(...times)).toISOString() : "1970-01-01T00:00:00.000Z";
  return {
    "@context": [EPCIS_CONTEXT],
    type: "EPCISDocument",
    schemaVersion: "2.0",
    creationDate,
    epcisBody: { eventList },
  };
}

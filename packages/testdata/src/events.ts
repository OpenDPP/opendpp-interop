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

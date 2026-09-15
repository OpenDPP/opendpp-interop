<!-- Copyright (c) Opendpp UAB. SPDX-License-Identifier: Apache-2.0 -->

# Conformance

What OpenDPP's interoperability output conforms to, how to verify each claim yourself, and — just as
importantly — what we **don't** claim. Everything marked ✅ is **live on the public API**
(<https://opendpp-node.eu>) and reproducible from the [`samples/`](./samples/) in this repo using the
[`validate/`](./validate/) tool and standard JOSE/WebCrypto.

Legend: ✅ Conform · 🟡 Partial · 🗺 Roadmap.

## AAS / IDTA (`application/aas+json`)

| Capability | Status | How to verify |
| --- | --- | --- |
| AAS v3.0/3.1 Environment + AASX package | ✅ | `node validate/validate.mjs aas samples/battery-aas-environment.json`; the schema is the official IDTA AAS **metamodel 3.1** JSON Schema (`aas-specs` v3.1.2, IDTA-01001-3-1; `schemas/aas-v3.schema.json`). Live: `GET /passport/{id}` with `Accept: application/aas+json`. |
| `aas-test-engines` (IDTA gold standard) | ✅ | **all 9 per-category** AAS samples (`samples/*.aasx`) pass the official Python `aas-test-engines` validator — the IDTA `aas-test-engines` **3.0** metamodel gold standard (latest 1.0.3 — no 3.1 test cases yet) — in OpenDPP's backend CI; the kit CI JSON-Schema-validates each (extracts `aasx/data/environment.json`). |
| Per-category submodel views | ✅ | additive PUBLIC-tier submodel views over the authoritative compliance metadata, one set per category — **now bundled as one `.aasx` per ESPR category** (`samples/{aluminium,battery,chemicals,construction,cosmetics,electronics,iron-steel,textiles,toys}.aasx`; the battery carries `BatteryCharacteristics` + `CarbonFootprint`, others add e.g. `TechnicalData`). |
| IDTA submodel-template **identity** (`semanticId` provenance) | ✅ | `node validate/validate.mjs semanticids samples/battery-aas-environment.json` — every IDTA-namespace `semanticId` is matched against the published [IDTA Submodel-Template registry](https://github.com/admin-shell-io/submodel-templates) via the vendored CC-BY allowlist [`idta-semantic-ids.json`](./idta-semantic-ids.json) (pinned ref `784d22e`). CarbonFootprint (IDTA 02023) classifies `real-idta-published`; everything OpenDPP coins is an explicit `urn:opendpp:concept:*` / `urn:opendpp:submodel:*` (`vendor-coined`); genuine eCl@ss property IRDIs are `eclass`. Verifies semanticId **identity** (the id is the authentic IDTA template id), **not** structural conformance to the template. TechnicalData (IDTA 02003-1-2) is `real-idta-published` on a still-valid older version — a newer major (v2.0.1) exists which moved to an eCl@ss IRDI, so OpenDPP deliberately keeps the `/1/2` IRI. |

## UNTP + W3C Verifiable Credentials

| Capability | Status | How to verify |
| --- | --- | --- |
| Enveloping JOSE proof (`vc+jwt`, ES256) | ✅ | `node validate/validate.mjs untp samples/battery-vc-credential.json`; `samples/battery-vc.jwt` verifies as a W3C VC-JOSE-COSE credential against the bundled `did.json`. Live: `GET /passport/{id}` with `Accept: application/vc+jwt`. |
| `did:web` issuer (resolvable key) | ✅ | `GET /tenants/{tenantId}/did.json` resolves the public key that verifies the `vc+jwt` (`samples/battery-issuer-did.json`). |
| `did:web` key rotation (multi-key) | ✅ | retired keys are retained under stable `#key-<index>` ids, so credentials signed before a rotation still verify. |
| Issuer legal-name binding | ✅ | the issuing tenant's legal name is the single source for the DID document `name`, every `issuer.name`, and the status list. |
| Conformant verifier path | ✅ | resolve `did:web` → verify the JWS → check issuer binding → validate against the UNTP schema. Reproducible with standard JOSE; no OpenDPP code. |
| Independent cross-implementation verification | ✅ | the samples verify under independent, off-the-shelf libraries (Node WebCrypto / JOSE; `@digitalbazaar` for the Data Integrity form) — never a self-round-trip. |
| Revocation — W3C Bitstring Status List | ✅ | `GET /tenants/{tenantId}/status/revocation` returns a signed status-list credential; `credentialStatus` in each credential points into it. |
| Per-unit (item-granularity) credential | ✅ | an individual serialised battery issues its own credential (`idGranularity:"item"`, the real GS1 AI-21 serial as `itemNumber`), with its own disjoint revocation bit. Live: `GET /unit/{id}`. Samples: `battery-unit-vc-*`. |
| Embedded Data Integrity (`ecdsa-jcs-2019`) | ✅ | the optional second serialization alongside the JOSE envelope — `GET /passport/{id}` (and `/unit/{id}`) with `Accept: application/vc+ld+json`. RFC 8785 JCS + multibase base58btc `proofValue`; independently verified by `@digitalbazaar/ecdsa-jcs-2019-cryptosuite`. Samples: `battery-vc-di.jsonld`, `battery-unit-vc-di.jsonld`. |
| Public-tier disclosure (no privileged data in the VC) | ✅ | both projections derive from one tier-masking seam; privileged/restricted metadata never enters a public credential. |
| Product-category coverage | 🟡 Partial | a per-category **typed-mapping registry** lifts a category's public fields into TYPED UNTP slots (`materialProvenance`, `performanceClaim`) instead of the `characteristics` open bag. **Textiles** is the first fully-typed non-battery category (fiber composition → typed `materialProvenance`; recycled content → a self-declared circularity `performanceClaim`). Batteries + the remaining categories still ride `characteristics` until mapped. Samples: `textile-vc-*`. |
| Cryptographic selective disclosure (SD-JWT-VC) | ✅ | conformant IETF **SD-JWT-VC** (`iss` + `vct`, media type `application/dc+sd-jwt`; legacy `vc+sd-jwt` accepted) — `GET /passport/{id}` (+ the GS1 resolvers) with `Accept: application/dc+sd-jwt`. The issuer serves the full SD-JWT; a **holder presents any subset** of `credentialSubject` claims by dropping disclosures and it still verifies. `node validate/validate.mjs sdjwt samples/battery-vc.sdjwt` decodes it, reconstructs the disclosures (rejecting forged/duplicate ones), and verifies the ES256 signature against the bundled `did.json`; `samples/battery-vc-presented.sdjwt` is a 2-of-4 holder presentation. Samples: `battery-vc.sdjwt`, `battery-vc-presented.sdjwt` (backend #118). |
| Native GS1 EPCIS 2.0 traceability document I/O | ✅ *(capture/emit; JSON binding)* | since API contract **1.9.0** the node captures a native `EPCISDocument` (`POST /api/v1/events/epcis`) and emits a lineage walk as one (`GET /api/v1/events/{id}/lineage` + `Accept: application/ld+json`) — both validated against the OFFICIAL GS1 EPCIS **2.0.1** JSON Schema, vendored here verbatim ([`schemas/epcis-2.0.1.schema.json`](./schemas/epcis-2.0.1.schema.json)). `node validate/validate.mjs epcis samples/epcis-document.json` validates YOUR documents against the same schema, offline. Note the standard's own rules: CBV **short names** (`commissioning`) — the legacy `urn:epcglobal:cbv:*` URN form is REJECTED by the official schema; `@context`/`creationDate` required; no `action` on `TransformationEvent`. The standard's query interface, the XML binding, and `TransactionEvent` persistence are NOT implemented (explicit non-claims). No GS1 endorsement or certification is claimed (backend #472). |
| Conformant Data Integrity proof required on traceability-event ingest | ✅ *(ingest gate; JSON binding)* | since API contract **1.10.0** `POST /api/v1/events` REQUIRES the submitted credential's `proof` to be a W3C `DataIntegrityProof` with `cryptosuite: "ecdsa-jcs-2019"` (RFC 8785 JCS canonicalization, multibase base58btc `proofValue`); the legacy key-sorted `MerkleTreeAttestationProof` is rejected, and the signer key resolves by the tenant's unique `did:web` subdomain against the authoritative vault keys — so the persisted `isUntpCompliant: true` is honest and independently verifiable. Enforced by the backend gate (OpenDPP #478). No events-credential sample ships in the kit yet — verify against the live endpoint (as the EPCIS row does). |
| BBS+ zero-knowledge selective disclosure | 🗺 Roadmap | deferred — SD-JWT-VC reuses the ES256 trust stack; BBS+ needs a separate BLS12-381 key type. |
| `did:webvh` (web + verifiable history) | 🗺 Roadmap | deferred — `did:web` + key rotation suffices now. |

## GS1 Digital Link

The identity / addressing layer for both doors. Every Digital Link OpenDPP **emits or accepts**
(resolution, ingest, and the `POST /api/v1/gs1/decode` endpoint) is parsed by GS1's own
conformance-tested **Barcode Syntax Engine** (the official `gs1encoder`) — never a hand-rolled regex.

| Capability | Status | How to verify |
| --- | --- | --- |
| Conformant Digital Link emission (SKU `/01/{gtin}` · `/8003/{grai}` · unit `/01/{gtin}/21/{serial}`) | ✅ | `node validate/validate.mjs gs1 samples/gs1-digital-link.txt` — GS1's engine accepts the bare-key SKU/GRAI links and the unit link (real physical serial in AI-21). A bad GTIN check digit, an over-long AI-21 serial (> 20 chars), or AI-21 under a GRAI is **rejected** (the kit's CI runs that negative control). Live: the `GET /01/{gtin14}` and `GET /8003/{grai}` resolvers. |
| Scan-data / element-string decode | ✅ | `POST /api/v1/gs1/decode` decodes AIM-prefixed scan data, bracketed element strings, and Digital Links into structured AIs + the Human-Readable Interpretation + a resolvable link, via GS1's engine. |
| Human-Readable Interpretation (HRI) labels | ✅ | `GET /api/v1/passports/{id}/qr?hri=1&format=svg` renders the print-grade GS1 label — the QR plus the engine's HRI text beneath it. |

## EN 182xx harmonised DPP standards

The six CEN/CLC JTC 24 standards cited in the *Official Journal* by Commission Implementing Decision
(EU) 2026/1736. Rows say what OpenDPP **emits or accepts** and cite the clause so a reader holding the
standard can check it; the standards are paid documents and their text is not reproduced here.

> **Read a ✅ as "aligned with", never as conformity.** Any presumption of conformity is scoped by
> each standard's own **Annex ZA** — which reaches specific clauses, not the standard as a whole — and
> holds only while the reference stays in the OJEU list. Conformity is a determination for the
> economic operator and the competent authority, against a product-group act. Check the annex and the
> current listing rather than this table.

| Capability | Status | How to verify |
|---|---|---|
| **EN 18223** — the passport document: Table 1 header, clause 5.2 compressed form, Annex A expanded form (OpenDPP-authored schemas, non-normative) | ✅ | `node validate/validate.mjs en18223 samples/battery-passport.jsonld` and `… en18223-expanded samples/battery-passport-expanded.jsonld`. The node validates every served document — passport × tiers, unit, tombstone, expanded — against the same two schemas. The standard ships no JSON Schema; these are OpenDPP's reading of it (`schemas/README.md`). |
| **EN 18223** — document references (clause 4.1.2.7) and language-dependent text (4.1.2.8) | ✅ | both shapes appear in `samples/battery-passport.jsonld` and are enforced by the `en18223` door. A document reference is https with an IANA-registered media type; a translated text carries its language tag. |
| **EN 18223** — the passport instance identifier is distinct from the product identifier (4.1.2.1) | ✅ | in `samples/battery-passport.jsonld`, `digitalProductPassportId` is the node's own passport URL and `uniqueProductIdentifier` the product's Digital Link. They are different values on purpose. |
| **EN 18219** — the economic operator is identified under a clause 6 scheme, with the EORI beside it | ✅ | `samples/battery-registry-pointer-model.json` → `reoId`; the schemes are `VAT \| DUNS \| LEI \| GLN` and an undeclared operator is refused. See README → registry pointer. |
| **EN 18219** — a product without a GS1 key is issued an EN IEC 61406 Identification Link (Scheme 2) | ✅ | `GET /passport/{id}?.P={productId}` resolves such a passport; a GS1-keyed one resolves at `/01/{gtin}`. Both forms are emitted by the same seam. |
| **EN 18220** — the operator's physical carrier declaration | ✅ *(recorded, not produced)* | the declaration is accepted, stored and versioned with the passport: symbology, placement, X dimension, error-correction level, target environment, print-quality grade, durability. **OpenDPP encodes QR only** — a declaration naming another symbology is kept as the operator's record and answered with a QR, with a `CARRIER_SYMBOLOGY_NOT_RENDERED` advisory saying so. |
| **EN 18221** — a passport's archived versions are readable, including at a point in time | ✅ | three `passport:read` routes; an archived version is served as a DPP and carries the hash that lets a reader verify it. |
| **EN 18222** — API conduct on the resolution surface | 🟡 Partial | served: `405` with `Allow`, `Link` headers, an RFC 9264 linkset, `/.well-known/gs1resolver`, refusal of a key qualifier the node does not model, https-only webhook targets. **Not served: the clause 8 `v1/dpps…` resource paths.** A client written to clause 8 will not find them. |
| **EN 18216** — HTTPS transport and a JSON representation of every exposed resource | 🟡 Partial | HTTP/2 is served and TLS is terminated at the edge; **HTTP/1.1 is still offered and HTTP/3 is not**, both recorded as declared deviations. |

## CIRPASS-2 reference-precursor ecosystem (non-normative)

The EU ESPR Art. 13 registry is a **decentralised pointer index**: it holds a thin pointer per
product (identifiers + retrieval URLs), not the passport. The Commission's production registry is now
**live** (battery registration pending its semantic catalogue); **CIRPASS-2 is the non-normative
reference *precursor*** of that ecosystem (registry, extractor, viewer). OpenDPP projects each
passport / unit into the pointer and exercises the CIRPASS-2 reference implementation until the
projection re-pins to the official record shape. See the caveat below.

| Capability | Status | Evidence |
| --- | --- | --- |
| Pointer validates against the CIRPASS-2 registry `default-schema.json` (draft-2020-12) | ✅ | `node validate/validate.mjs registry samples/battery-registry-pointer-model.json` (and `…-item.json`) passes against the vendored `schemas/cirpass2-eu-registry-pointer.schema.json`; the backend gate is `tests/functional/interop-kit.test.ts`. |
| Registers in the CIRPASS-2 *reference* registry (`mock-eu-registry` `POST /metadata/v1`) and receives a verifiable Proof-of-Registration (RS256/JWKS) | ✅ *(dated; standing check is hermetic)* | verified live end-to-end against the reference stack, once. The live harness was retired on 2026-09-09; the standing check is `tests/functional/eu-registry-service.test.ts`, which runs the POST shape against a loopback mock and verifies an RS256 proof against a served JWKS, rejecting both a `registryId` mismatch and a signature outside the key set. The Proof JWT is *received from the reference registry*, **never** OpenDPP-issued or EU-official. The record shape is the PILOT's — EN 18222 clause 7.1 defines a different registry entry. |
| Discovery search-key coverage — 6 of 14 (`dpp-data-extractor`) | 🟡 Partial | the coverage table in [README → search-keys](./README.md#opendpp--cirpass-2-eu-registry-pointer-espr-art-13) + the backend offline extractor port `tests/functional/aas-cirpass-discoverability.test.ts`, which ports the extractor's matcher faithfully and runs hermetically in CI. (A live capabilities check ran until the harness was retired on 2026-09-09; it exercised the extractor's own endpoint rather than OpenDPP code.) |
| Renders in the CIRPASS-2 *reference* viewer (`dpp-renderer-be`) via OpenDPP JSON-LD | ✅ | **Verified live (2026-06-30):** the real `dpp-renderer-be` **1.0.2** (`GET /fetch/v1?url=`) fetched a live prod OpenDPP passport, Jena-parsed it, and Titanium-JSON-LD-**expanded** it → HTTP 200, 30 expanded RDF nodes, **no "Failed to expand JSON-LD"**; every predicate + `@type` IRI resolved under `opendpp-node.eu` (`/ns/dpp#` + `/contexts/dpp/v1#`; `xsd#` only on datatypes). Evidence: [`samples/cirpass2-renderer-expanded.json`](./samples/cirpass2-renderer-expanded.json). The same RDF-expandability is also **guarded hermetically in CI** (backend `tests/functional/jsonld-expand.test.ts`, OpenDPP #174). **Vocabulary stance: Option B** — OpenDPP stays on its own `opendpp-node.eu/ns/dpp#` vocab (the renderer's `unknownOntology` heuristic) and does **not** adopt the non-normative TalTech EUDPP vocab. **Viewer interop only** (the renderer ignores AAS/VC); *reference renderer*, **never** *certified*. |
| OpenDPP JSON-LD validates against OpenDPP's authoritative SHACL shapes (non-normative, starter) | ✅ | `node validate/validate.mjs shacl samples/battery-passport.jsonld` validates the public `application/ld+json` passport against OpenDPP's OWN SHACL shapes ([`shapes/opendpp-dpp-shapes.ttl`](./shapes/opendpp-dpp-shapes.ttl)). **OpenDPP-authored, NON-NORMATIVE** — a starter set offered to CIRPASS-2 (filling the `dpp-validator`'s placeholder `example.org` shapes), **NOT** a CIRPASS-2 / EU conformance oracle. CIRPASS-2's own `dpp-validator` is not used as an oracle. |

> **Non-normative caveat.** Every CIRPASS-2 repository is "for exploration … not complete,
> exhaustive, or normative … does not reflect CEN-CENELEC JTC 24." CIRPASS-2 is a **precursor** of the
> live Commission registry, not that registry. OpenDPP claims its pointer is
> **validated against the reference** registry and extractor — **never** *certified*, *compliant*, or
> *EU-official*. The Proof-of-Registration is issued by the *reference* `mock-eu-registry`, not by the
> EU and not by OpenDPP.

## What we do **not** claim

Honesty is part of the contract. OpenDPP does **not**:

- call its **legacy product-passport seal** a "W3C Verifiable Credential." That seal is a vendor
  `MerkleTreeAttestationProof` (an offline-verifiable ECDSA Merkle-root signature); the *conformant*
  VC is the **separate** `vc+jwt` / `vc+ld+json` artifact described above.
- claim "full AAS metamodel support," or present any `urn:opendpp:concept:*` id as eCl@ss.
- claim **structural conformance** to an IDTA submodel template merely because a submodel reuses that
  template's `semanticId`. The `semanticids` check above verifies template **identity** (the id is the
  authentic, registry-pinned IDTA id) — not that the submodel body fills the template's mandated elements.
- present itself as a certified compliance authority. OpenDPP is an ESPR-readiness / interoperability
  node: it produces validator-conformant, independently verifiable output. Regulatory compliance is a
  determination for the operator and the competent authority.

For the **CIRPASS-2** reference ecosystem specifically:

- **Allowed:** "validated against the CIRPASS-2 reference registry & extractor (non-normative)";
  "registers in the CIRPASS-2 *reference* `mock-eu-registry` and receives a verifiable
  Proof-of-Registration".
- **Forbidden:** "CIRPASS-2-certified", "EU-registry-compliant", "EU-official" — CIRPASS-2 is
  non-normative, the registry is a *reference* implementation, and OpenDPP issues none of these
  attestations.
- **SHACL shapes:** [`shapes/opendpp-dpp-shapes.ttl`](./shapes/opendpp-dpp-shapes.ttl) are
  **OpenDPP-authored and NON-NORMATIVE** — a starter set *offered as a contribution* to CIRPASS-2 to
  fill the `dpp-validator`'s placeholder `example.org` shapes. They are **not** accepted, normative, an
  EU / CIRPASS-2 conformance suite, "certified", or "EU-official", and validating against them confers
  no certification.

## Reproduce it

```bash
cd validate && npm install
node validate.mjs aas   ../samples/battery-aas-environment.json
node validate.mjs untp  ../samples/battery-vc-credential.json
```

Then verify a live credential against your own tooling: fetch
`https://opendpp-node.eu/passport/<id>` with the `Accept` header for the door you want, resolve the
issuer `did:web`, and verify the signature. If you find a conformance gap, please open an issue.

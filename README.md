# OpenDPP Interop Boundary Kit

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Conformance](https://img.shields.io/badge/conformance-AAS%20v3.0%20%2B%20UNTP%20DPP%20v0.7.0-brightgreen.svg)](./CONFORMANCE.md)

Everything an integrator needs to **consume, conform to, and validate** OpenDPP's two
interoperability projections — *without access to the product source*: the official schemas,
validated samples, the field mappings, a runnable conformance validator, and the public OpenAPI
contract.

OpenDPP is a B2B Digital Product Passport service for the EU ESPR / battery regulation. It is both a
vertical product **and** an open-interoperability reference: every public passport URL serves
standards-conformant output under HTTP content negotiation. This repo is that contract, in the open.
The product backend is a separate, private repository — you don't need it to integrate.

> **Audience:** system integrators (AAS / IDTA) and developers/agencies (UNTP + W3C Verifiable
> Credentials). The hands-on walkthrough is the live portal at `/app/developers → Integrate`; **this
> repo is the machine-readable contract.**

## The two doors

| Door | Format | How to consume | Conforms to |
| --- | --- | --- | --- |
| **AAS / IDTA** | `application/aas+json` + AASX (OPC/ZIP) | `GET /passport/{id}` (or `/01/{gtin14}`) with `Accept: application/aas+json` | IDTA-01001-3-1 **AAS v3.0** |
| **UNTP + VC** | enveloping **`vc+jwt`** (W3C VC-JOSE-COSE, ES256) — or embedded **`vc+ld+json`** (W3C Data Integrity, `ecdsa-jcs-2019`) | `GET /passport/{id}` (SKU/type) **or** `GET /unit/{id}` (per-unit, item granularity) with `Accept: application/vc+jwt` (or `application/vc+ld+json`); issuer key at `GET /tenants/{tenantId}/did.json`; revocation at `GET /tenants/{tenantId}/status/revocation` | **UNTP DigitalProductPassport v0.7.0**, `did:web`, W3C Bitstring Status List |

The public machine-readable contract for the whole API surface is
[`openapi.json`](./openapi.json) (also live at <https://opendpp-node.eu/openapi.json>). Conformance
status of each capability: **[CONFORMANCE.md](./CONFORMANCE.md)**.

## Quick start — validate your own output

Check an AAS Environment or a UNTP credential **you** produce against the official schemas, offline:

```bash
cd validate
npm install                       # ajv + ajv-formats only — no OpenDPP code

node validate.mjs aas         ../samples/battery-aas-environment.json
node validate.mjs untp        ../samples/battery-vc-credential.json
node validate.mjs semanticids ../samples/battery-aas-environment.json        # IDTA template-identity check
node validate.mjs registry    ../samples/battery-registry-pointer-model.json # CIRPASS-2 EU-registry (NON-NORMATIVE)
node validate.mjs shacl       ../samples/battery-passport.jsonld             # OpenDPP SHACL shapes (NON-NORMATIVE)
```

Exit `0` = conformant · `1` = schema errors (printed) · `2` = usage error. See
[`validate/`](./validate/).

## What's in here

```
opendpp-interop/
├── openapi.json            the public API contract (curated integration surface)
├── CONFORMANCE.md          per-capability conformance matrix + how to verify each
├── idta-semantic-ids.json  CC-BY IDTA submodel-template semanticId allowlist (identity checks)
├── schemas/                the official / reference JSON Schemas OpenDPP's CI validates against (vendored)
│   ├── aas-v3.schema.json
│   ├── untp-dpp-v0.7.0.schema.json
│   └── cirpass2-eu-registry-pointer.schema.json   (CIRPASS-2, NON-NORMATIVE)
├── shapes/                 OpenDPP-authored SHACL shapes (NON-NORMATIVE) for the DPP / battery vertical
│   └── opendpp-dpp-shapes.ttl
├── samples/                validated reference artifacts (one battery, both doors + the EU-registry pointer + the JSON-LD passport)
│   └── battery-passport.jsonld   the public application/ld+json passport (validated by the `shacl` door)
└── validate/               the offline conformance validator (validate.mjs: aas · untp · semanticids · registry · shacl)
```

## Official schemas (vendored)

The exact schemas OpenDPP's own CI validates against, copied verbatim (upstream is authoritative —
see [`schemas/README.md`](./schemas/README.md) and [`NOTICE`](./NOTICE)):

- **AAS v3.0** — [`schemas/aas-v3.schema.json`](./schemas/aas-v3.schema.json) (official
  IDTA-01001-3-1, JSON Schema draft-2019-09).
- **UNTP DPP v0.7.0** — [`schemas/untp-dpp-v0.7.0.schema.json`](./schemas/untp-dpp-v0.7.0.schema.json)
  (draft-2020-12).
- **CIRPASS-2 EU-registry pointer** *(NON-NORMATIVE)* —
  [`schemas/cirpass2-eu-registry-pointer.schema.json`](./schemas/cirpass2-eu-registry-pointer.schema.json)
  (the CIRPASS-2 `mock-eu-registry` `default-schema.json`, draft-2020-12, pinned commit `b383c4d`).

## SHACL shapes (battery/ESPR)

[`shapes/opendpp-dpp-shapes.ttl`](./shapes/opendpp-dpp-shapes.ttl) is an **OpenDPP-authored,
NON-NORMATIVE** SHACL shapes set for the DPP / battery (ESPR) vertical. It validates OpenDPP's public
`application/ld+json` passport (the JSON-LD door, e.g. `GET /passport/{id}` with
`Accept: application/ld+json`) against shapes that target OpenDPP's real DPP vocabulary
(`https://opendpp-node.eu/ns/dpp#` + `https://opendpp-node.eu/contexts/dpp/v1#`): the lifecycle
`status`, the responsible `economicOperator`, the `manufacturingFacility`, and the battery metadata
block (category, battery category, rated capacity, carbon footprint, durability, material composition).
It is a reasonable **starter** set — not an exhaustive ESPR-battery rulebook.

It exists to **fill the gap left by the CIRPASS-2 `dpp-validator`**, which ships placeholder
`example.org` SHACL shapes. CIRPASS-2's own validator is **not** used as an oracle.

Validate the bundled JSON-LD passport (offline — the loader stubs the remote `@context` URL, so
expansion uses the inline context with no network):

```bash
node validate/validate.mjs shacl samples/battery-passport.jsonld
```

Exit `0` = conforms · `1` = shape violations (printed per-violation). The shapes are designed against
the actual RDF the sample expands to, so the bundled passport **conforms**.

> **Intent to offer upstream.** These shapes are offered as a starter contribution to CIRPASS-2 — they
> are **NOT** accepted, normative, an EU / CIRPASS-2 conformance suite, "certified", or "EU-official".
> They are OpenDPP's own content (Apache-2.0), unlike the vendored third-party schemas. See
> [CONFORMANCE.md](./CONFORMANCE.md) and [NOTICE](./NOTICE).

## Validated samples

Reference artifacts in [`samples/`](./samples/) — one fictional battery, described both ways. These
are **real, live outputs** fetched verbatim from the demo service (type passport `…/01/09501101532007`,
unit `VM-LFP100-2026-000001`), so you can **reproduce and verify every one** against the live API (each
`samples/*-VALIDATION.md` has the `curl`). Synthetic demo data — see [`NOTICE`](./NOTICE):

- `battery-aas-environment.json`, `battery.aasx` — the battery as an AAS v3.0 Environment / AASX package.
- `battery-vc-credential.json` — the UNTP DPP credential (unsigned form, SKU/type, `idGranularity:"model"`).
- `battery-vc.jwt` — the enveloping **`vc+jwt`** (paste into a JOSE debugger).
- `battery-vc-di.jsonld` — the **embedded W3C Data Integrity** form (`ecdsa-jcs-2019`).
- `battery-unit-vc-credential.json`, `battery-unit-vc.jwt`, `battery-unit-vc-di.jsonld` — a **per-unit**
  credential for one serialised battery (item granularity, the real GS1 AI-21 serial as `itemNumber`).
- `battery-issuer-did.json` — the issuer `did:web` document (the verification key).
- `battery-passport.jsonld` — the public `application/ld+json` passport (the JSON-LD door), validated by
  the OpenDPP **SHACL** shapes (`node validate/validate.mjs shacl …`).
- `battery-registry-pointer-model.json`, `battery-registry-pointer-item.json` — the **CIRPASS-2
  EU-registry pointer** (NON-NORMATIVE) for the model and a per-unit item (`node validate/validate.mjs
  registry …`).
- `AAS-VALIDATION.md`, `VC-VALIDATION.md` — how each artifact was validated.

## Verify a signature

Structural validation (above) is separate from **cryptographic** verification. To verify a `vc+jwt`
end-to-end you need no OpenDPP code — just standard WebCrypto / JOSE:

1. Decode the `vc+jwt` (compact JWS); read the `kid` from the protected header.
2. Resolve the issuer DID: `GET /tenants/{tenantId}/did.json` → find the `verificationMethod` whose
   `id` matches the `kid`; read its `publicKeyJwk`.
3. Verify the JWS signature (ES256) with that public key.
4. Check revocation: dereference `credentialStatus` against
   `GET /tenants/{tenantId}/status/revocation` (a signed W3C Bitstring Status List).

For the embedded `vc+ld+json` form, verify the `DataIntegrityProof` per the W3C `ecdsa-jcs-2019`
cryptosuite (RFC 8785 JCS canonicalization → ECDSA P-256 over `SHA-256(proofOptions) ‖ SHA-256(doc)`
→ multibase base58btc `proofValue`); off-the-shelf libraries
(e.g. `@digitalbazaar/ecdsa-jcs-2019-cryptosuite`) verify it directly.

## Field mappings

OpenDPP derives both projections from one canonical passport via a single tier-masking seam, so they
never drift. **Only PUBLIC-tier data enters either projection** — privileged/restricted metadata never
does.

- **AAS:** General Product Information, ComplianceMetadata, per-category submodel views, and the eIDAS
  seal submodel. Concepts OpenDPP coins are honestly `urn:opendpp:concept:*` — **never** presented as
  eCl@ss. Submodel `semanticId`s carry a real IDTA template IRI only where machine-checked against the
  published IDTA registry — verify it yourself with `node validate/validate.mjs semanticids <aas-file>`
  against the CC-BY allowlist [`idta-semantic-ids.json`](./idta-semantic-ids.json) (template **identity**,
  not structural conformance).
- **UNTP:** the passport maps to a `DigitalProductPassport` `credentialSubject`; SKU/type credentials
  are `idGranularity:"model"`, per-unit credentials are `idGranularity:"item"` with the GS1 AI-21
  serial as `itemNumber`, linked back to their type credential.

### OpenDPP → CIRPASS-2 EU-registry pointer (ESPR Art. 13)

A **third, non-normative** mapping: the **registry-side projection**. ESPR Art. 13 anticipates a
decentralised EU registry holding only a thin *pointer* per product — not the passport data, just
enough to find and identify it. OpenDPP projects a passport (or a per-unit `BatteryUnit`) into the
**pointer-only** index record the CIRPASS-2 `mock-eu-registry` reference expects, and validates it
against the vendored
[`cirpass2-eu-registry-pointer.schema.json`](./schemas/cirpass2-eu-registry-pointer.schema.json)
(the registry's `default-schema.json`, draft-2020-12).

> **NON-NORMATIVE.** CIRPASS-2 is an EU-funded *reference* ecosystem for exploration; it is not the
> EU registry, not CEN-CENELEC JTC 24, and confers no certification. OpenDPP claims its pointer
> *validates against the reference* — never "CIRPASS-2-certified" / "EU-registry-compliant" /
> "EU-official". See [CONFORMANCE.md](./CONFORMANCE.md).

**Pointer fields** — the mapping is deterministic; OpenDPP **refuses to register** rather than emit a
placeholder for any required field it cannot honestly source:

| Pointer field | OpenDPP source | Encoding / notes |
| --- | --- | --- |
| `upi` | canonical GS1 Digital Link product key | `https://id.gs1.org/01/<gtin>` for a GTIN-keyed product (or `/8003/<grai>` for a GRAI); the ITEM form appends the real GS1 **AI-21** serial: `…/21/<BatteryUnit.serialNumber>`. |
| `reoId` | `EconomicOperator.regId` namespaced by `regIdScheme` | `<SCHEME>-<regId>`, e.g. `EORI-IT12345678`. Recognised schemes `EORI \| VAT \| DUNS \| LEI \| GLN`; max 50 chars. **Refuses if no `regId`.** |
| `liveURL` | the public resolver | `${BASE_URL}/passport/<id>` (MODEL) or `/unit/<id>` (ITEM) — the same URL the `vc+jwt` / AAS content-negotiation serve. |
| `backupURL` | a **distinct** retrieval URL | the stored GS1 Digital Link (`Passport.digitalLinkUri` / `BatteryUnit.digitalLinkUri`), or `${backupBaseUrl}/…` if configured. **Must differ from `liveURL`.** |
| `commodityCode` | `Passport.metadata.commodityCode` (or `hsCode` / `taricCode` / `hs`) | HS / TARIC code; schema pattern `^[0-9]{4,10}$`. **Refuses to register if absent** — no placeholder. |
| `facilitiesId` | `["GLN-<Facility.gln>"]` | GS1 GLN-13 (mod-10 valid). **Refuses if the passport has no bound `Facility`** — the same non-registrable state that makes the `vc+jwt` / AAS paths return 406; never emits a placeholder GLN. |
| `granularityLevel` | the entity kind | `MODEL` for a SKU/type `Passport`, `ITEM` for a `BatteryUnit`. **`BATCH` is reserved** — OpenDPP has no first-class batch entity yet, so it never emits `BATCH`. |
| `deactivated` *(ITEM only)* | unit lifecycle | `true` when the unit is `RECYCLED` or has `ceasedAt` set (Art. 77(8) cease-to-exist), else `false`. An archived / decommissioned / recycled passport or unit still **resolves** (the persistence duty) — it is never silently dropped from the index. |
| `modelUpi` *(ITEM only)* | the parent type `Passport`'s `upi` | links the item back to its model entry. |
| `batchUpi` *(ITEM only)* | defaults to `modelUpi` | OpenDPP has no batch entity, so the item's batch UPI is its model UPI. |

**Granularity model (MODEL / BATCH / ITEM).** The pointer schema enforces this end-to-end via
conditional `allOf` rules, and OpenDPP honours them exactly:

- **MODEL** — a SKU/type passport. The schema **forbids** `modelUpi` and `batchUpi`; OpenDPP emits
  neither.
- **BATCH** — *reserved, unused.* The schema requires `modelUpi` and forbids `batchUpi`. OpenDPP has
  no first-class batch entity, so it never produces a `BATCH` pointer (it is not faked as a model or
  an item).
- **ITEM** — a serialised `BatteryUnit`. The schema **requires** `deactivated`, `modelUpi`, **and**
  `batchUpi`; OpenDPP supplies all three (with `batchUpi` defaulting to `modelUpi`).

**Discovery search-keys (CIRPASS-2 `dpp-data-extractor`).** The extractor crawls the resolved passport
for **14** search-keys. OpenDPP populates **6 of 14** today; the remaining **8** are roadmap (tracked
by #116 / R7). The 6 are resolved from OpenDPP's **AAS** output: the extractor matches an AAS leaf
`semanticId` by `equalsIgnoreCase || endsWith` against bare eCl@ss IRDIs, and OpenDPP carries exactly
those bare IRDIs on its discoverability-critical leaves (Nameplate `ManufacturerName` /
`ManufacturerProductDesignation`, CarbonFootprint nested `PcfCO2eq` / `ReferenceImpactUnitForCalculation`,
ProductClassifications `ProductClassId` / `ClassificationSystem`) in the OpenDPP emitters
`src/utils/aas-mapper.ts` + `src/utils/aas-category-templates.ts`. (The CIRPASS-2 **viewer**
`dpp-renderer-fe` separately consumes JSON-LD / RDF via an inline `@context` — it reads OpenDPP's
JSON-LD door, **not** its AAS or VC door; OpenDPP's JSON-LD context is built in `src/utils/jsonld.ts`.)

| Search-key | Status | Search-key | Status |
| --- | --- | --- | --- |
| `manufacturerName` | ✅ | `recyclingRate` | 🗺 |
| `productName` | ✅ | `recyclingRateUom` | 🗺 |
| `carbonFootprint` | ✅ | `energyConsumption` | 🗺 |
| `carbonFootprintUom` | ✅ | `energyConsumptionUom` | 🗺 |
| `codeValue` | ✅ | `weight` | 🗺 |
| `codeSet` | ✅ | `weightUom` | 🗺 |
| | | `durability` | 🗺 |
| | | `durabilityUom` | 🗺 |

Legend: ✅ populated today · 🗺 roadmap (#116 / R7).

**Validate it yourself** (offline, no OpenDPP code):

```bash
node validate/validate.mjs registry samples/battery-registry-pointer-model.json
node validate/validate.mjs registry samples/battery-registry-pointer-item.json
```

## Generate a typed SDK

Both projections and the API surface are anchored to the public OpenAPI spec, so any OpenAPI
generator works — no OpenDPP-specific tooling:

```bash
# TypeScript types from the live public spec (no dependency on this repo):
npx openapi-typescript https://opendpp-node.eu/openapi.json -o opendpp.d.ts

# Or a full client in any language via openapi-generator:
npx @openapitools/openapi-generator-cli generate \
  -i https://opendpp-node.eu/openapi.json -g <lang> -o ./opendpp-sdk
```

## Relationship to the product

| | |
| --- | --- |
| **This repo** (`OpenDPP/opendpp-interop`) | the **public** interop boundary — schemas, samples, validator, OpenAPI contract, mappings. Apache-2.0. |
| **Live service** | <https://opendpp-node.eu> — the running passports, resolvers, and `did:web` / status-list endpoints. |
| **Product backend** | a **separate, private** repository. Not required to integrate. |

## License

[Apache-2.0](./LICENSE) for this kit's own content (validator, docs, samples). Vendored third-party
schemas keep their upstream terms — see [`NOTICE`](./NOTICE). Issues and PRs welcome.

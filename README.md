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

node validate.mjs aas   ../samples/battery-aas-environment.json
node validate.mjs untp  ../samples/battery-vc-credential.json
```

Exit `0` = conformant · `1` = schema errors (printed) · `2` = usage error. See
[`validate/`](./validate/).

## What's in here

```
opendpp-interop/
├── openapi.json            the public API contract (curated integration surface)
├── CONFORMANCE.md          per-capability conformance matrix + how to verify each
├── schemas/                the official JSON Schemas OpenDPP's CI validates against (vendored)
│   ├── aas-v3.schema.json
│   └── untp-dpp-v0.7.0.schema.json
├── samples/                validated reference artifacts (one battery, both doors)
└── validate/               the offline conformance validator (validate.mjs)
```

## Official schemas (vendored)

The exact schemas OpenDPP's own CI validates against, copied verbatim (upstream is authoritative —
see [`schemas/README.md`](./schemas/README.md) and [`NOTICE`](./NOTICE)):

- **AAS v3.0** — [`schemas/aas-v3.schema.json`](./schemas/aas-v3.schema.json) (official
  IDTA-01001-3-1, JSON Schema draft-2019-09).
- **UNTP DPP v0.7.0** — [`schemas/untp-dpp-v0.7.0.schema.json`](./schemas/untp-dpp-v0.7.0.schema.json)
  (draft-2020-12).

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
  eCl@ss. `semanticId`s are real IDTA IRIs only where version-verified (CarbonFootprint, TechnicalData).
- **UNTP:** the passport maps to a `DigitalProductPassport` `credentialSubject`; SKU/type credentials
  are `idGranularity:"model"`, per-unit credentials are `idGranularity:"item"` with the GS1 AI-21
  serial as `itemNumber`, linked back to their type credential.

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

# Conformance

What OpenDPP's interoperability output conforms to, how to verify each claim yourself, and — just as
importantly — what we **don't** claim. Everything marked ✅ is **live on the public API**
(<https://opendpp-node.eu>) and reproducible from the [`samples/`](./samples/) in this repo using the
[`validate/`](./validate/) tool and standard JOSE/WebCrypto.

Legend: ✅ Conform · 🟡 Partial · 🗺 Roadmap.

## AAS / IDTA (`application/aas+json`)

| Capability | Status | How to verify |
| --- | --- | --- |
| AAS v3.0 Environment + AASX package | ✅ | `node validate/validate.mjs aas samples/battery-aas-environment.json`; the schema is the official IDTA-01001-3-1 (`schemas/aas-v3.schema.json`). Live: `GET /passport/{id}` with `Accept: application/aas+json`. |
| `aas-test-engines` (IDTA gold standard) | ✅ | the committed AAS sample passes the official Python `aas-test-engines` validator. |
| Per-category submodel views | ✅ | additive PUBLIC-tier submodel views over the authoritative compliance metadata (the bundled battery sample carries `BatteryCharacteristics` + `CarbonFootprint`; other ESPR categories add e.g. `TechnicalData`), one set per category. |
| Honest semantic ids | ✅ | `semanticId`s are real IDTA IRIs **only** where version-verified (CarbonFootprint IDTA 02023 v1.0, TechnicalData 02003-1-2); everything OpenDPP coins is an explicit `urn:opendpp:concept:*` / `urn:opendpp:submodel:*`. |

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
| Product-category coverage | 🟡 Partial | battery-focused mapping (the regulatory wedge); other categories carry under the `characteristics` open extension. |
| Cryptographic selective disclosure (BBS / SD-JWT) | 🗺 Roadmap | not yet implemented; the vendor Merkle scheme covers redaction today. |
| `did:webvh` (web + verifiable history) | 🗺 Roadmap | deferred — `did:web` + key rotation suffices now. |

## What we do **not** claim

Honesty is part of the contract. OpenDPP does **not**:

- call its **legacy product-passport seal** a "W3C Verifiable Credential." That seal is a vendor
  `MerkleTreeAttestationProof` (an offline-verifiable ECDSA Merkle-root signature); the *conformant*
  VC is the **separate** `vc+jwt` / `vc+ld+json` artifact described above.
- claim "full AAS metamodel support," or present any `urn:opendpp:concept:*` id as eCl@ss.
- present itself as a certified compliance authority. OpenDPP is an ESPR-readiness / interoperability
  node: it produces validator-conformant, independently verifiable output. Regulatory compliance is a
  determination for the operator and the competent authority.

## Reproduce it

```bash
cd validate && npm install
node validate.mjs aas   ../samples/battery-aas-environment.json
node validate.mjs untp  ../samples/battery-vc-credential.json
```

Then verify a live credential against your own tooling: fetch
`https://opendpp-node.eu/passport/<id>` with the `Accept` header for the door you want, resolve the
issuer `did:web`, and verify the signature. If you find a conformance gap, please open an issue.

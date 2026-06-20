# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.0 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

_Nothing yet._

## [1.6.0] — API contract 1.6.0 + documentation-completeness additions

Refreshed `openapi.json` to OpenDPP API contract **1.6.0**. The contract gained backward-compatible
documentation of public surface it already served (no endpoint behaviour changed):

- **`GET /contexts/dpp/v1`** — the canonical, resolvable `@vocab`-based JSON-LD context that every
  public passport/unit document references in its `@context` (the one to dereference when expanding
  OpenDPP JSON-LD). `GET /context/v1` is now labelled the secondary fixed term list.
- **`GET /tenants/{tenantId}/did.json`** and **`GET /tenants/{tenantId}/status/revocation`** — the
  issuer `did:web` document (public keys only) and the W3C Bitstring Status List used to verify and
  revocation-check OpenDPP-issued Verifiable Credentials (new "Verifiable Credentials" tag).
- Verifiable-Credential content negotiation (`application/vc+jwt`, `application/vc+ld+json`,
  `application/dc+sd-jwt`) and a structured **`406 Not Acceptable`** are now documented on the
  passport resolvers and the owner-side `GET /api/v1/passports/{id}` alias.
- Description corrections (grants pagination; the `passport.updated` webhook on live passport edits;
  the operator-not-found 404 message).

Additive only — no paths, fields or status codes removed; existing integrations are unaffected. The
vendored standards and the IDTA `semanticId` allowlist are unchanged.

## [1.5.0] — API contract 1.5.0 + SD-JWT-VC selective disclosure

Carries OpenDPP API contract **1.5.0**.

### Added

- **`shapes/opendpp-dpp-shapes.ttl`** — OpenDPP-authored, **NON-NORMATIVE** SHACL starter shapes for the
  DPP / battery (ESPR) vertical, targeting OpenDPP's real public JSON-LD DPP vocabulary
  (`https://opendpp-node.eu/ns/dpp#` + `…/contexts/dpp/v1#`). They fill the gap left by the CIRPASS-2
  `dpp-validator`'s placeholder `example.org` shapes and are offered as a starter contribution to
  CIRPASS-2 — NOT accepted, normative, "certified", or "EU-official". CIRPASS-2's own `dpp-validator` is
  not used as an oracle (#175 R5).
- **`validate/validate.mjs shacl <passport.jsonld>`** — a fifth offline validator door: expands an
  OpenDPP `application/ld+json` passport to RDF (offline — the remote `@context` URL is stubbed so the
  inline context is used, no network) and validates it against the SHACL shapes, printing a per-violation
  report + `✓ CONFORMS` / `✗ NON-CONFORMING` (exit 0 / 1).
- **`samples/battery-passport.jsonld`** — the public `application/ld+json` passport projection of the demo
  battery, which conforms to the new shapes.
- **`samples/textile-vc-credential.json` + `samples/textile-vc.jwt`** — a NON-BATTERY (textiles) UNTP DPP
  credential, the first non-battery sample. It demonstrates OpenDPP's per-category **typed mapping**: fiber
  composition → typed `materialProvenance`, and recycled content → a self-declared circularity
  `performanceClaim` (against an OpenDPP self-declaration criterion, **not** an ESPR/third-party one) —
  instead of the `characteristics` open bag. Live-fetched from the demo service (passport
  `…/01/09501101531000`), schema-valid against UNTP DPP v0.7.0, and signed by the same demo tenant so it
  verifies against the existing `battery-issuer-did.json`. CONFORMANCE.md's product-category row updated
  accordingly (backend #119).
- **`samples/battery-vc.sdjwt` + `samples/battery-vc-presented.sdjwt`** — the demo battery as a conformant
  IETF **SD-JWT-VC** (cryptographic selective disclosure): the issuer's full SD-JWT plus a 2-of-4 **holder
  presentation** (a withheld claim survives only as an opaque `_sd` digest, yet it still verifies). Carries
  the SD-JWT-VC required `iss` + `vct`; media type `application/dc+sd-jwt` (legacy `vc+sd-jwt` accepted).
  Live-fetched from the demo service (`…/01/09501101532007`), verified against the bundled `did.json`.
- **`validate/validate.mjs sdjwt <file.sdjwt>`** — a sixth offline validator door (zero extra deps): decodes
  the SD-JWT-VC, checks the profile (`typ`/`iss`/`vct`), reconstructs disclosures (rejecting forged/duplicate
  ones + an unsupported `_sd_alg`, per IETF SD-JWT §8.1), and verifies the ES256 signature against the
  committed `did:web` document via Node WebCrypto — `✓ VALID` / `✗ NON-CONFORMING` (exit 0 / 1). The
  CONFORMANCE selective-disclosure row flips to ✅ (backend #118).

**API contract bumped 1.4.1 → 1.5.0** — the backend added `application/dc+sd-jwt` as a content type on the
public resolution endpoints (a backward-compatible addition), so `openapi.json` is refreshed to **1.5.0**. The
SHACL shapes, the textile sample, and the SD-JWT-VC door/samples are reference/tooling that ride along with
this release.

## [1.4.1] — API contract 1.4.1 + CIRPASS-2 registry interop

Carries OpenDPP API contract **1.4.1**.

### Changed

- **`openapi.json` refreshed to contract 1.4.1** — synced to the live API: the AAS-environment schema
  descriptions now enumerate the full submodel set (the IDTA Digital Nameplate + the per-category submodel
  views), and the JSON-LD context-endpoint description is corrected. Documentation-only contract change — no
  breaking change.

### Added

- **`idta-semantic-ids.json`** — the authoritative IDTA submodel-template `semanticId` allowlist
  (published/deprecated status + version), derived from
  [admin-shell-io/submodel-templates](https://github.com/admin-shell-io/submodel-templates) (CC-BY-4.0,
  pinned `784d22e`) and kept in lockstep with the OpenDPP backend's machine-checked snapshot.
- **`validate/validate.mjs semanticids <aas-file>`** — an offline `semanticId` classifier
  (`real-idta-published` / `idta-deprecated` / `vendor-coined` / `eclass` / `unknown`), so IDTA
  template **identity** is independently checkable on any AAS output (`--strict` to fail on a deprecated
  or unverified IDTA-namespace id).
- **CONFORMANCE.md** — an "IDTA submodel-template identity" row tied to the new check, plus an explicit
  "identity ≠ structural conformance" honesty bullet.
- **`schemas/cirpass2-eu-registry-pointer.schema.json`** + **`validate/validate.mjs registry <pointer-file>`**
  — the CIRPASS-2 `mock-eu-registry` pointer schema (ESPR Art. 13 index record, JSON Schema draft-2020-12;
  vendored verbatim from `default-schema.json`, pinned `b383c4d`; Apache-2.0, **NON-NORMATIVE**) and a third
  offline validator door, so an OpenDPP → EU-registry pointer is independently checkable (#175).
- **`samples/battery-registry-pointer-model.json`**, **`samples/battery-registry-pointer-item.json`** — the
  MODEL and ITEM pointer projections of the demo battery, both schema-valid.
- **README.md + CONFORMANCE.md** — the OpenDPP → EU-registry-pointer field mapping, the MODEL/BATCH/ITEM
  granularity model, the **6-of-14** `dpp-data-extractor` discovery-key coverage table, and a "CIRPASS-2
  reference ecosystem (non-normative)" conformance block. CIRPASS-2 is **NON-NORMATIVE** — "validated against
  the reference", never "certified" / "EU-official".

(The `semanticids` and CIRPASS-2 items above are reference/tooling — non-contract; this release's contract
change is the `openapi.json` refresh to 1.4.1.)

## [1.4.0] — initial public release

The OpenDPP interoperability boundary, lifted from the product into the open:

- **Schemas** — the official IDTA AAS v3.0 (IDTA-01001-3-1) and UNTP DPP v0.7.0 JSON Schemas (vendored).
- **Samples** — live-reproducible artifacts for one battery: the AAS v3.0 Environment + AASX package,
  the enveloping `vc+jwt`, the embedded `vc+ld+json` (W3C Data Integrity, `ecdsa-jcs-2019`), the
  per-unit (item-granularity) credentials, and the issuer `did:web` document.
- **Validator** — a dependency-light offline conformance validator (`validate/validate.mjs`).
- **Contract** — the curated public `openapi.json`, the conformance matrix (`CONFORMANCE.md`), and the
  AAS + UNTP field mappings (in `README.md`).
- Carries OpenDPP API contract **1.4.0**, which includes the embedded `vc+ld+json` Data Integrity
  representation alongside the enveloping `vc+jwt`, on both `/passport/{id}` and `/unit/{id}`.

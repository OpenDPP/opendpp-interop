# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.0 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

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

No API-contract change — the SHACL shapes + `shacl` door are reference/tooling (non-contract), so
`openapi.json` and the carried API contract version are unchanged.

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

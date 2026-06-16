# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.0 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

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

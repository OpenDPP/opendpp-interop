# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.1 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [1.0.0] — initial release

The OpenDPP interop boundary kit, carrying OpenDPP public API contract **1.0.0** (`openapi.json`).
Contents:

- **Official + reference schemas** (`schemas/`) — IDTA Asset Administration Shell v3.1
  (IDTA-01001-3-1), UNTP DigitalProductPassport v0.7.0 / W3C Verifiable Credentials, and the vendored
  CIRPASS-2 EU-registry pointer schema.
- **Live-reproducible samples** (`samples/`) — the AASX package and the UNTP / W3C-VC credential
  representations (`vc+jwt`, embedded Data Integrity `vc+ld+json`, and SD-JWT-VC) that a verifier can
  re-derive from the live OpenDPP API and check independently.
- **Offline conformance validator** (`validate/`) — `aas · untp · registry · semanticids · shacl · sdjwt`.
- **The CC-BY IDTA `semanticId` allowlist** (`idta-semantic-ids.json`), the field mappings, and
  OpenDPP's **non-normative SHACL shapes** (`shapes/`).

Apache-2.0. The conformance posture is documented in [CONFORMANCE.md](CONFORMANCE.md).

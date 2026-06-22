# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.1 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [1.2.0] — GS1 Digital Link conformance + API contract 1.2.0

Carries OpenDPP public API contract **1.2.0** (`openapi.json`). New:

- **GS1 Digital Link door** (`validate/gs1.mjs`, the `gs1` mode) — validates GS1 Digital Link URIs and
  bracketed AI element strings against GS1's OWN Barcode Syntax Engine (the official `gs1encoder`), the
  same independent-oracle discipline as the AAS / UNTP schema doors. Rejects a bad GTIN check digit, an
  over-long AI-21 serial (> 20 chars), and an invalid key-qualifier sequence (e.g. AI-21 under a GRAI).
  Sample: [`samples/gs1-digital-link.txt`](samples/gs1-digital-link.txt).
- **API contract 1.2.0** — adds `POST /api/v1/gs1/decode` (decode scan-data / element-string / Digital
  Link → AIs + HRI), a `?hri` Human-Readable-Interpretation parameter on the QR exports, and tightens
  the per-unit `serialNumber` to GS1 AI-21's 20-character maximum (`^[A-Za-z0-9._-]{1,20}$`).

Apache-2.0. Conformance posture: [CONFORMANCE.md](CONFORMANCE.md).

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

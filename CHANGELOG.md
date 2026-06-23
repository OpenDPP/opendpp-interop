# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.1 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [1.5.0] — API contract 1.5.0 (ingest-response parity) + per-category AAS sample coverage

Carries OpenDPP public API contract **1.5.0** (`openapi.json`). The change is **ingest-response metadata
only**, so every validator door (`aas` / `untp` / `registry` / `semanticids` / `shacl` / `sdjwt` / `gs1`)
is unchanged — the conformance projections this kit validates are unaffected.

- **API contract 1.5.0** — VC-readiness reporting reaches the remaining ingest paths, for parity with
  `POST /api/v1/passports` (1.4.0): each `POST /api/v1/passports/bulk` `results[]` row and the
  `POST /api/v1/passports/aas/ingest` 201 now carry **`vcReady`** / **`vcReadyReason`**, and the AAS-ingest
  201 also gains a **`warnings[]`** non-GS1 advisory (parity with create / validate-only). All additive
  response fields. The create / validate-only **400** descriptions now also document that a 14-digit
  `productId` failing the GS1 mod-10 check digit is rejected. No request-shape change and no validator change.
- **Samples — per-category AAS coverage** (mirrors OpenDPP backend #114/#115) — the kit now ships one
  AASX package **per ESPR category** (9: aluminium, batteries, chemicals, construction, cosmetics,
  electronics, iron-steel, textiles, toys) instead of battery-only. They use the metamodel 3.0/3.1 common
  subset, so each validates against **both** the official AAS **3.1** JSON Schema (`aas-specs` v3.1.2)
  **and** the IDTA `aas-test-engines` **3.0** metamodel gold standard (latest 1.0.3 — no 3.1 test cases
  yet): the kit CI extracts `aasx/data/environment.json` from every `.aasx` and JSON-Schema-validates it,
  and the gold-standard run is in OpenDPP's backend CI. Content only — no contract or validator-door change.

## [1.4.0] — API contract 1.4.0 (passport create reports VC-readiness)

Carries OpenDPP public API contract **1.4.0** (`openapi.json`). The change is **owner-facing metadata
only**, so every validator door (`aas` / `untp` / `registry` / `semanticids` / `shacl` / `sdjwt` / `gs1`)
is unchanged — the conformance projections this kit validates are unaffected.

- **API contract 1.4.0** — the `POST /api/v1/passports` 201 response gains two fields: **`vcReady`**
  (boolean) and **`vcReadyReason`** (string | null), reporting whether the passport can emit a UNTP
  Verifiable Credential (true only when a manufacturing facility with a country of production is linked;
  a GLN is optional). A soft signal — the passport still publishes/resolves as AAS / JSON-LD / HTML.

## [1.3.0] — API contract 1.3.0 (bulk import: dry-run + upsert)

Carries OpenDPP public API contract **1.3.0** (`openapi.json`). The change is **ingest-side only**, so
every validator door (`aas` / `untp` / `registry` / `semanticids` / `shacl` / `sdjwt` / `gs1`) is
unchanged — the conformance projections this kit validates are unaffected.

- **API contract 1.3.0** — `POST /api/v1/passports/bulk` gains two optional, backward-compatible request
  flags: **`dryRun`** (validate every row and report OK-vs-error **without writing** — HTTP 200, a
  pre-import preview) and **`upsert`** (a row whose `(productId, operator)` already exists **updates** the
  existing passport instead of erroring as a duplicate; a sealed passport is never overwritten). The
  response shape is unchanged.

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

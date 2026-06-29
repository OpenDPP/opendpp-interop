# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.1 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

### Added
- **`samples/cirpass2-renderer-expanded.json`** — the CIRPASS-2 reference renderer's verbatim
  `GET /fetch/v1` output for a live OpenDPP passport: 30 Titanium-JSON-LD-expanded RDF nodes, every
  IRI under `opendpp-node.eu`. The captured viewer-interop evidence (OpenDPP #174).

### Changed
- **CIRPASS-2 reference-viewer row** — flipped from 🗺 Roadmap to ✅. **Verified live (2026-06-30):**
  the real `dpp-renderer-be` 1.0.2 fetched + Jena-parsed + Titanium-expanded a live prod OpenDPP
  passport (HTTP 200, no expansion error). The same RDF-expandability is also guarded hermetically in
  CI (OpenDPP #174). Recorded the **Option B** vocabulary stance (OpenDPP stays on its own vocab; no
  TalTech EUDPP alias). Non-normative throughout — *reference renderer*, never *certified*.
  _(Non-contract docs/sample change — no API-contract version bump.)_

## [1.7.0] — API contract 1.7.0 (programmatic API-write entitlement + bulk label export)

Carries OpenDPP public API contract **1.7.0** (`openapi.json`). Additive (MINOR) — no breaking change.
The contract additions are **API-surface only** (a new billing-`402` discriminator, a new bulk-export
endpoint, and a non-blocking advisory), so every validator door (`aas` / `untp` / `registry` /
`semanticids` / `shacl` / `sdjwt` / `gs1`) is unchanged — the conformance projections this kit validates
are unaffected.

- **Programmatic API-write `402`** — the net-new passport-write surfaces now document a discriminated
  `402` (`code: "api_access_required"` + `upgradeUrl`) on the shared `PaymentRequired` response for an
  API-key write on a tier without API access (OpenDPP #347, Option B).
- **`POST /api/v1/passports/labels`** — bulk QR/label ZIP export (≤200 passports, partial-success
  `manifest.json`, tenant-scoped); the export counterpart to the bulk import (OpenDPP #376).
- **PII-shape advisory** — passport ingest may now add a non-blocking `warnings[]` entry when metadata
  looks like personal data (privacy-by-design, ESPR FAQ Q16; OpenDPP #400).
- **`semanticids` door — new `catena-x` verdict.** The classifier now recognizes a Catena-X / Eclipse
  Tractus-X SAMM aspect-model id (`urn:samm:io.catenax.…`) as a deliberately-referenced identifier
  (CC-BY-4.0, by URN string only — no definitions redistributed) instead of bucketing it as `unknown`.
  Mirrors the OpenDPP backend classifier (lockstep). Scoped to `io.catenax` so other `urn:samm:` ids stay
  `unknown`. Reflects OpenDPP #116 Tier B (recycled-content metals → the generic-DPP scalar `#recycled`).

## [1.6.0] — API contract 1.6.0 (quota enforcement + GS1 & resolution round-out)

Carries OpenDPP public API contract **1.6.0** (`openapi.json`). Additive (MINOR) — no breaking change.
The additions are **API-surface only** (two new endpoints, a discriminated billing-`402`, and a new
per-unit media type), so every validator door (`aas` / `untp` / `registry` / `semanticids` / `shacl` /
`sdjwt` / `gs1`) is unchanged — the conformance projections this kit validates are unaffected.

- **Passport-quota `402`** — `POST /api/v1/passports` (+ `/bulk`, `/aas/ingest`), the `PUT /api/v1/passports/{id}`
  draft→publish transition, and `POST /api/v1/operators/{id}/restore` now document a discriminated `402`
  (`code: "passport_quota_exceeded"` + `quota` + `upgradeUrl`) on the shared `PaymentRequired` response (OpenDPP #280).
- **`POST /api/v1/gs1/decode/batch`** — batch GS1 scan-data / element-string / Digital-Link decode (≤200
  items, per-item partial-success); the single-scan `/gs1/decode` is unchanged (OpenDPP #262).
- **`POST /api/v1/passports/{passportId}/units/validate`** — a non-mutating GS1 / AI-21 unit-identifier
  conformance pre-flight returning per-item verdicts (OpenDPP #263).
- **`GET /unit/{id}` `application/dc+sd-jwt`** — the per-unit SD-JWT-VC representation, reaching parity with
  `GET /passport/{id}` (OpenDPP #251 RE-Q). The kit ships a new **`samples/battery-unit-vc.sdjwt`** (item
  granularity), validated by the `sdjwt` door. The VC demo set re-signs against a fresh issuer key (the demo
  key is ephemeral) so the new per-unit sample shares the issuer `did:web`; the credential JSON payloads are
  unchanged.

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

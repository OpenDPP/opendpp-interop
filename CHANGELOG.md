# Changelog

This kit's version **tracks the OpenDPP API contract version it carries** (`openapi.json`'s
`info.version`) — so "which kit is this?" answers "the contract it documents." Releases are git-tagged
`v<api-contract-version>`. The vendored standards keep their own versions (IDTA AAS v3.1 /
IDTA-01001-3-1; UNTP DPP v0.7.0). Format: [Keep a Changelog](https://keepachangelog.com).

## [1.11.0] — API contract 1.11.0 (client idempotency)

Carries OpenDPP public API contract **1.11.0** (`openapi.json`). A backward-compatible MINOR — no
existing request or response shape changed; the sole machine-contract change is one new optional
request header (below). The vendored standards, schemas, samples and validators are unchanged.

### Added
- **Optional `Idempotency-Key` request header on `POST /api/v1/passports` and
  `POST /api/v1/passports/bulk`** (OpenDPP #502). Retrying a request with the same key replays the
  ORIGINAL response — same status and body, plus an `idempotent-replayed: true` response header —
  instead of performing a duplicate write or returning **409**. Scoped per (workspace, endpoint, key)
  and consulted within a 24-hour window; a malformed key returns **400**. Best-effort: the replay is
  recorded after the write commits, so a rare failure in that window falls back to normal processing
  (a duplicate write is still impossible — the `(productId, operator)` unique key holds).

## [1.10.0] — API contract 1.10.0 (Audit Pass 2: trust-stack + resolver hardening)

Carries OpenDPP public API contract **1.10.0** (`openapi.json`) — trust-stack + resolver hardening from
OpenDPP's Audit Pass 2 (#501). Some changes are behavioural breaks on the `/api/v1` line; consumers on
`POST /api/v1/events` and the content-negotiated resolvers should review the notes below.

### Changed
- **`POST /api/v1/events` now requires a conformant W3C Data Integrity proof (audit I-untp).** The
  credential `proof` MUST be a `DataIntegrityProof` with `cryptosuite: "ecdsa-jcs-2019"` (RFC 8785 JCS,
  multibase base58btc `proofValue`); the legacy key-sorted `MerkleTreeAttestationProof` is rejected. This
  makes the persisted `isUntpCompliant: true` honest / independently verifiable (OpenDPP #478).
- **The public resolvers select a representation by RFC 7231 §5.3.2 `Accept` q-value negotiation.**
  `GET /passport/{id}`, the GS1 Digital Link gateways, `GET /unit/{id}`, the mirror resolver and
  `GET /api/v1/schemas/{category}` honour q-values + media-range specificity instead of a fixed branch
  order — so `Accept: text/html, application/vc+jwt` yields HTML. Absent/bare-wildcard `Accept` still
  defaults to JSON; `Vary: Accept` unchanged (OpenDPP #375).
- **`POST /api/v1/audit/verify` no longer surfaces an untrusted seal certificate (audit H2).** The
  `certificate` report attaches ONLY on a `verified: true` outcome with a trusted chain
  (`chainValid` + `keyMatchesProof`).
- **VC reference samples now carry `credentialSchema`.** Regenerated the VC sample set
  (`samples/battery-vc*.{json,jwt,sdjwt,jsonld}`, `samples/battery-unit-vc*`, `samples/textile-vc*`,
  `samples/battery-issuer-did.json`) so each conformant UNTP DigitalProductPassport credential now
  references the node-hosted UNTP DPP v0.7.0 JSON Schema via `credentialSchema`
  (`{"id": "https://opendpp-node.eu/public/schemas/untp/dpp/0.7.0.json", "type": "JsonSchema"}`) —
  OpenDPP #500 (audit *V-schema*). The field is additive to the VC body.

### Added
- **`timestamp.timeAuthenticated` on `POST /api/v1/audit/verify` (audit TS)** — when the node has a TSA CA
  configured it verifies the RFC 3161 token's CMS signature over its TSTInfo and chains the signer to that
  anchor; `false` (asserted `genTime` unauthenticated) otherwise.
- **Engine-authoritative AI-21 serial conformance for every unit (OpenDPP #370)** — non-GTIN passport unit
  serials are validated through the GS1 Barcode Syntax Engine (CSET-82 + length), not just the URL-safe regex.
- **Machine-stable, self-describing responses (developer experience).** 4xx bodies carry a stable
  `Error.code`; success responses carry coded `warnings[]` / `notices[]` (`AdvisoryItem`: `{code, path?, message,
  friendlyMessage}`, `friendlyMessage` localized via `?lang=`/`Accept-Language`); every response carries an
  `X-Request-Id` header (also `requestId` in generic error bodies) — OpenDPP #501.
- **New contract operations:** bulk VC-readiness report, GS1 GTIN mint affordance for non-GS1 productIds,
  opt-in EORI existence check at operator registration, and a compressed GS1 Digital Link `400` on the resolver
  (OpenDPP #253 / #255 / #404 / #261). The GS1 helper package adds an NFC/NDEF data-carrier helper (#403).

_CONFORMANCE.md: adds one ✅ row — a conformant `DataIntegrityProof` (`ecdsa-jcs-2019`) is now REQUIRED on
`POST /api/v1/events` ingest (#478). The passport-seal `MerkleTreeAttestationProof` caveat and the
roadmap/partial rows (BBS+, `did:webvh`, discovery-key coverage, non-battery category typing) are unchanged._

## [1.9.0] — API contract 1.9.0 (native GS1 EPCIS 2.0 document I/O)

Carries OpenDPP public API contract **1.9.0** (`openapi.json`). Additive (MINOR) — no breaking change.

### Added
- **Native GS1 EPCIS 2.0 document I/O** in the public contract: `POST /api/v1/events/epcis` captures a
  standard `EPCISDocument` (JSON/JSON-LD) with per-event partial success and disclosed `ignoredFields`;
  `GET /api/v1/events/{id}/lineage` content-negotiates `Accept: application/ld+json` into a conformant
  EPCIS document projection of the lineage walk (OpenDPP #472).
- **`schemas/epcis-2.0.1.schema.json`** — the official GS1 EPCIS 2.0.1 JSON Schema, vendored verbatim
  (draft-07; © GS1 AISBL, see NOTICE). The SAME schema the node validates captures against and CI
  validates emitted documents against.
- **`validate.mjs epcis`** — a new validator kind: check YOUR EPCIS documents against the official
  schema, offline. Sample: `samples/epcis-document.json` (a 4-event synthetic chain — commissioning →
  transformation → packing → shipping — under the fictional `0950110154` sample prefix).
- **`publish-testdata.yml`** — keyless-OIDC npm publish workflow for **`@opendpp/testdata`** (the
  deterministic synthetic sample-data generator, OpenDPP #473; first version bootstrapped manually,
  tags take over from 0.1.1).

## [1.8.0] — API contract 1.8.0 (first-class commodityCode + EU trade-identity packages)

Carries OpenDPP public API contract **1.8.0** (`openapi.json`). Additive (MINOR) — no breaking change.

### Added
- **`commodityCode` (HS/TARIC) is now a first-class optional passport-metadata field** in the public
  contract — the registry-pointer field the EU DPP index (ESPR Art. 13 / CIRPASS-2) requires; it flows
  through every ingest path and is advertised on `GET /schemas/{category}` (OpenDPP #435).
- **`publish-eori.yml` + `publish-aeo.yml`** — keyless-OIDC npm publish workflows for the two new EU
  trade-identity client packages **`@opendpp/eori`** (EORI validation vs the EU Commission EOS service)
  and **`@opendpp/aeo`** (Authorised Economic Operator trusted-trader lookup), which mirror into
  `packages/` from opendpp-node (OpenDPP #438 / #440).
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

<!-- Copyright (c) Opendpp UAB. SPDX-License-Identifier: Apache-2.0 -->

<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/vies

EU VAT-number validation against the **European Commission's official VIES
service** — the EU's authoritative cross-border VAT validator — plus pure,
zero-dependency **offline syntax/parsing** helpers (ESM, Node ≥ 26).
From the [OpenDPP](https://opendpp-node.eu) Digital Product Passport service.

> Part of the OpenDPP **open client** surface (Apache-2.0). The hosted node —
> resolver, eIDAS sealing, did:web/status-list issuance, 15-year persistence —
> stays a service you call, not code you run. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

## Why

A VAT identification number is the tax identity of the economic operator
responsible for a product — part of the operator identity a Digital Product
Passport carries. Two checks matter:

1. **Syntax** — cheap, offline: a 2-letter country prefix + 5–12 alphanumerics.
2. **Existence** — authoritative, online: is the VAT number actually registered?
   The single authoritative source is the European Commission's
   [VIES](https://ec.europa.eu/taxation_customs/vies/) (VAT Information Exchange
   System) service. This package speaks to it directly — no third-party
   intermediary.

## Install

```sh
npm install @opendpp/vies
```

## Existence check (online)

```ts
import { checkVatId, isVatRegistered } from "@opendpp/vies";

const result = await checkVatId("IE1234567X");
// {
//   input: "IE1234567X",
//   vatId: "IE1234567X",
//   validSyntax: true,
//   valid: true,                       // VIES confirms the number is registered
//   checked: true,
//   name: "EXAMPLE TRADING LTD",       // only when VIES discloses it ("---" is dropped)
//   address: "1 SAMPLE STREET, DUBLIN",
//   countryCode: "IE",
//   requestDate: "2026-06-30+02:00",
//   statusDescription: "Valid",
//   source: "ec-europa-vies",
//   checkedAt: "2026-06-30T…Z",
// }

await isVatRegistered("IE1234567X"); // true
```

**Syntactically-impossible input is never sent over the wire** — it short-circuits
to `source: "offline-syntax"`, `checked: false`, `valid: false`. Only well-formed
VAT IDs reach the service.

VIES answers **one VAT ID per request**; `checkVatIdBatch(ids)` queries
sequentially (a good citizen against a government endpoint) and de-duplicates
repeats, returning one result per input, in order.

### Injectable transport (SSRF-safe servers)

The package has **zero runtime dependencies** and uses the global `fetch` by
default. A server can inject its own transport (e.g. an SSRF-guarded fetch — the
endpoint host is fixed to `ec.europa.eu`, so pinning is trivial):

```ts
import { checkVatId, type ViesTransport } from "@opendpp/vies";

const guarded: ViesTransport = async (url, req) => {
  const res = await safeFetch(url, { method: req.method, headers: req.headers, body: req.body, signal: req.signal });
  return { status: res.status, text: () => res.text() };
};

await checkVatId("IE1234567X", { transport: guarded, timeoutMs: 10_000 });
```

## Offline syntax & parsing (pure)

```ts
import {
  isValidEuVatId,
  normalizeVatId,
  parseVatId,
  isEuVatPrefix,
  EU_VAT_PREFIXES,
} from "@opendpp/vies";

isValidEuVatId("DE123456789"); // true
isValidEuVatId("EL123456789"); // true  (Greece uses the VAT prefix "EL")
isValidEuVatId("US123456789"); // false (not an EU prefix)

normalizeVatId(" ie 1234 567 x "); // "IE1234567X"

parseVatId("el 123 456 789");
// { input: "el 123 456 789", normalized: "EL123456789", countryCode: "EL", number: "123456789", validSyntax: true }

isEuVatPrefix("EL"); // true — the 27 member-state prefixes VIES recognises live in EU_VAT_PREFIXES
```

## Notes

- This package formats requests to, and parses responses from, the European
  Commission VIES service. Opendpp UAB is not affiliated with, nor endorsed by, the
  European Commission; the service is provided under the Commission's own terms.
- VIES is federated across the national VAT databases, which have **routine
  maintenance windows** — treat the online check as **best-effort**: a
  transport/parse/non-200 outcome throws `ViesServiceError`, and a temporary
  member-state outage is not proof that a VAT number is unregistered.

## The OpenDPP toolkit

Open (Apache-2.0) client libraries for building against the hosted OpenDPP node —
install only the ones you need:

| Package | What it does |
|---|---|
| [`@opendpp/gs1`](https://www.npmjs.com/package/@opendpp/gs1) | GS1 Digital Link URIs + GTIN/GLN/GRAI check-digit validate & mint |
| [`@opendpp/csv`](https://www.npmjs.com/package/@opendpp/csv) | Map spreadsheet / ERP rows to the passport-create shape for bulk import |
| [`@opendpp/testdata`](https://www.npmjs.com/package/@opendpp/testdata) | Deterministic, category-valid sample passports + EPCIS event chains |
| [`@opendpp/webhooks`](https://www.npmjs.com/package/@opendpp/webhooks) | Webhook event types + a constant-time HMAC-SHA256 verifier |
| [`@opendpp/eori`](https://www.npmjs.com/package/@opendpp/eori) | Validate EU EORI numbers against the Commission's EOS service |
| [`@opendpp/aeo`](https://www.npmjs.com/package/@opendpp/aeo) | Look up AEO trusted-trader status against the EOS service |
| [`@opendpp/vies`](https://www.npmjs.com/package/@opendpp/vies) | Validate EU VAT numbers against the Commission's VIES service |
| [`@opendpp/sdk`](https://www.npmjs.com/package/@opendpp/sdk) | Generated TypeScript client for the full public API |

They integrate *with* the hosted node — where passports are validated against ESPR
category rules, cryptographically sealed, resolved via GS1 Digital Link, and kept for
the 15-year retention window. **Start building:**
[opendpp-node.eu](https://opendpp-node.eu) ·
[API reference](https://opendpp-node.eu/api-reference) ·
[developer hub](https://opendpp-node.eu/app/developers).

## License

[Apache-2.0](./LICENSE) © Opendpp UAB. See [`NOTICE`](./NOTICE). "OpenDPP" is a
trademark of Opendpp UAB; this license grants no rights to the marks.

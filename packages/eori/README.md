<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/eori

EORI number validation against the **European Commission's official EOS
validation web service** — the only authoritative validator for EU-issued EORIs —
plus pure, zero-dependency **offline syntax/parsing** helpers (ESM, Node ≥ 26).
From the [OpenDPP](https://opendpp-node.eu) Digital Product Passport service.

> Part of the OpenDPP **open client** surface (Apache-2.0). The hosted node —
> resolver, eIDAS sealing, did:web/status-list issuance, 15-year persistence —
> stays a service you call, not code you run. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

## Why

An EORI (Economic Operators Registration and Identification number) is the EU
customs identifier of the economic operator responsible for a product — exactly
the identity a Digital Product Passport must carry. Two checks matter:

1. **Syntax** — cheap, offline: a 2-letter ISO-3166 country prefix + up to 15
   alphanumerics.
2. **Existence** — authoritative, online: does the operator actually exist in the
   EU register? The single authoritative source is the European Commission's EOS
   service (the machine equivalent of the interactive
   [EORI validation page](https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp)).
   This package speaks to it directly — no third-party intermediary.

## Install

```sh
npm install @opendpp/eori
```

## Authoritative validation (online)

```ts
import { validateEori, validateEoriBatch, isEoriRegistered } from "@opendpp/eori";

const result = await validateEori("IE2025292W");
// {
//   input: "IE2025292W",
//   eori: "IE2025292W",
//   valid: true,            // status === 0
//   validSyntax: true,
//   status: 0,
//   statusDescription: "Valid",
//   name: "EXAMPLE TRADING LTD",   // only when the operator consented to publication
//   address, street, postalCode, city, country,
//   countryScope: "eu",
//   source: "ec-europa-eos",
//   checkedAt: "2026-06-30T…Z",
// }

await isEoriRegistered("IE2025292W"); // true

// Batch is transparently chunked into requests of 10 (the service limit) and
// de-duplicated; results come back one-per-input, in order:
const many = await validateEoriBatch(["IE2025292W", "DE123456789", "GB123456789000"]);
```

**Status semantics** (from the service): `status` `0` = valid (the operator exists
in the register), `1` = not valid. `valid` is derived as `status === 0`; the raw
`status` and `statusDescription` are always surfaced so you are never locked to
that interpretation.

**Syntactically-impossible input is never sent over the wire** — it short-circuits
to `source: "offline-syntax"`, `valid: false`. Only well-formed EORIs reach the
service.

**Scope.** The EU service is authoritative for the 27 EU member states (and XI,
Northern Ireland, under the Windsor Framework). **GB** (Great Britain) numbers live
in the UK register and are validated by **HMRC**, not the EU service — a "not
valid" result for a `GB…` number is flagged via `countryScope` / `countryNote`
rather than taken at face value.

### Injectable transport (SSRF-safe servers)

The package has **zero runtime dependencies** and uses the global `fetch` by
default. A server can inject its own transport (e.g. an SSRF-guarded fetch — the
endpoint host is fixed to `ec.europa.eu`, so pinning is trivial):

```ts
import { validateEori, type EoriTransport } from "@opendpp/eori";

const guarded: EoriTransport = async (url, req) => {
  const res = await safeFetch(url, { method: req.method, headers: req.headers, body: req.body, signal: req.signal });
  return { status: res.status, text: () => res.text() };
};

await validateEori("IE2025292W", { transport: guarded, timeoutMs: 10_000 });
```

Low-level building blocks are exported too — `buildValidateEoriEnvelope(eoris)` and
`parseValidateEoriResponse(xml)` — if you want to drive the SOAP call yourself.

### Rate limiting (respects the EU cap, overridable)

The EOS service caps each source at **10 numbers / request** and **100 requests /
second**. The first is enforced automatically (`validateEoriBatch` chunks + de-dups
to 10). The second is enforced by a process-wide limiter, **on by default at 100/s**
— invisible for normal use (a single call never waits; bursts are spread out).

The EU tech team grants higher/uncapped limits on request, so the rate is fully
overridable — globally or per call:

```ts
import {
  validateEori,
  setDefaultEoriRateLimit,
  createEoriRateLimiter,
} from "@opendpp/eori";

// Global: your process has a higher granted limit (set once at startup)
setDefaultEoriRateLimit(500);   // or null to disable throttling entirely

// Per call: a limiter shared across the calls that may burst (create ONCE, reuse)
const fast = createEoriRateLimiter(500);
await validateEori("IE2025292W", { rateLimiter: fast });

// Opt out for a single call
await validateEori("IE2025292W", { rateLimiter: null });
```

> The cap is **per source**. Across a horizontally scaled service (multiple
> instances) you still want a shared/server-side limiter — the built-in one keeps a
> single process from bursting past the cap.

## Offline syntax & parsing (pure)

```ts
import {
  isValidEoriSyntax,
  validateOperatorRegId,
  normalizeEori,
  parseEori,
  classifyEoriCountry,
  REG_ID_SCHEMES,
} from "@opendpp/eori";

isValidEoriSyntax("DE1234567890"); // true
normalizeEori(" ie 2025 292 w ");  // "IE2025292W"

parseEori("ie2025292w");
// { input: "ie2025292w", normalized: "IE2025292W", countryCode: "IE", identifier: "2025292W", validSyntax: true }

classifyEoriCountry("GB123456789000");
// { countryCode: "GB", scope: "great-britain", euAuthoritative: false, note: "GB … validated by HMRC …" }

// regId / scheme validation used on operator create/update paths (EORI | VAT | DUNS | NATIONAL | OTHER):
validateOperatorRegId("DE1234567890", "EORI"); // null (ok)
validateOperatorRegId("EORI-MOCK-1");          // "Fabricated registration ids (EORI-MOCK…) are not accepted…"
```

## Notes

- This package formats requests to, and parses responses from, the European
  Commission EOS service. Opendpp UAB is not affiliated with, nor endorsed by, the
  European Commission; the service is provided under the Commission's own terms.
- The EOS service caps requests at **10 EORIs / request** and **100 requests /
  second** — both are handled by the package (chunking + a default 100/s limiter);
  see [Rate limiting](#rate-limiting-respects-the-eu-cap-overridable) to raise or
  disable the limit if the EU tech team has granted you a higher one.

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

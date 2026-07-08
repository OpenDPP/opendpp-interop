<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/testdata

Deterministic **synthetic sample-data generator** for the
[OpenDPP](https://opendpp-node.eu) Digital Product Passport API (ESM, Node ≥ 26).
One call (or one `npx`) mints category-valid sample passports — for **every ESPR
category the public contract recognises** — in the exact shape
`POST /api/v1/passports` and `/passports/bulk` accept, plus EPCIS-shaped
supply-chain event chains. No more hand-crafting ESPR payloads to try an
integration.

> Part of the OpenDPP **open client** surface (Apache-2.0). Samples are
> structurally valid against the public per-category schemas
> (`GET /api/v1/schemas/{category}`); the hosted node stays authoritative for
> validation, GS1 check-digit enforcement, operator binding, eIDAS sealing and
> the `vcReady` / `warnings` signals. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

**Synthetic by construction:** fictional operators and facilities marked
`(SAMPLE)`, GTINs minted under a fictional GS1 company prefix (`0950110154`,
valid mod-10 via [`@opendpp/gs1`](https://www.npmjs.com/package/@opendpp/gs1)),
and `example.opendpp-node.eu` URLs. Nothing describes a real product, operator
or facility, and nothing asserts a regulatory status.

## CLI

```sh
npx @opendpp/testdata batteries --count 10                 # POST-ready passport JSON
npx @opendpp/testdata textiles --format csv > textiles.csv # portal-importable CSV
npx @opendpp/testdata batteries --format events            # canonical chains (POST /events)
npx @opendpp/testdata batteries --format epcis             # EPCIS 2.0 document (POST /events/epcis)
npx @opendpp/testdata all --count 2                        # 2 samples of every category
```

Flags: `--count/-c`, `--seed/-s`, `--format/-f json|csv|events|epcis` (`all`
supports `--format json` only), `--prefix` (your own 10-digit GS1 prefix),
`--operator-id`, `--facility-id`, `--help`.

## Library

```ts
import { generatePassports, generateEventChain, passportsToCsv } from "@opendpp/testdata";

// 10 valid battery passports — POST each to /api/v1/passports, or all to /passports/bulk.
const passports = generatePassports({ category: "batteries", count: 10 });

// The same 10 as CSV under the official @opendpp/csv template header.
const csv = passportsToCsv("batteries", passports);

// A 4-event upstream chain (commissioning → transformation → packing → shipping)
// for one product; wrap with toUntpEventCredential() and SIGN it before POSTing
// to /api/v1/events — this package never fabricates proofs.
const events = generateEventChain(passports[0]);

// Or emit the whole chain as one conformant EPCIS 2.0 document (CBV short names,
// content-addressed eventIDs) — POST it as-is to /api/v1/events/epcis.
import { toEpcisDocument } from "@opendpp/testdata";
const epcisDoc = toEpcisDocument(passports.flatMap(generateEventChain));
```

## Determinism

Everything derives from a seed (default `42`): the same `(seed, category, index)`
always yields the same sample, on every machine — reproducible fixtures for test
suites and bug reports. Vary `--seed` for a different (equally reproducible)
dataset. GTIN slots are addressed by `(category, index, prefix)` and stay stable
across seeds; the content varies with the seed.

## Round-trips @opendpp/csv

`passportToCsvRow` is the exact inverse of
[`@opendpp/csv`](https://www.npmjs.com/package/@opendpp/csv)'s
`mapCsvRowToPassport`, guarded by a round-trip test per category — generated CSV
imports losslessly. One caveat: the public CSV templates carry no `productName`
column, so the generated display name is JSON-only.

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

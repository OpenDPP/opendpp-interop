<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/csv

Pure, zero-dependency **CSV → passport** reference mapper for the
[OpenDPP](https://opendpp-node.eu) Digital Product Passport API (ESM, Node ≥ 26).
It maps parsed CSV rows to the **public passport-create shape** accepted by
`POST /api/v1/passports` and `POST /api/v1/passports/bulk` — so you can turn a
spreadsheet export into a bulk import with one call.

> Part of the OpenDPP **open client** surface (Apache-2.0). This package only
> produces JSON you could POST yourself. The hosted node — ESPR validation, GS1
> check-digit enforcement, operator binding, eIDAS sealing, the `vcReady` /
> `warnings` signals, resolver and 15-year persistence — stays a service you call,
> not code you run. See [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

## Why

Most product data already lives in a spreadsheet or an ERP export — not in
hand-written ESPR JSON. Rewriting hundreds of SKUs into the passport-create shape by
hand doesn't scale and invites transcription errors. This package maps parsed CSV
rows straight to the shape `POST /api/v1/passports/bulk` accepts, so a catalogue
export becomes a bulk import — parser-agnostic, zero-dependency, and faithful to the
public template columns.

## Install

```sh
npm install @opendpp/csv
```

## Use

Bring your own RFC-4180 parser (e.g. `papaparse`) and hand the rows in — the
package is parser-agnostic and pulls in no dependencies of its own:

```ts
import Papa from "papaparse";
import { mapCsvRowsToPassports, passportCsvTemplateHeader } from "@opendpp/csv";

const csv = await fetch("/my-export.csv").then((r) => r.text());
const { data } = Papa.parse(csv, { header: true, transformHeader: (h) => h.trim() });

const passports = mapCsvRowsToPassports(data);
// POST /api/v1/passports/bulk  ->  { passports }

// Generate a blank template header for a category:
passportCsvTemplateHeader("batteries");
// "productId,operatorId,facilityId,category,materials,origin,facilities,..."
```

### Column conventions

Shared columns apply to every category; each category adds its own. Lists use
`|`; facilities use `||` between facilities and `:` between a facility's fields;
`scalar:unit` and `material:percentage` pairs use `:`.

```
productId,category,materials,origin,facilities,ceMarking
09501101531000,batteries,Lithium:60|Cobalt:40,PT,Cell Plant:Lisbon:manufacturing:PT123456789,true
```

`passportCsvTemplate(category)` returns the full typed column set (with a
best-effort `required` hint and a description per column). The authoritative
per-category rule set is the live JSON Schema at `GET /api/v1/schemas/{category}`.

### Data integrity

A **blank cell becomes an absent field — never a fabricated default.** That means
an incomplete row is rejected by the hosted node's ESPR validation with a clear
error, instead of the importer inventing regulated values (origin, CO₂e, EUDR…).
The package does the mapping only; it does **not** validate, inject a default
operator, or enforce GS1 check digits — the hosted node is authoritative for all
of that and returns `vcReady` / `warnings` on ingest.

## API

| Export | Purpose |
|---|---|
| `mapCsvRowToPassport(row)` | Map one parsed row to `{ productId, operatorId?, facilityId?, metadata }`. |
| `mapCsvRowsToPassports(rows)` | Map an array of rows (empty rows skipped) for `/passports/bulk`. |
| `passportCsvTemplate(category)` | The canonical column set for a category. |
| `passportCsvTemplateHeader(category)` | The comma-joined CSV header row. |
| `ESPR_CATEGORIES` / `isEsprCategory(x)` | The nine ESPR category slugs + a type guard. |
| Types | `PassportCsvRow`, `PassportCreateInput`, `EsprCategory`, `CsvColumn`, `PassportCsvTemplate`. |

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

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
npx @opendpp/testdata batteries --format events            # EPCIS-shaped event chains
npx @opendpp/testdata all --count 2                        # 2 samples of every category
```

Flags: `--count/-c`, `--seed/-s`, `--format/-f json|csv|events`, `--prefix`
(your own 10-digit GS1 prefix), `--operator-id`, `--facility-id`, `--help`.

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

## License

[Apache-2.0](./LICENSE) © Opendpp UAB. See [`NOTICE`](./NOTICE). "OpenDPP" is a
trademark of Opendpp UAB; this license grants no rights to the marks.

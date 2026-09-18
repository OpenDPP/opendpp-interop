<!-- Copyright (c) Opendpp UAB. SPDX-License-Identifier: Apache-2.0 -->

# `schemas/` — official validation schemas (vendored)

These are **verbatim copies** of third-party open-standard JSON Schemas, vendored here so the
[validator](../validate/) and your own CI can run **offline** against the exact schemas OpenDPP
validates against. They are **not** OpenDPP works — each retains its upstream license and terms (see
[`../NOTICE`](../NOTICE)). Always treat the upstream as canonical.

| File | Standard | Draft | Upstream / canonical source |
| --- | --- | --- | --- |
| `aas-v3.schema.json` | Official IDTA AAS metamodel 3.1 JSON Schema (`aas-specs` v3.1.2) — IDTA-01001-3-1 | JSON Schema draft-2019-09 | IDTA / [admin-shell-io/aas-specs](https://github.com/admin-shell-io/aas-specs) (`$id: https://admin-shell.io/aas/3/1`) |
| `untp-dpp-v0.7.0.schema.json` | UN Transparency Protocol — Digital Product Passport v0.7.0 | JSON Schema draft-2020-12 | UN/CEFACT / [uncefact/spec-untp](https://github.com/uncefact/spec-untp) |
| `cirpass2-eu-registry-pointer.schema.json` | CIRPASS-2 mock-eu-registry pointer (ESPR Art. 13 index record) — **NON-NORMATIVE** | JSON Schema draft-2020-12 | CIRPASS-2 / [CIRPASS-2/mock-eu-registry](https://github.com/CIRPASS-2/mock-eu-registry) (`default-schema.json`, pinned commit `b383c4d`) |
| `epcis-2.0.1.schema.json` | Official GS1 EPCIS 2.0.1 JSON Schema (the consolidated standard artifact) | JSON Schema draft-07 | GS1 / [ref.gs1.org](https://ref.gs1.org/standards/epcis/epcis-json-schema.json) (`$id: https://ref.gs1.org/standards/epcis/2.0.1/epcis-json-schema.json`; also [gs1/EPCIS](https://github.com/gs1/EPCIS)) |

> The CIRPASS-2 pointer schema is the registry-side index record an EU DPP **pointer** is validated
> against (`upi` / `reoId` / `liveURL` / `backupURL` / `commodityCode` / `facilitiesId` /
> `granularityLevel`). It is a verbatim copy of `default-schema.json` from the CIRPASS-2
> `mock-eu-registry` reference, pinned at commit `b383c4d`, and is **NON-NORMATIVE** — the CIRPASS-2
> repos are for exploration and do not reflect CEN-CENELEC JTC 24 (see [`../NOTICE`](../NOTICE)).

> Vendored for convenience and reproducibility. If a copy here ever diverges from upstream, upstream
> wins — open an issue and we'll refresh it.

## OpenDPP-authored (non-normative)

Two schemas here are **not** vendored: EN 18223:2026 publishes JSON examples and an XSD (Annex B), no JSON
Schema, so OpenDPP wrote these from the standard's clauses. They are a conformance **aid**, never a
verdict — *validates against OpenDPP's reading of EN 18223*, not *EN 18223-certified*.

| File | What it checks | Draft | Source |
| --- | --- | --- | --- |
| `en18223-compressed.schema.json` | the compressed form of clause 5.2 — the nine Table 1 header attributes (seven mandatory), data elements open beside them under their elementId (5.2.2 leaves their type to the dictionary) | JSON Schema draft-2020-12 | generated from the node's own header constants (`npm run emit:en18223-schema`); Apache-2.0 |
| `en18223-expanded.schema.json` | the Annex A expanded form — the header, and under `elements[]` one object per element naming its clause 4 subclass and carrying that subclass's members (a collection's `elements`, a single Table 7-typed value, an ordered list of ONE subclass by position, a RelatedResource's Table 5 attributes, a MultiLanguage element's Table 6 values) | JSON Schema draft-2020-12 | same |

Every document the node serves — passport (every tier), unit, tombstone, and the `?representation=full`
form — is validated against them in the node's own test suite, so the schemas and the documents move
together.

### Where they knowingly differ from the clauses

An aid that silently disagrees with the text is worse than none, so the five places this kit does not
simply mirror the clauses are listed here. Two are **lenient** (a document the clause would refuse
still passes), two are **strict** (a document the clause allows is refused), and one is a **declared
subset** of a referenced specification. None is accidental.

Rows 1 to 4 are about the EN 18223 schemas in this directory. Row 5 is about EN 18222 and describes the
node's served API rather than a schema here — it is listed with them because it is the same kind of
statement, and a reader checking what this kit promises should find all of them in one place.

| # | Where | Direction | Why |
| --- | --- | --- | --- |
| 1 | `granularity` accepts `Model` as well as `model` | lenient | 4.1.2.2's prose enumerates the lower-case values; the clause 5.2.4 example spells them capitalised. The standard is not consistent with itself, so the schema accepts both. **The kit's own SHACL shape (`../shapes/`) takes the stricter prose reading** — so a capitalised value passes here and fails there. Run both and you will see it. |
| 2 | `lastUpdated` accepts a UTC offset (`…+02:00`) | lenient | JSON Schema's `date-time` is RFC 3339, which permits an offset. Table 7 fixes the Z-terminated form, so a `+02:00` value is accepted here and is not what the table prints. Every document the node serves is Z-terminated. |
| 3 | the expanded form **requires** `dictionaryReference` on every element | strict | Table 2 gives it `[0..1]`. The Annex A form exists to carry what the compressed form leaves to the dictionary (5.2.2), so the schema treats it as the shape's point — but a conformant Annex A document that omits it **will be refused here**. |
| 4 | the expanded form **requires** the `elements` key | strict | 4.1.2.1 holds `[0..*]` data elements, so a header-only passport is structurally valid. Satisfy this with `elements: []`, which the schema accepts; omitting the key entirely is refused. |
| 5 | `elementIdPath` resolves a **single-node subset** of RFC 9535 JSONPath | subset | EN 18222 clause 8.1 binds `elementIdPath` to RFC 9535. The node accepts the root identifier, name selectors (`$.name`, `$['name']`, `$["name"]`) and the index selector including the negative form (`$.materials[0]`, `$.materials[-1]`). The **wildcard, descendant (`..`), slice and filter selectors, and a comma union**, are refused with `400` naming the construct. Why: EN 18222 Table 9 and Table 10 each return one `DataElement`, while RFC 9535 is a query language whose result is a nodelist of any length — the series gives no rule for what a multi-node address means to a method that returns a single element. Resolving such a path to its first match would be a wrong answer wearing a `200`, so it is refused instead. |

Rows 1 and 2 mean a PASS here is not proof of conformance on those two points. Rows 3 and 4 mean a
FAILURE here is not proof of non-conformance on those two. Row 5 means a client using the full RFC 9535
grammar will be refused where the standard's own text would arguably allow it — the refusal is explicit
and names the construct, so it can never be mistaken for the element being absent. Everything else the
schemas check follows the clauses as OpenDPP reads them.

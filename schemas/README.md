# `schemas/` — official validation schemas (vendored)

These are **verbatim copies** of third-party open-standard JSON Schemas, vendored here so the
[validator](../validate/) and your own CI can run **offline** against the exact schemas OpenDPP
validates against. They are **not** OpenDPP works — each retains its upstream license and terms (see
[`../NOTICE`](../NOTICE)). Always treat the upstream as canonical.

| File | Standard | Draft | Upstream / canonical source |
| --- | --- | --- | --- |
| `aas-v3.schema.json` | Asset Administration Shell (AAS) v3.0 — IDTA-01001-3-1 | JSON Schema draft-2019-09 | IDTA / [admin-shell-io/aas-specs](https://github.com/admin-shell-io/aas-specs) (`$id: https://admin-shell.io/aas/3/1`) |
| `untp-dpp-v0.7.0.schema.json` | UN Transparency Protocol — Digital Product Passport v0.7.0 | JSON Schema draft-2020-12 | UN/CEFACT / [uncefact/spec-untp](https://github.com/uncefact/spec-untp) |
| `cirpass2-eu-registry-pointer.schema.json` | CIRPASS-2 mock-eu-registry pointer (ESPR Art. 13 index record) — **NON-NORMATIVE** | JSON Schema draft-2020-12 | CIRPASS-2 / [CIRPASS-2/mock-eu-registry](https://github.com/CIRPASS-2/mock-eu-registry) (`default-schema.json`, pinned commit `b383c4d`) |

> The CIRPASS-2 pointer schema is the registry-side index record an EU DPP **pointer** is validated
> against (`upi` / `reoId` / `liveURL` / `backupURL` / `commodityCode` / `facilitiesId` /
> `granularityLevel`). It is a verbatim copy of `default-schema.json` from the CIRPASS-2
> `mock-eu-registry` reference, pinned at commit `b383c4d`, and is **NON-NORMATIVE** — the CIRPASS-2
> repos are for exploration and do not reflect CEN-CENELEC JTC 24 (see [`../NOTICE`](../NOTICE)).

> Vendored for convenience and reproducibility. If a copy here ever diverges from upstream, upstream
> wins — open an issue and we'll refresh it.

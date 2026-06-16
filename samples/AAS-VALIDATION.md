# AAS v3.0 — sample Asset Administration Shell

Real, live outputs of the OpenDPP demo service, for the same fictional battery as the VC samples
(type passport `…/01/09501101532007`).

- `battery-aas-environment.json` — the AAS v3.0 Environment (IDTA-01001-3-1), live from prod.
- `battery.aasx` — that same Environment packaged as an **AASX** (OPC/ZIP) per AAS Part 5; open in
  AASX Package Explorer or load via BaSyx. Layout: `[Content_Types].xml`, `_rels/.rels`,
  `aasx/aasx-origin`, `aasx/data/environment.json`.

## Reproduce

```bash
curl -sL -H 'Accept: application/aas+json' https://opendpp-node.eu/01/09501101532007
# = battery-aas-environment.json   (battery.aasx is that Environment packaged as an OPC/ZIP)
```

## Validate

```bash
cd ../validate && npm install
node validate.mjs aas ../samples/battery-aas-environment.json   # ✓ IDTA-01001-3-1 AAS v3.0
```

The schema (`../schemas/aas-v3.schema.json`) is the official IDTA-01001-3-1 JSON Schema (draft-2019-09).
The upstream [`aas-test-engines`](https://github.com/admin-shell-io/aas-test-engines) Python suite is
the gold standard; this JSON-Schema validation is the CI-friendly structural equivalent.

> Concepts OpenDPP coins are `urn:opendpp:concept:*` / `urn:opendpp:submodel:*` — never presented as eCl@ss.

# AAS v3.0 — sample Asset Administration Shell

Real, live outputs of the OpenDPP demo service, for the same fictional battery as the VC samples
(type passport `…/01/09501101532007`).

- `battery-aas-environment.json` — the AAS v3.0 Environment (IDTA-01001-3-1), live from prod.
- `battery.aasx` — that same Environment packaged as an **AASX** (OPC/ZIP) per AAS Part 5; open in
  AASX Package Explorer or load via BaSyx. Layout: `[Content_Types].xml`, `_rels/.rels`,
  `aasx/aasx-origin`, `aasx/data/environment.json`.
- `{aluminium,chemicals,construction,cosmetics,electronics,iron-steel,textiles,toys}.aasx` — one AASX
  **per ESPR category** (#114/#115), each carrying that category's standardized submodel views on top of
  the authoritative ComplianceMetadata. Same OPC layout; the AAS Environment is at `aasx/data/environment.json`.

## Reproduce

```bash
curl -sL -H 'Accept: application/aas+json' https://opendpp-node.eu/01/09501101532007
# = battery-aas-environment.json   (battery.aasx is that Environment packaged as an OPC/ZIP)
```

## Validate

```bash
cd ../validate && npm install
node validate.mjs aas ../samples/battery-aas-environment.json   # ✓ IDTA-01001-3-1 AAS v3.0

# Validate every per-category .aasx — extract its AAS Environment first, then validate:
for f in ../samples/*.aasx; do
  unzip -p "$f" aasx/data/environment.json > /tmp/aas-env.json
  node validate.mjs aas /tmp/aas-env.json
done
```

The schema (`../schemas/aas-v3.schema.json`) is the official IDTA-01001-3-1 JSON Schema (draft-2019-09).
All **9 per-category** `.aasx` also pass the upstream
[`aas-test-engines`](https://github.com/admin-shell-io/aas-test-engines) Python suite — the AAS v3.0
**metamodel** gold standard, stricter than this JSON-Schema check — in OpenDPP's backend CI.

> Concepts OpenDPP coins are `urn:opendpp:concept:*` / `urn:opendpp:submodel:*` — never presented as eCl@ss.

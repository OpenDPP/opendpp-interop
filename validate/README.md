# `validate/` — offline conformance validator

A tiny, dependency-light CLI with **seven modes**: it validates an **AAS Environment** (`aas`), a **UNTP
DigitalProductPassport credential** (`untp`), or a **CIRPASS-2 EU-registry pointer** (`registry`,
NON-NORMATIVE) against the *same* official / reference JSON Schemas OpenDPP's own CI validates against
([`../schemas/`](../schemas/)); classifies IDTA **`semanticId`s** (`semanticids`); checks the passport
JSON-LD against OpenDPP's NON-NORMATIVE **SHACL** shapes (`shacl`); verifies an **SD-JWT-VC**
selective-disclosure presentation (`sdjwt`); and validates a **GS1 Digital Link** URI / AI element
string against GS1's OWN Barcode Syntax Engine (`gs1`, the official `gs1encoder`). Use it to prove your
output is conformant **before you ship** — without any access to the OpenDPP product source.

## Use it

```bash
cd validate
npm install                       # the validator's pinned deps — no OpenDPP code

node validate.mjs aas      ../samples/battery-aas-environment.json
node validate.mjs untp     ../samples/battery-vc-credential.json
node validate.mjs registry ../samples/battery-registry-pointer-model.json   # CIRPASS-2 (NON-NORMATIVE)
node validate.mjs shacl    ../samples/battery-passport.jsonld               # OpenDPP SHACL shapes (NON-NORMATIVE)
node validate.mjs sdjwt    ../samples/battery-vc.sdjwt                      # SD-JWT-VC: disclosures + ES256 signature
node validate.mjs gs1      ../samples/gs1-digital-link.txt                 # GS1 Digital Link: grammar + check digits (GS1's engine)
```

(`semanticids` has its own section below.)

Exit codes: **`0`** conformant · **`1`** schema errors (first 10 printed) · **`2`** usage / read error.

It's also importable:

```js
import { validateInterop } from "./validate.mjs";
const { valid, label, errors } = validateInterop("untp", myCredential);
```

## Classify IDTA `semanticId`s

Another mode checks IDTA template **identity** — is each AAS submodel `semanticId` a genuine,
published IDTA template id, or vendor-coined?

```bash
node validate.mjs semanticids ../samples/battery-aas-environment.json
node validate.mjs semanticids ../samples/battery-aas-environment.json --strict
```

Each `semanticId` is classified against the CC-BY allowlist
[`../idta-semantic-ids.json`](../idta-semantic-ids.json) (the IDTA submodel-template anchors OpenDPP
uses, each machine-checked `published`/`deprecated` against
[admin-shell-io/submodel-templates](https://github.com/admin-shell-io/submodel-templates)):

| Verdict | Meaning |
| --- | --- |
| `real-idta-published` | a `published` IDTA submodel-template IRI (genuine, current identity) |
| `idta-deprecated` | a real IDTA IRI the registry has deprecated (superseded — an honest red flag) |
| `vendor-coined` | an honest `urn:opendpp:*` id OpenDPP coins (never presented as IDTA/eCl@ss) |
| `eclass` | an eCl@ss IRDI (`0173-1#…`), e.g. a genuine property-level concept id |
| `unknown` | anything else, **including** an `admin-shell.io` IRI not in the allowlist (an IDTA claim we can't vouch for) |

This verifies **identity** (the id is the authentic IDTA template id), **not** structural conformance
to the template body. Default exit is `0`; `--strict` exits `1` if any IDTA-namespace id is deprecated
or absent from the allowlist. Importable too:

```js
import { classifyAasFile, classifySemanticId } from "./semantic-ids.mjs";
```

## Scope

The `aas` / `untp` / `registry` modes validate **structural** conformance (JSON Schema) and do **not**
verify a `vc+jwt` *signature* — for the enveloping `vc+jwt` / `vc+ld+json` that's a separate step
(resolve `did:web` → verify the JWS → validate the payload), described in the repo
[README → "Verify a signature"](../README.md#verify-a-signature) using only standard WebCrypto / JOSE.
The `sdjwt` mode **does** verify the SD-JWT-VC's ES256 signature (and reconstructs its disclosures), and
`shacl` runs RDF/SHACL validation of the passport JSON-LD.

The vendored schemas retain their upstream terms — see [`../NOTICE`](../NOTICE). This tool is
Apache-2.0.

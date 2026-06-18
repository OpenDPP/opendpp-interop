# `validate/` — offline conformance validator

A tiny, dependency-light CLI that checks an **AAS Environment**, a **UNTP DigitalProductPassport
credential**, or a **CIRPASS-2 EU-registry pointer** (NON-NORMATIVE) against the *same*
official / reference JSON Schemas OpenDPP's own CI validates against
([`../schemas/`](../schemas/)). Use it to prove your output is structurally conformant **before you
ship** — without any access to the OpenDPP product source.

## Use it

```bash
cd validate
npm install                       # ajv + ajv-formats only

node validate.mjs aas      ../samples/battery-aas-environment.json
node validate.mjs untp     ../samples/battery-vc-credential.json
node validate.mjs registry ../samples/battery-registry-pointer-model.json   # CIRPASS-2 (NON-NORMATIVE)
```

Exit codes: **`0`** conformant · **`1`** schema errors (first 10 printed) · **`2`** usage / read error.

It's also importable:

```js
import { validateInterop } from "./validate.mjs";
const { valid, label, errors } = validateInterop("untp", myCredential);
```

## Classify IDTA `semanticId`s

A third mode checks IDTA template **identity** — is each AAS submodel `semanticId` a genuine,
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

This validates **structural** conformance (JSON Schema). It does **not** verify a `vc+jwt`
*signature* — that's a separate step (resolve `did:web` → verify the JWS → validate the payload),
described in the repo [README → "Verify a signature"](../README.md#verify-a-signature) using only
standard WebCrypto / JOSE.

The vendored schemas retain their upstream terms — see [`../NOTICE`](../NOTICE). This tool is
Apache-2.0.

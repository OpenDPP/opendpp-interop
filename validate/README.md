# `validate/` — offline conformance validator

A tiny, dependency-light CLI that checks an **AAS Environment** or a **UNTP DigitalProductPassport
credential** against the *same* official JSON Schemas OpenDPP's own CI validates against
([`../schemas/`](../schemas/)). Use it to prove your output is structurally conformant **before you
ship** — without any access to the OpenDPP product source.

## Use it

```bash
cd validate
npm install                       # ajv + ajv-formats only

node validate.mjs aas   ../samples/battery-aas-environment.json
node validate.mjs untp  ../samples/battery-vc-credential.json
```

Exit codes: **`0`** conformant · **`1`** schema errors (first 10 printed) · **`2`** usage / read error.

It's also importable:

```js
import { validateInterop } from "./validate.mjs";
const { valid, label, errors } = validateInterop("untp", myCredential);
```

## Scope

This validates **structural** conformance (JSON Schema). It does **not** verify a `vc+jwt`
*signature* — that's a separate step (resolve `did:web` → verify the JWS → validate the payload),
described in the repo [README → "Verify a signature"](../README.md#verify-a-signature) using only
standard WebCrypto / JOSE.

The vendored schemas retain their upstream terms — see [`../NOTICE`](../NOTICE). This tool is
Apache-2.0.

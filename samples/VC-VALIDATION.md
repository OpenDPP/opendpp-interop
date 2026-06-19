# UNTP DigitalProductPassport — sample Verifiable Credentials

These artifacts are **real, live outputs** of the OpenDPP demo service — fetched verbatim from
production, not hand-built. You can reproduce and independently verify every one of them. They
describe a fictional battery (type passport `…/01/09501101532007`, serialised unit
`VM-LFP100-2026-000001`) and a fictional textile garment (passport `…/01/09501101531000`), both
issued by the demo tenant `tenant-demo-opendpp`.

## What's here

- `battery-vc.jwt` — the enveloping `vc+jwt` (W3C VC-JOSE-COSE, ES256) for the SKU/type passport.
- `battery-vc-credential.json` — its decoded JWS payload (the credential, `idGranularity:"model"`).
- `battery-vc-di.jsonld` — the same passport with an **embedded W3C Data Integrity** proof
  (`ecdsa-jcs-2019`) instead of the JOSE envelope.
- `battery-unit-vc.jwt` / `battery-unit-vc-credential.json` / `battery-unit-vc-di.jsonld` — the
  **per-unit** credential for one serialised battery (`idGranularity:"item"`, the GS1 AI-21 serial
  `VM-LFP100-2026-000001` as `itemNumber`), linked back to the type credential, each carrying its own
  `credentialStatus` revocation entry.
- `battery-issuer-did.json` — the issuer `did:web` document (the verification key). The textile
  credential is issued by the same demo tenant, so it verifies against this same document.
- `textile-vc.jwt` / `textile-vc-credential.json` — a **non-battery (textiles)** credential. It proves
  the per-category **typed mapping**: `fiberComposition` → typed `materialProvenance`, and
  `recycledContent` → a self-declared circularity `performanceClaim` (an OpenDPP self-declaration
  criterion — **not** an ESPR/third-party criterion) — rather than the `characteristics` open bag.

## Reproduce them (they're live)

```bash
G="https://opendpp-node.eu/01/09501101532007"
curl -sL -H 'Accept: application/vc+jwt'      "$G"                            # = battery-vc.jwt
curl -sL -H 'Accept: application/vc+ld+json'  "$G"                            # = battery-vc-di.jsonld
curl -sL -H 'Accept: application/vc+jwt'      "$G/21/VM-LFP100-2026-000001"   # = battery-unit-vc.jwt
curl -sL -H 'Accept: application/vc+jwt'      https://opendpp-node.eu/01/09501101531000   # = textile-vc.jwt
curl -s  https://opendpp-node.eu/tenants/tenant-demo-opendpp/did.json          # = battery-issuer-did.json
```

## Validate (structure)

```bash
cd ../validate && npm install
node validate.mjs untp ../samples/battery-vc-credential.json        # ✓ UNTP DPP v0.7.0
node validate.mjs untp ../samples/battery-unit-vc-credential.json   # ✓ item granularity
node validate.mjs untp ../samples/textile-vc-credential.json        # ✓ non-battery typed mapping
```

## Verify (signature)

Decode the `vc+jwt`, read the `kid` from its protected header, resolve `battery-issuer-did.json` (or
the live `/tenants/tenant-demo-opendpp/did.json`), and verify the ES256 signature with the matching
`publicKeyJwk` — standard JOSE, no OpenDPP code. The embedded `vc+ld+json` form verifies per the W3C
`ecdsa-jcs-2019` cryptosuite (e.g. `@digitalbazaar/ecdsa-jcs-2019-cryptosuite`). Revocation: dereference
`credentialStatus` against the signed status list at `/tenants/tenant-demo-opendpp/status/revocation`.

> Synthetic demo data for a fictional manufacturer ("OpenDPP Demo Manufacturing — SAMPLE DATA — NOT A
> REAL COMPANY"), signed with the demo tenant's key. No real personal or production data.

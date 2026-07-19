<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/gs1

Pure, zero-dependency **GS1 Digital Link** URI builders (GTIN / GLN / GRAI) and
**mod-10 check-digit** helpers (ESM, Node ≥ 26). Extracted from the
[OpenDPP](https://opendpp-node.eu) Digital Product Passport service so any client
can build and validate the same GS1 identifiers the hosted node resolves.

> Part of the OpenDPP **open client** surface (Apache-2.0). The hosted node —
> resolver, eIDAS sealing, did:web/status-list issuance, 15-year persistence —
> stays a service you call, not code you run. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

## Why

A GS1 Digital Link is what turns a scanned QR or NFC tag into a resolvable passport
URL — and a GTIN / GLN / GRAI is only valid with the correct mod-10 check digit. Get
that digit wrong and the barcode you print is dead on arrival. This package lets any
client **validate an identifier before it reaches a physical label**, **mint** a
correct one for synthetic or demo data, and build the exact Digital Link URIs the
hosted node resolves — the same code the node runs, with zero dependencies.

## Install

```sh
npm install @opendpp/gs1
```

## Use

```ts
import {
  isValidGTIN,
  isGs1Keyed,
  gtinIngestError,
  makeGtin,
  makeGln,
  generateDigitalLinkUri,
  generateUnitDigitalLinkUri,
  canonicalProductUpi,
  parseDigitalLinkPath,
  toNdefUriRecord,
} from "@opendpp/gs1";

isValidGTIN("09501101531000");          // true  — valid GTIN-14 mod-10 check digit
isGs1Keyed("WIDGET-1");                  // false — a non-GS1 SKU
gtinIngestError("00012345678900");       // "...looks like a GTIN-14 but its check digit is invalid..."

// Mint valid identifiers (since 0.2.0) — the generation-side complement of the validators,
// e.g. for synthetic/demo data:
makeGtin("0950110154100");               // "09501101541009" — 13-digit body + mod-10 check digit
makeGln("095011015401");                 // "0950110154011"  — 12-digit body + mod-10 check digit

// Host-independent GS1 identity (UPI) — never an OpenDPP host:
canonicalProductUpi("09501101531000");   // "https://id.gs1.org/01/09501101531000"

// Resolver links (see the baseUrl note below):
generateDigitalLinkUri("09501101531000", "passport-id");        // ".../01/09501101531000"
generateUnitDigitalLinkUri("09501101531000", "BATTERY-SERIAL"); // ".../01/09501101531000/21/BATTERY-SERIAL"

parseDigitalLinkPath("09501101531000/21/ABC");
// { primaryId: "09501101531000", additionalAttributes: { "21": "ABC" } }

// NFC: wrap a Digital Link as an NDEF URI record to write to a tag. A data carrier is
// carrier-agnostic at the URL level — an NFC tag encoded with the SAME Digital Link URL a QR
// carries resolves identically. This is a pure encoder (no NFC I/O; you write the bytes to the tag).
toNdefUriRecord(generateUnitDigitalLinkUri("09501101531000", "SN-1"));
// Uint8Array: NDEF URI record — [0xD1,0x01,len,0x55, 0x04(https://), …"…/01/…/21/SN-1"]
```

### `baseUrl` and `process.env.BASE_URL`

`canonicalProductUpi` / `canonicalUnitUpi` are pure — they always emit the
GS1 identity host `https://id.gs1.org`. The two **resolver** builders
(`generateDigitalLinkUri`, `generateUnitDigitalLinkUri`) emit against a resolver
host. Pass an explicit `baseUrl` option to keep them pure — the recommended form,
with no implicit environment coupling:

```ts
generateDigitalLinkUri("09501101531000", "pp_1", { baseUrl: "https://dpp.example.com" });
// "https://dpp.example.com/01/09501101531000"
generateUnitDigitalLinkUri("09501101531000", "SN-42", { baseUrl: "https://dpp.example.com" });
// "https://dpp.example.com/01/09501101531000/21/SN-42"
```

When `baseUrl` is omitted they fall back to `process.env.BASE_URL`, then to
`https://opendpp-node.eu` — a back-compat convenience, so a consumer that never
sets the option still works.

## API

Beyond the helpers shown above, the package also exports:

| Export | Purpose |
|---|---|
| `isGTINVal(val)` | Strict GTIN-14 check — exactly 14 digits with a valid mod-10 check digit. |
| `isValidGLN(gln)` | GLN-13 (Global Location Number) check — 13 digits + mod-10. |
| `isGRAIVal(val)` | GRAI (AI 8003) check — 14-digit asset id (mod-10) + optional CSET-82 serial (≤ 16 chars). |
| `gs1CheckDigit(body)` | The GS1 mod-10 check digit for a numeric body — the algorithm behind `makeGtin`/`makeGln`. |
| `nonGs1Warning(productId)` | The non-blocking `warnings[]` advisory for a non-GS1 `productId` (it saves, but gets no scannable GS1 Digital Link / QR). |
| `NON_GS1_PRODUCT_ID_WARNING_CODE` | That advisory's machine-stable `code` (`"NON_GS1_PRODUCT_ID"`). |

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


<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/gs1

Pure, zero-dependency **GS1 Digital Link** URI builders and **GS1 mod-10 / GLN
check-digit** helpers (ESM, Node ≥ 26). Extracted from the
[OpenDPP](https://opendpp-node.eu) Digital Product Passport service so any client
can build and validate the same GS1 identifiers the hosted node resolves.

> Part of the OpenDPP **open client** surface (Apache-2.0). The hosted node —
> resolver, eIDAS sealing, did:web/status-list issuance, 15-year persistence —
> stays a service you call, not code you run. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

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
```

### `baseUrl` and `process.env.BASE_URL`

`canonicalProductUpi` / `canonicalUnitUpi` are pure — they always emit the
GS1 identity host `https://id.gs1.org`. The two **resolver** builders
(`generateDigitalLinkUri`, `generateUnitDigitalLinkUri`) currently read
`process.env.BASE_URL` and fall back to `https://opendpp-node.eu`. This is a
deliberate carry-over from the extraction; a future release will accept an
explicit `baseUrl` option so the package has no implicit environment coupling.

## License

[Apache-2.0](./LICENSE) © Opendpp UAB. See [`NOTICE`](./NOTICE). "OpenDPP" is a
trademark of Opendpp UAB; this license grants no rights to the marks.

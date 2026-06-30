# @opendpp/aeo

**Authorised Economic Operator (AEO)** lookup against the **European Commission's
official EOS `aeo-retrieve` web service** — the authoritative source for EU AEO
trusted-trader status — plus pure, zero-dependency offline helpers (ESM, Node ≥ 26).
From the [OpenDPP](https://opendpp-node.eu) Digital Product Passport service.

> Part of the OpenDPP **open client** surface (Apache-2.0). The hosted node —
> resolver, eIDAS sealing, did:web/status-list issuance, 15-year persistence —
> stays a service you call, not code you run. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

## Why

AEO is the EU's **trusted-trader** status (UCC Art. 38): `AEOC` (customs
simplifications), `AEOS` (security & safety), `AEOF` (combined). Confirming that the
economic operator behind a product holds an AEO authorisation is a credible
supply-chain **due-diligence** signal (EUDR / UFLPA / CSDDD) that complements
operator identity (see the sibling [`@opendpp/eori`](https://www.npmjs.com/package/@opendpp/eori)).

The single authoritative source is the European Commission's EOS service — the
machine equivalent of the interactive
[AEO consultation page](https://ec.europa.eu/taxation_customs/dds2/eos/aeo_consultation.jsp).
This package speaks to it directly — no third-party intermediary.

## How the service works (important)

`aeo-retrieve` is a **holder directory search**, not an identifier validator. You
search by **holder name** (substring), optionally filtered by **issuing country**
and **authorisation type** (at least one of `AEOC`/`AEOF`/`AEOS` — defaults to all
three), and it returns the **matching authorisations**. No match is a valid empty
result, not an error.

## Install

```sh
npm install @opendpp/aeo
```

## Lookup (online, authoritative)

```ts
import { lookupAeo, hasAeoAuthorisation, lookupAeoBatch } from "@opendpp/aeo";

const result = await lookupAeo({ holderName: "BMW", issuingCountry: "DE" });
// {
//   query: { holderName: "BMW", issuingCountry: "DE", authorisationTypes: ["AEOC","AEOF","AEOS"] },
//   found: true,
//   matches: [{
//     authorisationHolderName: "BMW M GmbH Gesellschaft für individuelle Automobile",
//     issuingCountry: "Germany",            // the service returns the full country NAME
//     competentCustomsAuthority: "DE007600",
//     authorisationType: "AEOF",            // AEOC | AEOF | AEOS
//     effectiveDate: "17/02/2015",          // DD/MM/YYYY, as returned
//   }],
//   source: "ec-europa-eos",
//   requestDate: "2026-06-30",
//   checkedAt: "2026-06-30T…Z",
// }

await hasAeoAuthorisation("Siemens");                 // true / false
await lookupAeo({ holderName: "Acme", authorisationType: "AEOF" });  // filter to combined only

// Several holders, one request each (paced), one result per query, in order:
await lookupAeoBatch([{ holderName: "Acme" }, { holderName: "Globex" }]);
```

A holder-name substring can match **several** authorisations, so `matches` is a
list. Use `issuingCountry` / `authorisationType` to narrow it.

### Injectable transport (SSRF-safe servers)

Zero runtime dependencies; uses the global `fetch` by default. A server can inject
its own transport (e.g. an SSRF-guarded fetch — the endpoint host is fixed to
`ec.europa.eu`):

```ts
import { lookupAeo, type AeoTransport } from "@opendpp/aeo";

const guarded: AeoTransport = async (url, req) => {
  const res = await safeFetch(url, { method: req.method, headers: req.headers, body: req.body, signal: req.signal });
  return { status: res.status, text: () => res.text() };
};

await lookupAeo({ holderName: "BMW" }, { transport: guarded, timeoutMs: 10_000 });
```

Low-level building blocks are exported too — `buildRetrieveAeoEnvelope(criteria)`
and `parseRetrieveAeoResponse(xml)`.

### Rate limiting (respects the EU cap, overridable)

The EOS service caps each source at **100 requests / second**. A process-wide
limiter enforces that by default (a single call never waits; bursts spread out).
The EU tech team grants higher/uncapped limits on request, so it's overridable:

```ts
import { lookupAeo, setDefaultAeoRateLimit, createAeoRateLimiter } from "@opendpp/aeo";

setDefaultAeoRateLimit(500);                  // global — set once at startup (null disables)
const fast = createAeoRateLimiter(500);       // or per call (create ONCE, reuse)
await lookupAeo({ holderName: "BMW" }, { rateLimiter: fast });
await lookupAeo({ holderName: "BMW" }, { rateLimiter: null });  // disable for one call
```

> The service also caps a request at 10 search criteria; this client sends **one
> per request** because the flat result list cannot be attributed back to
> individual criteria. The cap is **per source** — a horizontally scaled service
> still wants a shared/server-side limiter.

## Offline helpers (pure)

```ts
import { AUTHORISATION_TYPES, isAuthorisationType, parseAeoNumber } from "@opendpp/aeo";

AUTHORISATION_TYPES;               // ["AEOC", "AEOF", "AEOS"]
isAuthorisationType("AEOF");       // true

parseAeoNumber("DE AEOF 00025/08");
// { countryCode: "DE", type: "AEOF", nationalNumber: "00025/08", validSyntax: true, ... }
```

> `parseAeoNumber` is an offline convenience for recognising a number a user typed —
> the service is searched by **holder name**, not by this number (its responses do
> not echo the number back).

## Notes

- This package formats requests to, and parses responses from, the European
  Commission EOS service. Opendpp UAB is not affiliated with, nor endorsed by, the
  European Commission; the service is provided under the Commission's own terms.

## License

[Apache-2.0](./LICENSE) © Opendpp UAB. See [`NOTICE`](./NOTICE). "OpenDPP" is a
trademark of Opendpp UAB; this license grants no rights to the marks.

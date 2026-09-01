<!-- Copyright (c) Opendpp UAB. SPDX-License-Identifier: Apache-2.0 -->

<p align="center">
  <img src="https://raw.githubusercontent.com/OpenDPP/opendpp-interop/main/assets/opendpp-mark.png" alt="OpenDPP" width="80" height="80">
</p>

# @opendpp/webhooks

Typed **webhook event names + envelope shape** for the
[OpenDPP](https://opendpp-node.eu) Digital Product Passport service, plus a
zero-dependency, **constant-time HMAC-SHA256 signature verifier** so you can
trust an inbound webhook before acting on it (ESM, Node ≥ 26).

> Part of the OpenDPP **open client** surface (Apache-2.0). The hosted node —
> delivery, retries, the per-subscription secret, resolver, eIDAS sealing, 15-year
> persistence — stays a service you call. See
> [`opendpp-interop`](https://github.com/OpenDPP/opendpp-interop).

## Why

A webhook endpoint is a public URL — anyone who finds it can POST to it. Before your
handler acts on a `passport.sealed` or `passport.recalled` event, you need to know it
genuinely came from OpenDPP and wasn't tampered with in flight. This package gives you
the exact event types and a **constant-time HMAC-SHA256 verifier**, so you reject a
forged or replayed delivery in one call — no dependency, no timing side-channel.

## Install

```sh
npm install @opendpp/webhooks
```

## Verify an inbound webhook

Verify over the **raw request body** — re-serialising a parsed object changes key
order/whitespace and breaks the HMAC. Example with Express:

```ts
import express from "express";
import { verifyWebhookRequest, parseWebhookEnvelope } from "@opendpp/webhooks";

const app = express();

app.post(
  "/webhooks/opendpp",
  express.raw({ type: "application/json" }), // keep the raw body
  (req, res) => {
    const rawBody = req.body.toString("utf8");
    const ok = verifyWebhookRequest(rawBody, {
      get: (name) => req.header(name) ?? null,
    }, process.env.OPENDPP_WEBHOOK_SECRET!);

    if (!ok) return res.sendStatus(401);

    const event = parseWebhookEnvelope(rawBody); // typed { id, type, created, data }
    // dedupe on event.id (stable across retries), then handle event.type …
    res.sendStatus(200); // return 2xx within ~5s or it counts as failed
  },
);
```

`verifyWebhookSignature({ payload, signature, secret, timestamp })` is the
lower-level primitive if you extract the headers yourself.

## The signing recipe

The signature OpenDPP sends in `X-OpenDPP-Signature` is:

```
HMAC_SHA256( secret, `${timestamp}.${rawBody}` )   // hex, lowercase
```

- `secret` — the full `whsec_…` per-subscription secret (returned once at create /
  rotate-secret; format `whsec_` + 32 lowercase hex chars).
- `timestamp` — the `X-OpenDPP-Timestamp` header (unix seconds), prefixed into the
  signed content as a replay defence.
- `rawBody` — the exact JSON request body.

Reject a delivery whose timestamp is more than ~5 minutes from now (the verifier
does this by default, `toleranceSeconds: 300`). Delivery is **at-least-once** with
up to 6 delivery attempts (1 inline + 5 retries, exponential backoff
~1m/5m/30m/2h/12h) — **dedupe on `X-OpenDPP-Delivery`** (the
envelope `id`), which is stable across retries.

## Events

`passport.ingested` · `passport.updated` · `passport.sealed` · `passport.recalled`
· `passport.status_updated`. Envelope: `{ id, type, created, data }`, where `data`
is the public redacted JSON-LD passport document. Exported as
`OPENDPP_WEBHOOK_EVENT_TYPES`, `OpenDppWebhookEventType`, and
`OpenDppWebhookEnvelope<TData>`.

## Python reference receiver

The recipe is trivially portable — verify with the standard library:

```python
import hashlib
import hmac
import time

def verify_opendpp_webhook(raw_body: str, signature: str, timestamp: str,
                           secret: str, tolerance_seconds: int = 300) -> bool:
    if tolerance_seconds > 0 and abs(time.time() - int(timestamp)) > tolerance_seconds:
        return False
    expected = hmac.new(
        secret.encode(), f"{timestamp}.{raw_body}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

```python
# Flask:
#   raw = request.get_data(as_text=True)
#   ok = verify_opendpp_webhook(raw, request.headers["X-OpenDPP-Signature"],
#                               request.headers["X-OpenDPP-Timestamp"], SECRET)
```

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

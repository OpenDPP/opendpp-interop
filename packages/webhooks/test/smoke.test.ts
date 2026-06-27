// @opendpp/webhooks smoke test — proves the package works standalone (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
// The fixture signature is computed with node:crypto using the SAME recipe the OpenDPP server uses
// (src/utils/webhook.ts), so this is a true parity check of the verifier — not a self-round-trip of
// the package's own signing (the package has no signer; the hosted node holds the key).
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyWebhookSignature,
  verifyWebhookRequest,
  parseWebhookEnvelope,
  isOpenDppWebhookEventType,
  OPENDPP_WEBHOOK_EVENT_TYPES,
  OPENDPP_WEBHOOK_HEADERS,
  WEBHOOK_SECRET_PATTERN,
} from "../src/index.ts";

// Deliberately LOW-ENTROPY fake secrets (all-zero / all-f hex) — a valid whsec_ format for the
// assertions, but no real entropy, so the gitleaks secret-scan doesn't flag the test fixture.
const SECRET = "whsec_00000000000000000000000000000000";
const NOW = 1_782_600_000; // fixed "current" unix seconds for deterministic replay checks
const TS = String(NOW - 10); // 10s ago — well inside the 5-min window

// Mirror src/utils/webhook.ts:41-43 exactly.
const envelope = { id: "wd_1", type: "passport.sealed", created: "2026-06-28T00:00:00.000Z", data: { foo: "bar" } };
const rawBody = JSON.stringify(envelope);
const sign = (ts: string, body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
const SIG = sign(TS, rawBody);

test("accepts a genuine signature (server-recipe parity)", () => {
  assert.equal(verifyWebhookSignature({ payload: rawBody, signature: SIG, secret: SECRET, timestamp: TS, nowSeconds: NOW }), true);
});

test("rejects a tampered body, a tampered signature, and the wrong secret", () => {
  assert.equal(
    verifyWebhookSignature({ payload: rawBody + " ", signature: SIG, secret: SECRET, timestamp: TS, nowSeconds: NOW }),
    false,
  );
  assert.equal(
    verifyWebhookSignature({ payload: rawBody, signature: SIG.replace(/.$/, "0"), secret: SECRET, timestamp: TS, nowSeconds: NOW }),
    false,
  );
  assert.equal(
    verifyWebhookSignature({ payload: rawBody, signature: SIG, secret: "whsec_ffffffffffffffffffffffffffffffff", timestamp: TS, nowSeconds: NOW }),
    false,
  );
});

test("rejects a stale timestamp, but honours toleranceSeconds: 0", () => {
  const staleTs = String(NOW - 600); // 10 min ago
  const staleSig = sign(staleTs, rawBody);
  assert.equal(
    verifyWebhookSignature({ payload: rawBody, signature: staleSig, secret: SECRET, timestamp: staleTs, nowSeconds: NOW }),
    false,
    "outside the default 5-min window -> rejected",
  );
  assert.equal(
    verifyWebhookSignature({ payload: rawBody, signature: staleSig, secret: SECRET, timestamp: staleTs, nowSeconds: NOW, toleranceSeconds: 0 }),
    true,
    "replay check disabled -> signature alone validates",
  );
});

test("verifyWebhookRequest reads a Fetch-style Headers object", () => {
  const headers = new Headers();
  headers.set(OPENDPP_WEBHOOK_HEADERS.signature, SIG);
  headers.set(OPENDPP_WEBHOOK_HEADERS.timestamp, TS);
  assert.equal(verifyWebhookRequest(rawBody, headers, SECRET, { nowSeconds: NOW }), true);

  const missing = new Headers();
  assert.equal(verifyWebhookRequest(rawBody, missing, SECRET, { nowSeconds: NOW }), false);
});

test("envelope parsing + event-type guard + constants", () => {
  const parsed = parseWebhookEnvelope<{ foo: string }>(rawBody);
  assert.equal(parsed.id, "wd_1");
  assert.equal(parsed.type, "passport.sealed");
  assert.equal(parsed.data.foo, "bar");
  assert.throws(() => parseWebhookEnvelope("{}"), /well-formed/);

  assert.equal(isOpenDppWebhookEventType("passport.ingested"), true);
  assert.equal(isOpenDppWebhookEventType("passport.exploded"), false);
  assert.equal(OPENDPP_WEBHOOK_EVENT_TYPES.length, 5);
  assert.match(SECRET, WEBHOOK_SECRET_PATTERN);
});

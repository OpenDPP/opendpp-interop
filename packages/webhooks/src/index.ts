/**
 * @opendpp/webhooks — OpenDPP webhook event types + HMAC-verify reference receiver
 *
 * Typed event names + the signed-envelope shape OpenDPP delivers, plus a constant-time
 * HMAC-SHA256 signature verifier so an integrator can trust an inbound webhook. Pure ESM,
 * Node >=26, zero runtime dependencies (uses only the built-in `node:crypto`).
 *
 * This is a fresh reference implementation derived from the public webhook contract
 * (openapi.json `webhooks` + the documented signing scheme) — NOT a lift of the hosted
 * node's delivery internals. The hosted node remains authoritative for delivery,
 * retries, and the per-subscription secret.
 *
 * SIGNING RECIPE (must match the server byte-for-byte): the signature is
 * `HMAC-SHA256(secret, `${timestamp}.${rawBody}`)` hex-encoded (lowercase), where
 * `secret` is the full `whsec_…` per-subscription value, `timestamp` is the
 * `X-OpenDPP-Timestamp` header (unix seconds), and `rawBody` is the EXACT request body
 * string. Verify over the raw body — re-serialising a parsed object changes key order /
 * whitespace and breaks the HMAC.
 *
 * Copyright (c) Opendpp UAB.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use
 * this file except in compliance with the License. You may obtain a copy of the
 * License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * "OpenDPP" is a trademark of Opendpp UAB; the Apache-2.0 license grants no rights to the marks.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** The webhook event types OpenDPP delivers (the `type` field + the `X-OpenDPP-Event` header). */
export const OPENDPP_WEBHOOK_EVENT_TYPES = [
  "passport.ingested",
  "passport.updated",
  "passport.sealed",
  "passport.recalled",
  "passport.status_updated",
] as const;

export type OpenDppWebhookEventType = (typeof OPENDPP_WEBHOOK_EVENT_TYPES)[number];

/** A subscription event filter — a specific event type, or `"*"` for all events. */
export type OpenDppWebhookEventFilter = OpenDppWebhookEventType | "*";

/**
 * The signed webhook envelope OpenDPP POSTs to a subscription URL. `id` is the stable delivery id
 * (constant across retries — dedupe on it), `type` is the event, `created` is an ISO-8601 timestamp,
 * and `data` is the public redacted JSON-LD passport document.
 */
export interface OpenDppWebhookEnvelope<TData = unknown> {
  id: string;
  type: OpenDppWebhookEventType;
  created: string;
  data: TData;
}

/** The OpenDPP webhook header names (case-insensitive on the wire). */
export const OPENDPP_WEBHOOK_HEADERS = {
  /** Event type, for routing. */
  event: "X-OpenDPP-Event",
  /** Stable delivery id (= envelope `id`); dedupe on this for at-least-once delivery. */
  delivery: "X-OpenDPP-Delivery",
  /** Unix-seconds timestamp; prefixed into the signed content (replay defence). */
  timestamp: "X-OpenDPP-Timestamp",
  /** Lowercase-hex HMAC-SHA256 signature. */
  signature: "X-OpenDPP-Signature",
} as const;

/** The per-subscription secret format: `whsec_` + 32 lowercase hex chars. */
export const WEBHOOK_SECRET_PATTERN = /^whsec_[0-9a-f]{32}$/;

/** Type guard for a known OpenDPP webhook event type. */
export function isOpenDppWebhookEventType(value: unknown): value is OpenDppWebhookEventType {
  return typeof value === "string" && (OPENDPP_WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

export interface VerifyWebhookSignatureOptions {
  /** The RAW request body string, exactly as received. Do NOT re-stringify a parsed object. */
  payload: string;
  /** The `X-OpenDPP-Signature` header value (lowercase-hex HMAC-SHA256). */
  signature: string;
  /** The full per-subscription secret (the `whsec_…` value returned once at create / rotate). */
  secret: string;
  /** The `X-OpenDPP-Timestamp` header value (unix seconds). */
  timestamp: string | number;
  /** Max accepted clock skew in seconds for the replay check (default 300 = 5 min; 0 disables it). */
  toleranceSeconds?: number;
  /** Current unix-seconds time; injectable for deterministic tests (default `Date.now()/1000`). */
  nowSeconds?: number;
}

/**
 * Verifies an OpenDPP webhook signature in constant time, and (unless disabled) rejects a stale
 * timestamp outside the tolerance window. Returns `true` only when the HMAC matches AND the timestamp
 * is fresh. The signed content is `${timestamp}.${payload}` and the HMAC is keyed with the full secret.
 *
 * The hosted node re-mints a fresh `(timestamp, signature)` pair on every retry, so a retried delivery
 * always carries a valid pair; dedupe on `X-OpenDPP-Delivery` (the envelope `id`).
 */
export function verifyWebhookSignature(options: VerifyWebhookSignatureOptions): boolean {
  const { payload, signature, secret, timestamp } = options;
  if (typeof payload !== "string" || typeof signature !== "string" || typeof secret !== "string") {
    return false;
  }
  if (signature.length === 0) return false;

  const toleranceSeconds = options.toleranceSeconds ?? 300;
  if (toleranceSeconds > 0) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > toleranceSeconds) return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const computed = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch — guard first; a different length is a non-match anyway.
  if (provided.length !== computed.length) return false;
  return timingSafeEqual(provided, computed);
}

/** A minimal headers reader — satisfied by the Fetch `Headers` object and most framework header bags. */
export interface WebhookHeaderReader {
  get(name: string): string | null | undefined;
}

export interface VerifyWebhookRequestOptions {
  /** Max accepted clock skew in seconds (default 300 = 5 min; 0 disables the replay check). */
  toleranceSeconds?: number;
  /** Current unix-seconds time; injectable for deterministic tests. */
  nowSeconds?: number;
}

/**
 * Convenience over {@link verifyWebhookSignature}: reads the signature + timestamp headers off a
 * Fetch-style `Headers` object (or anything with a `get(name)` method) and verifies the raw body.
 */
export function verifyWebhookRequest(
  rawBody: string,
  headers: WebhookHeaderReader,
  secret: string,
  options: VerifyWebhookRequestOptions = {},
): boolean {
  const signature = headers.get(OPENDPP_WEBHOOK_HEADERS.signature) ?? "";
  const timestamp = headers.get(OPENDPP_WEBHOOK_HEADERS.timestamp) ?? "";
  return verifyWebhookSignature({
    payload: rawBody,
    signature,
    secret,
    timestamp,
    toleranceSeconds: options.toleranceSeconds,
    nowSeconds: options.nowSeconds,
  });
}

/**
 * Parses a verified raw body into a typed envelope. Call this AFTER {@link verifyWebhookSignature} /
 * {@link verifyWebhookRequest} — it does no verification itself. Throws if the body is not a
 * well-formed OpenDPP envelope.
 */
export function parseWebhookEnvelope<TData = unknown>(rawBody: string): OpenDppWebhookEnvelope<TData> {
  const value: unknown = JSON.parse(rawBody);
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as Record<string, unknown>).id !== "string" ||
    typeof (value as Record<string, unknown>).created !== "string" ||
    !isOpenDppWebhookEventType((value as Record<string, unknown>).type)
  ) {
    throw new Error("Not a well-formed OpenDPP webhook envelope.");
  }
  return value as OpenDppWebhookEnvelope<TData>;
}

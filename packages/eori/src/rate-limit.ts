// jscpd:ignore-start -- DELIBERATE eori<->aeo mirror (zero-dependency policy; drift-guarded by tests/guards/eos-soap-parity.test.ts)
/**
 * @opendpp/eori — client-side request pacing
 *
 * The EU EOS service caps each source at **100 requests/second** (and 10 numbers
 * per request — handled by chunking in `validate.ts`). This module is a tiny,
 * zero-dependency rate limiter that paces outgoing requests to that cap so the
 * package is a good citizen against a government endpoint, while staying fully
 * overridable: the EU tech team grants higher/uncapped limits on request, so the
 * rate can be raised — or disabled — globally or per call.
 *
 * It uses interval scheduling (reserve an increasing time slot per acquire) rather
 * than a token bucket: fair under concurrency, no leaked timers, and a single call
 * never waits. NOTE: the limit is enforced *per source* — across a horizontally
 * scaled service (multiple instances) a shared/server-side limiter is still needed;
 * this protects a single process from bursting past the cap.
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

/** The EU EOS per-source cap: 100 requests/second. */
export const DEFAULT_REQUESTS_PER_SECOND = 100;

/** Anything that can gate an outgoing request. */
export interface RateLimiter {
  /** Resolve when a request slot is available; reject if `signal` aborts while waiting. */
  acquire(signal?: AbortSignal): Promise<void>;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Interval-scheduling rate limiter. Each `acquire()` reserves the next slot
 * (≥ `now`, ≥ the previously reserved slot), so concurrent acquires are spread out
 * fairly and the rate is never exceeded. A `setRate` of `null`/`0`/negative/non-finite
 * disables throttling entirely.
 */
export class EoriRateLimiter implements RateLimiter {
  #minIntervalMs = 0;
  #nextSlot = 0;
  #rate: number | null = null;

  constructor(requestsPerSecond: number | null = DEFAULT_REQUESTS_PER_SECOND) {
    this.setRate(requestsPerSecond);
  }

  /** Current limit in requests/second, or `null` when disabled. */
  get rate(): number | null {
    return this.#rate;
  }

  /**
   * Change the limit. `null`/`0`/negative/non-finite disables throttling — use this
   * when the EU tech team has granted a higher or uncapped limit.
   */
  setRate(requestsPerSecond: number | null): void {
    if (requestsPerSecond == null || !Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
      this.#rate = null;
      this.#minIntervalMs = 0;
      return;
    }
    this.#rate = requestsPerSecond;
    this.#minIntervalMs = 1000 / requestsPerSecond;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    if (this.#minIntervalMs <= 0) return; // disabled — no waiting
    const now = Date.now();
    const slot = Math.max(now, this.#nextSlot);
    this.#nextSlot = slot + this.#minIntervalMs;
    const wait = slot - now;
    if (wait > 0) await sleep(wait, signal);
  }
}

/**
 * Create a standalone limiter — e.g. one shared across the specific calls that may
 * use a higher granted limit: `validateEori(x, { rateLimiter: createEoriRateLimiter(500) })`.
 * For real pacing, create it ONCE and reuse the instance (a fresh limiter per call
 * shares no state and therefore enforces nothing).
 */
export function createEoriRateLimiter(
  requestsPerSecond: number | null = DEFAULT_REQUESTS_PER_SECOND,
): EoriRateLimiter {
  return new EoriRateLimiter(requestsPerSecond);
}

/**
 * The process-wide default limiter used by `validateEori`/`validateEoriBatch` when no
 * per-call `rateLimiter` is supplied. Reconfigured in place by `setDefaultEoriRateLimit`,
 * so this binding stays stable.
 */
export const defaultEoriRateLimiter = new EoriRateLimiter(DEFAULT_REQUESTS_PER_SECOND);

/**
 * Reconfigure the shared default limit (requests/second). `null`/`0` disables it.
 * One-liner for a process granted a higher limit: `setDefaultEoriRateLimit(500)`.
 */
export function setDefaultEoriRateLimit(requestsPerSecond: number | null): void {
  defaultEoriRateLimiter.setRate(requestsPerSecond);
}

/** Read the shared default limit (requests/second), or `null` when disabled. */
export function getDefaultEoriRateLimit(): number | null {
  return defaultEoriRateLimiter.rate;
}
// jscpd:ignore-end

// @opendpp/aeo rate-limit test — interval-scheduling limiter (Apache-2.0, (c) Opendpp UAB).
// Runs via tsx against ../src; lives outside src/ so it is not compiled into the published dist.
import test from "node:test";
import assert from "node:assert/strict";
import {
  AeoRateLimiter,
  createAeoRateLimiter,
  setDefaultAeoRateLimit,
  getDefaultAeoRateLimit,
  DEFAULT_REQUESTS_PER_SECOND,
} from "../src/index.ts";

test("default cap is the EU service limit (100/s)", () => {
  assert.equal(DEFAULT_REQUESTS_PER_SECOND, 100);
  assert.equal(getDefaultAeoRateLimit(), 100);
});

test("a single acquire never waits", async () => {
  const limiter = createAeoRateLimiter(5); // 200ms interval
  const start = Date.now();
  await limiter.acquire();
  assert.ok(Date.now() - start < 50, "first acquire should be immediate");
});

test("concurrent acquires are paced to the rate", async () => {
  const rps = 50; // 20ms interval
  const n = 5;
  const limiter = createAeoRateLimiter(rps);
  const start = Date.now();
  await Promise.all(Array.from({ length: n }, () => limiter.acquire()));
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= (n - 1) * (1000 / rps) - 5, `expected >= ~80ms, got ${elapsed}ms`);
});

test("a disabled limiter does not pace", async () => {
  const limiter = createAeoRateLimiter(null);
  assert.equal(limiter.rate, null);
  const start = Date.now();
  await Promise.all(Array.from({ length: 25 }, () => limiter.acquire()));
  assert.ok(Date.now() - start < 30, "disabled limiter should be ~instant");
});

test("setRate switches between a custom limit and disabled", () => {
  const limiter = new AeoRateLimiter(10);
  assert.equal(limiter.rate, 10);
  limiter.setRate(0);
  assert.equal(limiter.rate, null);
  limiter.setRate(-1);
  assert.equal(limiter.rate, null);
  limiter.setRate(500);
  assert.equal(limiter.rate, 500);
});

test("acquire rejects when the caller's signal aborts while waiting", async () => {
  const limiter = createAeoRateLimiter(1); // 1s interval → 2nd acquire must wait ~1s
  await limiter.acquire();
  const ac = new AbortController();
  const pending = limiter.acquire(ac.signal);
  ac.abort(new Error("cancelled"));
  await assert.rejects(pending, /cancelled/);
});

test("the shared default limit is overridable globally", () => {
  const original = getDefaultAeoRateLimit();
  try {
    setDefaultAeoRateLimit(500);
    assert.equal(getDefaultAeoRateLimit(), 500);
    setDefaultAeoRateLimit(null);
    assert.equal(getDefaultAeoRateLimit(), null);
  } finally {
    setDefaultAeoRateLimit(original);
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldReuseTimedCache,
  shouldReuseUsageSummary,
} from "../electron/usage-collector.ts";

test("shouldReuseUsageSummary keeps historical dates hot indefinitely in-process", () => {
  const now = new Date("2026-03-21T12:00:00Z").getTime();
  const cachedAt = new Date("2026-03-20T00:00:00Z").getTime();

  assert.equal(
    shouldReuseUsageSummary("2026-03-20", cachedAt, now),
    true,
  );
});

test("shouldReuseUsageSummary expires today's cache after its ttl", () => {
  const now = new Date("2026-03-21T12:00:31Z").getTime();
  const cachedAt = new Date("2026-03-21T12:00:00Z").getTime();

  assert.equal(
    shouldReuseUsageSummary("2026-03-21", cachedAt, now),
    false,
  );
});

test("shouldReuseTimedCache respects ttl windows", () => {
  const cachedAt = 1_000;
  assert.equal(shouldReuseTimedCache(cachedAt, 500, 1_400), true);
  assert.equal(shouldReuseTimedCache(cachedAt, 500, 1_501), false);
});

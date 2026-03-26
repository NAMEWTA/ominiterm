import test from "node:test";
import assert from "node:assert/strict";

import {
  HEATMAP_LAYOUT,
  hasMonthLabelBottomClearance,
} from "../src/components/usage/heatmap-layout.ts";

test("heatmap month label row keeps a full grid gap below the label text", () => {
  assert.equal(hasMonthLabelBottomClearance(), true);
  assert.ok(HEATMAP_LAYOUT.monthLabelRowHeight > HEATMAP_LAYOUT.monthLabelLineHeight);
  assert.ok(
    HEATMAP_LAYOUT.monthLabelRowHeight - HEATMAP_LAYOUT.monthLabelLineHeight >= HEATMAP_LAYOUT.gridGap,
  );
});

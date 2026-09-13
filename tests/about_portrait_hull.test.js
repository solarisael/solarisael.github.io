import { expect, test } from "bun:test";

import { slot_for_line } from "../src/scripts/about/portrait_hull.js";

const root_rect = { top: 0, width: 1000 };
const image_rect = { top: 200, bottom: 800 };

for (const [label, line_top] of [
  ["above", 80],
  ["below", 820],
]) {
  test(`keeps ${label} lines on their assigned side of the portrait`, () => {
    const left = slot_for_line("left", root_rect, image_rect, line_top, 20);
    const right = slot_for_line("right", root_rect, image_rect, line_top, 20);

    expect(left.left).toBe(12);
    expect(left.right).toBe(488);
    expect(right.left).toBe(512);
    expect(right.right).toBe(988);
    expect(left.right).toBeLessThan(right.left);
  });
}

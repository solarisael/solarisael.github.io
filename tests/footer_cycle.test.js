import { describe, expect, test } from "bun:test";

import {
  FOOTER_SENTENCES,
  resolve_footer_sentences,
} from "../src/data/footer_sentences.js";
import { PRETEXT_TRANSITION_EFFECTS } from "scripts-of-folly/transitions";
import {
  next_footer_index,
  previous_footer_index,
} from "../src/scripts/footer_cycle.js";

const alignments = new Set(["start", "center", "end"]);

// The table is intentionally data-driven so adding a row cannot bypass these invariants.
describe("footer sentence data", () => {
  test("uses phase rows and shared fallback", () => {
    expect(resolve_footer_sentences("nigredo")).toBe(FOOTER_SENTENCES.nigredo);
    expect(resolve_footer_sentences("albedo")).toBe(FOOTER_SENTENCES.shared);
    expect(resolve_footer_sentences("unknown")).toBe(FOOTER_SENTENCES.shared);
  });

  test("every row has renderable content and a known transition", () => {
    for (const rows of Object.values(FOOTER_SENTENCES)) {
      for (const row of rows) {
        expect(typeof row.html).toBe("string");
        expect(row.html.trim().length).toBeGreaterThan(0);
        expect(alignments.has(row.align)).toBe(true);
        expect(PRETEXT_TRANSITION_EFFECTS[row.effect]).toBeDefined();
      }
    }
  });
});

describe("footer cycle index", () => {
  test("advances through every row and wraps to row zero", () => {
    const row_count = 4;
    let index = 0;
    const seen = [];
    for (let step = 0; step < row_count; step += 1) {
      index = next_footer_index(index, row_count);
      seen.push(index);
    }
    expect(seen).toEqual([1, 2, 3, 0]);
    expect(next_footer_index(0, 0)).toBe(0);
  });

  test("steps backward and wraps to the last row", () => {
    expect(previous_footer_index(0, 4)).toBe(3);
    expect(previous_footer_index(2, 4)).toBe(1);
    expect(previous_footer_index(0, 0)).toBe(0);
  });
});

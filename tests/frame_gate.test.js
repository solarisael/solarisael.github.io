import { describe, expect, test } from "bun:test";
import { SITE_FPS_DEFAULT } from "../public/js/modules/menu/preferences.js";
import { create_frame_gate } from "../src/scripts/gpu/frame_gate.js";

const supplied_ticks = (refresh_rate) =>
  Array.from(
    { length: refresh_rate },
    (_, index) => (index * 1000) / refresh_rate,
  );

const admitted_ticks = (gate, ticks) => ticks.filter((now) => gate.due(now));

describe("create_frame_gate", () => {
  test.each([
    ["60", 60],
    ["120", 120],
    ["display", 240],
  ])("paces %s on a 240Hz display", (limit, expected_frames) => {
    const gate = create_frame_gate(() => limit);
    const frames = admitted_ticks(gate, supplied_ticks(240));

    expect(frames).toHaveLength(expected_frames);
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBeGreaterThan(975);
  });

  test("preserves 60 FPS when display ticks do not divide evenly", () => {
    const gate = create_frame_gate(() => "60");

    expect(admitted_ticks(gate, supplied_ticks(144))).toHaveLength(60);
  });

  test("cannot manufacture 120 frames from a 60Hz display", () => {
    const ticks = supplied_ticks(60);
    const gate = create_frame_gate(() => "120");

    expect(admitted_ticks(gate, ticks)).toEqual(ticks);
  });

  test.each([undefined, null, "", "0", "invalid", "240", "120fps"])(
    "falls back to the default for %p",
    (limit) => {
      const ticks = supplied_ticks(240);
      const gate = create_frame_gate(() => limit);
      const default_gate = create_frame_gate(() => SITE_FPS_DEFAULT);

      expect(admitted_ticks(gate, ticks)).toEqual(
        admitted_ticks(default_gate, ticks),
      );
    },
  );

  test("resumes after a long gap without replaying missed frames", () => {
    const gate = create_frame_gate(() => "60");

    expect(gate.due(0)).toBe(true);
    expect(gate.due(10_000)).toBe(true);
    expect(admitted_ticks(gate, [10_001, 10_004, 10_008, 10_012])).toEqual([]);
    expect(gate.due(10_017)).toBe(true);
  });

  test("reset admits immediately rather than retaining the old deadline", () => {
    const gate = create_frame_gate(() => "60");

    expect(gate.due(0)).toBe(true);
    expect(gate.due(1)).toBe(false);

    gate.reset();

    expect(gate.due(1)).toBe(true);
    expect(gate.due(2)).toBe(false);
    expect(gate.due(18)).toBe(true);
  });

  test("applies faster, slower, and display limits without a catch-up burst", () => {
    let limit = "60";
    const gate = create_frame_gate(() => limit);

    expect(gate.due(0)).toBe(true);
    expect(gate.due(4)).toBe(false);

    limit = "120";

    expect(gate.due(4)).toBe(true);
    expect(admitted_ticks(gate, [5, 6, 8, 10])).toEqual([]);
    expect(gate.due(12.5)).toBe(true);

    limit = "60";

    expect(gate.due(13)).toBe(true);
    expect(admitted_ticks(gate, [14, 18, 22, 26])).toEqual([]);
    expect(gate.due(30)).toBe(true);

    limit = "display";

    expect(admitted_ticks(gate, [31, 32, 33])).toEqual([31, 32, 33]);
  });
});

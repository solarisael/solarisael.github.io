import { describe, expect, test } from "bun:test";
import {
  effect_pixel_budget,
  resize_effect_surface,
} from "../src/scripts/gpu/render_size.js";

const create_surface = () => ({
  size: [0, 0],
  resize_calls: [],
  resize(size) {
    this.resize_calls.push(size);
    this.size = size;
  },
});

describe("resize_effect_surface", () => {
  test("fits an oversized viewport within the pixel budget without changing its aspect", () => {
    const surface = create_surface();
    const pixel_budget = 20_000;

    resize_effect_surface(surface, [800, 400], pixel_budget);

    expect(surface.size).toEqual([200, 100]);
    expect(surface.size[0] * surface.size[1]).toBeLessThanOrEqual(pixel_budget);
    expect(surface.resize_calls).toEqual([[200, 100]]);
  });

  test("does not upscale a viewport already within budget", () => {
    const surface = create_surface();

    resize_effect_surface(surface, [12, 7], 1_000);

    expect(surface.size).toEqual([12, 7]);
  });

  test("keeps a zero-sized viewport renderable at one pixel", () => {
    const surface = create_surface();

    resize_effect_surface(surface, [0, 0], 64);

    expect(surface.size).toEqual([1, 1]);
  });

  test.each([
    [1_000_000, 1],
    [1, 1_000_000],
  ])("keeps a thin %i by %i viewport within budget", (width, height) => {
    const surface = create_surface();
    const pixel_budget = 64;

    resize_effect_surface(surface, [width, height], pixel_budget);

    const [render_width, render_height] = surface.size;
    expect(Number.isInteger(render_width)).toBe(true);
    expect(Number.isInteger(render_height)).toBe(true);
    expect(render_width).toBeGreaterThanOrEqual(1);
    expect(render_height).toBeGreaterThanOrEqual(1);
    expect(render_width).toBeLessThanOrEqual(width);
    expect(render_height).toBeLessThanOrEqual(height);
    expect(render_width * render_height).toBeGreaterThan(1);
    expect(render_width * render_height).toBeLessThanOrEqual(pixel_budget);
  });

  test("does not resize again when the backing size stays unchanged", () => {
    const surface = create_surface();

    resize_effect_surface(surface, [800, 400], 20_000);
    resize_effect_surface(surface, [800, 400], 20_000);
    resize_effect_surface(surface, [1_600, 800], 20_000);

    expect(surface.size).toEqual([200, 100]);
    expect(surface.resize_calls).toEqual([[200, 100]]);
  });

  test("resizes when either viewport dimension changes the aspect", () => {
    const surface = create_surface();

    resize_effect_surface(surface, [12, 7], 1_000);
    resize_effect_surface(surface, [12, 9], 1_000);
    resize_effect_surface(surface, [15, 9], 1_000);

    expect(surface.size).toEqual([15, 9]);
    expect(surface.resize_calls).toEqual([
      [12, 7],
      [12, 9],
      [15, 9],
    ]);
  });
});

describe("effect_pixel_budget", () => {
  test.each(["ink", "glass"])(
    "%s never loses budget as the viewport grows",
    (effect) => {
      const resolutions = [
        [320, 180],
        [800, 600],
        [1000, 1000],
        [1001, 1000],
        [1600, 1000],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
        [5120, 2880],
        [7680, 4320],
      ];
      let previous_budget = 0;

      for (const resolution of resolutions) {
        const budget = effect_pixel_budget(effect, resolution);

        expect(budget).toBeGreaterThanOrEqual(previous_budget);
        expect(budget).toBeLessThanOrEqual(resolution[0] * resolution[1]);
        previous_budget = budget;
      }
    },
  );

  test.each(["ink", "glass"])(
    "%s keeps a small surface native rather than upscaling it",
    (effect) => {
      const surface = create_surface();
      const resolution = [24, 13];
      const budget = effect_pixel_budget(effect, resolution);

      resize_effect_surface(surface, resolution, budget);

      expect(budget).toBe(resolution[0] * resolution[1]);
      expect(surface.size).toEqual(resolution);
    },
  );

  test.each(["ink", "glass"])(
    "%s gives a larger screen more actual backing pixels",
    (effect) => {
      const smaller_resolution = [1280, 720];
      const larger_resolution = [3840, 2160];
      const smaller_budget = effect_pixel_budget(effect, smaller_resolution);
      const larger_budget = effect_pixel_budget(effect, larger_resolution);
      const smaller_surface = create_surface();
      const larger_surface = create_surface();

      resize_effect_surface(
        smaller_surface,
        smaller_resolution,
        smaller_budget,
      );
      resize_effect_surface(larger_surface, larger_resolution, larger_budget);

      expect(larger_budget).toBeGreaterThan(smaller_budget);
      expect(larger_surface.size[0] * larger_surface.size[1]).toBeGreaterThan(
        smaller_surface.size[0] * smaller_surface.size[1],
      );
    },
  );

  test("rejects an unknown effect rather than borrowing another effect's budget", () => {
    expect(() => effect_pixel_budget("unknown", [1920, 1080])).toThrow(
      RangeError,
    );
  });
});

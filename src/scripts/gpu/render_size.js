const pixel_tiers = [
  { area: 1000000, ink: 98304, glass_scale: 1 },
  { area: 3000000, ink: 163840, glass_scale: 0.75 },
  { area: 8500000, ink: 262144, glass_scale: 0.75 },
  { area: Infinity, ink: 524288, glass_scale: 0.75 },
];

export const effect_pixel_budget = (effect, resolution) => {
  if (effect !== "ink" && effect !== "glass") {
    throw new RangeError(`Unknown effect: ${effect}`);
  }

  const width = Math.max(resolution[0], 1);
  const height = Math.max(resolution[1], 1);
  const area = width * height;
  const tier = pixel_tiers.find((tier) => area <= tier.area);

  if (effect === "ink") return Math.min(area, tier.ink);

  const native_floor = Math.min(area, pixel_tiers[0].area);
  const scaled_area = area * tier.glass_scale * tier.glass_scale;

  return Math.min(Math.max(native_floor, scaled_area), 8388608);
};

export const resize_effect_surface = (surface, resolution, pixel_budget) => {
  const width = Math.max(resolution[0], 1);
  const height = Math.max(resolution[1], 1);
  const scale = Math.min(
    1,
    Math.sqrt(pixel_budget / (width * height)),
    pixel_budget / width,
    pixel_budget / height,
  );
  const render_width = Math.max(1, Math.floor(width * scale));
  const render_height = Math.max(1, Math.floor(height * scale));
  const size = surface.size;

  if (size[0] !== render_width || size[1] !== render_height) {
    surface.resize([render_width, render_height]);
  }
};

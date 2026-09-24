const ORNAMENT_SELECTOR = "ornament[data-position]";
const VIEWPORT_BLEED = 96;
const ORNAMENT_TRANSFORMS = new Map([
  ["container:northeast", 1],
  ["container:southwest", 2],
  ["container:southeast", 3],
  ["container:west", 4],
  ["container:east", 5],
  ["phase-card:east", 3],
]);

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const normalized_source = (source) => {
  if (!source) return null;

  const url = new URL(source, document.baseURI);
  url.hash = "";
  return url.href;
};

const ornament_source = (ornament) => {
  const graphic = ornament.firstElementChild;
  if (graphic instanceof HTMLImageElement) {
    return normalized_source(graphic.currentSrc || graphic.src);
  }

  return normalized_source(graphic?.querySelector("use")?.getAttribute("href"));
};

const ornament_transform = (ornament) => {
  const shape = ornament.closest(".sol__mantle_frame")?.dataset.shape;
  const position = ornament.dataset.position;

  return ORNAMENT_TRANSFORMS.get(`${shape}:${position}`) ?? 0;
};

const fitted_bounds = (bounds, entry, transform) => {
  const rotated = transform === 4 || transform === 5;
  const box_width = rotated ? bounds.height : bounds.width;
  const box_height = rotated ? bounds.width : bounds.height;
  const scale = Math.min(box_width / entry.width, box_height / entry.height);
  let width = entry.width * scale;
  let height = entry.height * scale;

  if (rotated) [width, height] = [height, width];

  return {
    left: bounds.left + (bounds.width - width) * 0.5,
    top: bounds.top + (bounds.height - height) * 0.5,
    width,
    height,
    right: bounds.left + (bounds.width + width) * 0.5,
    bottom: bounds.top + (bounds.height + height) * 0.5,
  };
};

const bounds_in_viewport = (bounds, viewport_width, viewport_height) =>
  bounds.width > 0 &&
  bounds.height > 0 &&
  bounds.right >= -VIEWPORT_BLEED &&
  bounds.bottom >= -VIEWPORT_BLEED &&
  bounds.left <= viewport_width + VIEWPORT_BLEED &&
  bounds.top <= viewport_height + VIEWPORT_BLEED;

const ornament_intensity = (ornament) => {
  const phase_card = ornament.closest('mantle[data-shape="phase-card"]');
  if (phase_card?.querySelector(".sol__phase_card_disabled")) return 0.44;

  return phase_card ? 0.82 : 1;
};

const write_actor = (actor_data, index, ornament, entry, canvas_bounds) => {
  const transform = ornament_transform(ornament);
  const bounds = fitted_bounds(
    ornament.getBoundingClientRect(),
    entry,
    transform,
  );
  if (!bounds_in_viewport(bounds, canvas_bounds.width, canvas_bounds.height)) {
    return false;
  }

  const offset = index * ACTOR_FLOATS;
  actor_data[offset] = bounds.left - canvas_bounds.left + bounds.width * 0.5;
  actor_data[offset + 1] = bounds.top - canvas_bounds.top + bounds.height * 0.5;
  actor_data[offset + 2] = bounds.width;
  actor_data[offset + 3] = bounds.height;
  actor_data.set(entry.uv, offset + 4);
  actor_data[offset + 8] = clamp(
    Math.min(bounds.width, bounds.height) * 0.85,
    8,
    24,
  );
  actor_data[offset + 9] = ornament_intensity(ornament);
  actor_data[offset + 10] = transform;
  return true;
};

export const MAX_GLOWS = 64;
export const ACTOR_FLOATS = 12;

export const ornament_sources = (host) =>
  Array.from(host.querySelectorAll(ORNAMENT_SELECTOR), ornament_source).filter(
    Boolean,
  );

export const write_mantle_glow_actors = (
  host,
  atlas_entries,
  canvas_bounds,
  actor_data,
) => {
  let count = 0;

  for (const ornament of host.querySelectorAll(ORNAMENT_SELECTOR)) {
    if (count === MAX_GLOWS) break;

    const entry = atlas_entries.get(ornament_source(ornament));
    if (
      entry &&
      write_actor(actor_data, count, ornament, entry, canvas_bounds)
    ) {
      count += 1;
    }
  }

  return count;
};

import { WATER_OPTICS, water_transmission } from "./water_optics.js";
import { create_frame_gate } from "./gpu/frame_gate.js";

const fields = new WeakMap();
const LIMIT = 16;
const owned_styles = ["translate", "scale", "opacity", "filter"];

const number = (element, key, fallback, min, max) => {
  const value = Number.parseFloat(element.dataset[key]);
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
};

export const sample_element_depth = (uniforms, x, y, result) => {
  result.depth = result.x = result.y = 0;
  for (let index = 0; index < uniforms.depth_count; index++) {
    const [cx, cy, rx, ry] = uniforms.depth_regions[index];
    const [strength, inner] = uniforms.depth_params[index];
    const dx = x - cx;
    const dy = y - cy;
    const q = Math.hypot(dx / rx, dy / ry);
    if (q >= 1) continue;
    const t = Math.min(1, (1 - q) / (1 - inner));
    const depth = strength * t * t * (3 - 2 * t);
    if (depth <= result.depth) continue;
    const slope =
      (-strength * 6 * t * (1 - t)) / ((1 - inner) * Math.max(q, 0.0001));
    result.depth = depth;
    result.x = (slope * dx) / (rx * rx);
    result.y = (slope * dy) / (ry * ry);
  }
  return result;
};

const restore_glyph = (glyph) => {
  if (!glyph.changed) return;
  for (const property of owned_styles)
    glyph.node.style.removeProperty(property);
  glyph.changed = false;
};

const create_field = (menu) => {
  const tablet = menu.querySelector("sol-obsidian-tablet");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const frame_gate = create_frame_gate();
  const uniforms = {
    depth_regions: Array.from({ length: LIMIT }, () => [0, 0, 1, 1]),
    depth_params: Array.from({ length: LIMIT }, () => [0, 0, 0, 0]),
    depth_count: 0,
  };
  let targets = [],
    glyphs = [],
    frame = null;
  let dirty = true,
    disposed = false,
    warned = false;
  const active = () =>
    !disposed &&
    menu.isConnected &&
    !document.hidden &&
    menu.dataset.sideMenuOpen === "true" &&
    menu.dataset.portalPhase === "artifact";
  const collect = () => {
    for (const glyph of glyphs) restore_glyph(glyph);
    targets = [...tablet.querySelectorAll("[data-depth-region]")];
    glyphs = [...tablet.querySelectorAll("[data-depth-glyph]")]
      .filter((node) => !node.closest("[data-depth-exempt]"))
      .map((node) => ({
        node,
        changed: false,
        water_depth:
          node.parentElement.dataset.glyphDepth === "far"
            ? WATER_OPTICS.far_depth
            : WATER_OPTICS.near_depth,
        sample: { depth: 0, x: 0, y: 0 },
      }));
    dirty = false;
  };
  const measure = () => {
    if (dirty) collect();
    const origin = tablet.getBoundingClientRect();
    const rim =
      Number.parseFloat(
        getComputedStyle(tablet).getPropertyValue("--obsidian-rim-width"),
      ) || 0;
    let count = 0;
    for (const element of targets) {
      if (
        !element.isConnected ||
        element.closest('[inert], [aria-hidden="true"]')
      )
        continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || !element.checkVisibility()) continue;
      if (count === LIMIT) {
        if (!warned)
          console.warn(
            `Element depth supports at most ${LIMIT} visible regions; additional regions are inactive.`,
          );
        warned = true;
        break;
      }
      const cx = rect.left + rect.width / 2 - origin.left;
      const cy = rect.top + rect.height / 2 - origin.top;
      const padding = number(element, "depthPadding", 24, 0, 160);
      const rx = Math.min(
        rect.width / 2 + padding,
        cx - rim,
        origin.width - rim - cx,
      );
      const ry = Math.min(
        rect.height / 2 + padding,
        cy - rim,
        origin.height - rim - cy,
      );
      if (rx <= 0 || ry <= 0) continue;
      const region = uniforms.depth_regions[count];
      region[0] = cx;
      region[1] = cy;
      region[2] = rx;
      region[3] = ry;
      const params = uniforms.depth_params[count];
      params[0] = number(element, "depth", 60, 0, 256);
      params[1] = number(element, "depthInner", 0.35, 0, 0.9);
      count++;
    }
    uniforms.depth_count = count;
    if (motion.matches) menu.dispatchEvent(new Event("sol:depth-change"));
    return origin;
  };
  const project_glyphs = (origin) => {
    // Read animated outer boxes before writing the separate inner projections.
    for (const glyph of glyphs) {
      const rect = glyph.node.parentElement.getBoundingClientRect();
      sample_element_depth(
        uniforms,
        rect.left + rect.width / 2 - origin.left,
        rect.top + rect.height / 2 - origin.top,
        glyph.sample,
      );
      if (!rect.width || !rect.height) glyph.sample.depth = 0;
    }
    for (const glyph of glyphs) {
      const { depth, x, y } = glyph.sample;
      if (depth === 0) {
        restore_glyph(glyph);
        continue;
      }
      glyph.node.style.translate = `${-x * 6}px ${depth * 0.42 - y * 6}px`;
      glyph.node.style.scale = String(1 / (1 + depth / 72));
      glyph.node.style.opacity = String(
        water_transmission(glyph.water_depth + depth),
      );
      glyph.node.style.filter = `blur(${depth * 0.015}px)`;
      glyph.changed = true;
    }
  };
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    frame_gate.reset();
  };
  const request = () => {
    if (frame === null && active()) frame = requestAnimationFrame(draw);
  };
  function draw(now) {
    frame = null;
    if (!active()) return;
    if (!motion.matches && !frame_gate.due(now)) {
      request();
      return;
    }

    const origin = measure();
    if (motion.matches) {
      for (const glyph of glyphs) restore_glyph(glyph);
    } else project_glyphs(origin);

    if (!motion.matches) request();
  }
  const sync = () => {
    cancel();
    if (active()) request();
    else for (const glyph of glyphs) restore_glyph(glyph);
  };
  const changes = new MutationObserver((records) => {
    for (const record of records) {
      if (
        record.type === "attributes" ||
        [...record.addedNodes, ...record.removedNodes].some(
          (node) => node.nodeType === 1,
        )
      ) {
        dirty = true;
        sync();
        break;
      }
    }
  });
  changes.observe(menu, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "data-depth-region",
      "data-depth",
      "data-depth-padding",
      "data-depth-inner",
      "data-depth-exempt",
      "data-side-menu-open",
      "data-portal-phase",
      "data-side-menu-view",
      "inert",
      "aria-hidden",
    ],
  });
  const resize = new ResizeObserver(sync);
  resize.observe(tablet);
  menu.addEventListener("scroll", sync, true);
  motion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  sync();
  return {
    uniforms,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      changes.disconnect();
      resize.disconnect();
      menu.removeEventListener("scroll", sync, true);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      for (const glyph of glyphs) restore_glyph(glyph);
      uniforms.depth_count = 0;
    },
  };
};

export const acquire_element_depth = (menu) => {
  let entry = fields.get(menu);
  if (!entry) {
    entry = { field: create_field(menu), leases: 0 };
    fields.set(menu, entry);
  }
  entry.leases++;
  let released = false;
  return {
    field: entry.field,
    release() {
      if (released) return;
      released = true;
      if (--entry.leases === 0) {
        entry.field.dispose();
        fields.delete(menu);
      }
    },
  };
};

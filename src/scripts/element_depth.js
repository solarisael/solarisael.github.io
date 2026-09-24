import { create_frame_gate } from "./gpu/frame_gate.js";

const fields = new WeakMap();
const LIMIT = 16;

const number = (element, key, fallback, min, max) => {
  const value = Number.parseFloat(element.dataset[key]);
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
};

// The field only measures: the obsidian glass and the portal flock read these
// uniforms by reference and sink into the regions on the GPU.
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
    targets = [...tablet.querySelectorAll("[data-depth-region]")];
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

    measure();

    if (!motion.matches) request();
  }
  const sync = () => {
    cancel();
    if (active()) request();
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

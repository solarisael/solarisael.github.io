import { acquire_element_depth } from "./element_depth.js";
import { create_obsidian_button_geometry } from "./obsidian_button_geometry.js";
import { create_frame_gate } from "./gpu/frame_gate.js";
import { ensure_portal_ink_values } from "./portal_ink_state.js";

const load_obsidian_gpu = async (canvas, options) => {
  const { create_obsidian_gpu } = await import("./obsidian_gpu.js");
  return create_obsidian_gpu(canvas, options);
};

export const create_obsidian_runtime = ({
  owner,
  menu,
  canvas,
  load_gpu = load_obsidian_gpu,
}) => {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const frame_gate = create_frame_gate();
  const depth = acquire_element_depth(menu);
  const button_geometry = create_obsidian_button_geometry(owner);
  const values = {
    resolution: [0, 0],
    tablet_size: [0, 0],
    tablet_origin: [0, 0],
    field_offset: [0, 0],
    halo: 0,
    rim: 0,
    time: 0,
    sdr: 1,
    scheme: 0,
    ...depth.field.uniforms,
    button_regions: Array.from({ length: 16 }, () => [0, 0, 0, 0]),
    button_bounds: [0, 0, 0, 0],
    button_count: 0,
  };
  let backend = null,
    pending = false,
    disposed = false,
    failed = false,
    activated = false,
    dirty = true,
    needs_frame = true,
    frame = null,
    last_frame = null,
    elapsed = 0;
  owner.dataset.obsidianRenderer = "static";
  let was_open = false;

  const active = () =>
    !disposed &&
    !failed &&
    owner.isConnected &&
    !document.hidden &&
    menu.dataset.sideMenuOpen === "true" &&
    menu.dataset.portalPhase === "artifact";

  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    last_frame = null;
    frame_gate.reset();
  };
  const release = () => {
    const current = backend;
    backend = null;
    current?.dispose();
  };
  const fail = (error) => {
    if (disposed || failed) return;
    failed = true;
    cancel();
    owner.dataset.obsidianRenderer = "static";
    owner.dataset.obsidianError =
      error instanceof Error
        ? error.message
        : String(error ?? "Unknown WebGPU failure");
    console.error("[obsidian] VGPU runtime failed", error);
    release();
  };
  const measure = () => {
    const surface = canvas.getBoundingClientRect();
    const tablet = owner.getBoundingClientRect();
    values.resolution[0] = surface.width;
    values.resolution[1] = surface.height;
    values.tablet_size[0] = tablet.width;
    values.tablet_size[1] = tablet.height;
    values.tablet_origin[0] = tablet.left - surface.left;
    values.tablet_origin[1] = tablet.top - surface.top;
    const style = getComputedStyle(owner);
    const halo = style.getPropertyValue("--obsidian-halo").trim();
    const unit = halo.endsWith("rem")
      ? parseFloat(getComputedStyle(document.documentElement).fontSize)
      : 1;
    values.halo = parseFloat(halo) * unit;
    values.rim =
      parseFloat(style.getPropertyValue("--obsidian-rim-width")) || 0;
    values.sdr = document.documentElement.dataset.siteDisplay === "hdr" ? 0 : 1;
    values.scheme =
      document.documentElement.dataset.siteScheme === "dark" ? 1 : 0;

    button_geometry.measure(tablet, values);
    dirty = false;
  };
  const request = () => {
    if (!active() || !backend || frame !== null) return;
    if (motion.matches && !needs_frame) return;
    const scheduled = requestAnimationFrame((now) => {
      if (frame !== scheduled) return;
      frame = null;
      draw(now);
    });
    frame = scheduled;
  };
  const empty_size = () =>
    values.resolution[0] <= 0 ||
    values.resolution[1] <= 0 ||
    values.tablet_size[0] <= 0 ||
    values.tablet_size[1] <= 0;

  const update_time = (now) => {
    if (!motion.matches && last_frame !== null) elapsed += now - last_frame;
    last_frame = now;
    values.time = motion.matches ? 0 : elapsed / 1000;
  };

  const render = () => {
    values.depth_count = depth.field.uniforms.depth_count;
    try {
      backend.render(values);
    } catch (error) {
      fail(error);
      return;
    }
    if (!active() || !backend) return;
    owner.dataset.obsidianRenderer = "webgpu";
    needs_frame = false;
    if (!motion.matches) request();
  };

  function draw(now) {
    if (!active() || !backend) {
      activated = false;
      cancel();
      return;
    }
    if (!motion.matches && !frame_gate.due(now)) {
      request();
      return;
    }
    if (dirty) measure();
    if (empty_size()) {
      last_frame = null;
      return;
    }
    update_time(now);
    render();
  }
  const initialize = async () => {
    if (pending || backend || !active()) return;
    pending = true;
    owner.dataset.obsidianRenderer = "loading";
    try {
      const loaded = await load_gpu(canvas, {
        on_error: fail,
        ink: ensure_portal_ink_values(menu),
      });
      if (disposed || failed) {
        loaded.dispose();
        return;
      }
      backend = loaded;
      delete owner.dataset.obsidianError;
      sync();
    } catch (error) {
      fail(error);
    } finally {
      pending = false;
    }
  };
  function sync() {
    if (disposed || failed) return;
    const is_open = menu.dataset.sideMenuOpen === "true";
    if (is_open && !was_open) {
      values.field_offset[0] = Math.random();
      values.field_offset[1] = Math.random();
    }
    was_open = is_open;
    if (!active()) {
      activated = false;
      cancel();
      return;
    }
    if (!activated) {
      activated = true;
      dirty = true;
      needs_frame = true;
      measure();
    }
    if (backend) request();
    else void initialize();
  }
  const invalidate = () => {
    if (disposed || failed) return;
    dirty = true;
    needs_frame = true;
    sync();
  };
  const motion_change = () => {
    if (disposed || failed) return;
    cancel();
    invalidate();
  };
  const ink_change = () => {
    needs_frame = true;
    request();
  };
  const attributes = new MutationObserver(invalidate);
  attributes.observe(menu, {
    attributes: true,
    attributeFilter: [
      "data-side-menu-open",
      "data-portal-phase",
      "data-side-menu-view",
    ],
  });
  const display = new MutationObserver(invalidate);
  display.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      "data-site-display",
      "data-site-scheme",
      "data-site-fps",
      "data-site-scale",
      "data-user-text",
      "data-user-measure",
    ],
  });
  const resize = new ResizeObserver(invalidate);
  resize.observe(owner);
  resize.observe(canvas);
  button_geometry.observe(resize);
  menu.addEventListener("scroll", invalidate, true);
  document.fonts?.addEventListener("loadingdone", invalidate);
  motion.addEventListener("change", motion_change);
  menu.addEventListener("sol:depth-change", invalidate);
  menu.addEventListener("sol:ink-change", ink_change);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      attributes.disconnect();
      display.disconnect();
      resize.disconnect();
      menu.removeEventListener("scroll", invalidate, true);
      document.fonts?.removeEventListener("loadingdone", invalidate);
      motion.removeEventListener("change", motion_change);
      document.removeEventListener("visibilitychange", sync);
      menu.removeEventListener("sol:depth-change", invalidate);
      menu.removeEventListener("sol:ink-change", ink_change);
      owner.dataset.obsidianRenderer = "static";
      release();
      depth.release();
    },
  };
};

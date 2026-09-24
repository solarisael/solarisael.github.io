import { build_glyph_atlas } from "./atlas.js";
import { create_font_plan, lettering_signature } from "./font_plan.js";
import { create_text_model } from "./model.js";
import { create_moth_model } from "./moths.js";
import { observe_lettering } from "./observers.js";
import { create_frame_gate } from "../gpu/frame_gate.js";

const load_gpu = async (canvases, on_error) => {
  const { create_lettering_gpu } = await import("./gpu.js");
  return create_lettering_gpu(canvases, on_error);
};

// `depth` is the element-depth field's uniform object; its arrays are shared by
// reference so the moths sink into the same basins as the obsidian glass.
export const create_portal_lettering = (menu, depth) => {
  const canvas = menu.querySelector("[data-portal-lettering]");
  const moth_canvas = menu.querySelector("[data-portal-moths]");
  const tablet = menu.querySelector("sol-obsidian-tablet");
  const scrollport = menu.querySelector("#sol_side_menu_panel_scroll");
  const close = menu.querySelector("[data-side-menu-close]");
  const rim = close.querySelector(".sol__close_rim");
  const frame_gate = create_frame_gate();
  const values = {
    resolution: [1, 1],
    time: 0,
    scheme: 0,
    clip: [0, 0, 1, 1],
  };
  const scene = {
    resolution: [1, 1],
    offset: [0, 0],
    time: 0,
    scheme: 0,
    visible: 0,
    depth_count: 0,
    rim: [0, 0, 1, 1],
    rim_light: 0.4,
    root_size: 16,
    depth_regions: depth.depth_regions,
    depth_params: depth.depth_params,
  };
  let backend = null,
    model = null,
    flock = null,
    frame = null,
    last = null;
  let shown = false,
    disposed = false,
    failed = false,
    pending = false;
  let dirty = true,
    pending_reveal = true,
    signature = "",
    font_epoch = 0;
  let elapsed = 0,
    painted = false;
  const active = () => shown && !disposed && !failed;
  const current_signature = () => `${lettering_signature(menu)}:${font_epoch}`;
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    last = null;
    frame_gate.reset();
  };
  const restore = () => {
    shown = false;
    painted = false;
    cancel();
    menu.dataset.letteringRenderer = "static";
  };
  const fail = (error) => {
    if (failed || disposed) return;
    failed = true;
    restore();
    backend?.dispose();
    console.warn(
      "GPU lettering unavailable; the menu keeps its native text.",
      error,
    );
  };
  const request = () => {
    if (!active() || pending || frame !== null) return;
    frame = requestAnimationFrame(draw);
  };
  const initialize = async () => {
    if (backend) return;
    if (!navigator.gpu) throw new Error("WebGPU is unavailable.");
    const loaded = await load_gpu(
      { lettering: canvas, moths: moth_canvas },
      fail,
    );
    if (disposed || failed) {
      loaded.dispose();
      return;
    }
    backend = loaded;
  };
  const prepare = async () => {
    if (pending || !active()) return;
    pending = true;
    painted = false;
    menu.dataset.letteringRenderer = "loading";
    try {
      await initialize();
      if (!active()) return;
      const next_signature = current_signature();
      const plan = create_font_plan(menu);
      const atlas = build_glyph_atlas(plan.requests);
      const next = create_text_model(plan, atlas, model);
      const next_flock = create_moth_model(plan, atlas, flock);
      next.measure(canvas, scrollport, values);
      next_flock.measure(moth_canvas, tablet, rim, scene);
      await backend.prepare(
        { text: next, flock: next_flock },
        { frame: values, scene },
      );
      if (disposed || failed) return;
      next.atlas.pixels = null;
      model = next;
      flock = next_flock;
      signature = next_signature;
      dirty = true;
      last = null;
    } catch (error) {
      fail(error);
    } finally {
      pending = false;
      request();
    }
  };
  const update_layout = () => {
    model.measure(canvas, scrollport, values);
    flock.measure(moth_canvas, tablet, rim, scene);
    backend.update_layout(model);
    dirty = false;
  };
  function draw(now) {
    frame = null;
    if (!active()) return;
    if (!frame_gate.due(now)) {
      request();
      return;
    }
    if (!model || (dirty && signature !== current_signature())) {
      void prepare();
      return;
    }
    try {
      if (dirty) update_layout();
      if (last !== null) elapsed += (now - last) / 1000;
      last = now;
      values.time = elapsed;
      values.scheme =
        document.documentElement.dataset.siteScheme === "dark" ? 1 : 0;
      scene.time = elapsed;
      scene.scheme = values.scheme;
      scene.depth_count = depth.depth_count;
      scene.rim_light = close.matches(":hover, :focus-visible") ? 0.85 : 0.4;
      if (pending_reveal) {
        model.reveal(elapsed);
        model.sync_states();
        backend.update_words(model);
        pending_reveal = false;
      }
      backend.render(values, scene);
      if (!painted) {
        menu.dataset.letteringRenderer = "webgpu";
        painted = true;
      }
    } catch (error) {
      fail(error);
    }
    request();
  }
  const invalidate = (fonts = false) => {
    dirty = true;
    if (fonts) font_epoch++;
    request();
  };
  const sync_states = () => {
    if (!active() || !model || pending) return;
    if (model.sync_states()) backend.update_words(model);
  };
  const stop_observing = observe_lettering(
    menu,
    [canvas, moth_canvas],
    invalidate,
    sync_states,
  );
  restore();
  return {
    show() {
      if (disposed || failed) return;
      shown = true;
      dirty = true;
      pending_reveal = true;
      request();
    },
    reveal(route) {
      if (!active() || !model || pending) return;
      const changed = model.reveal(elapsed, route);
      if (model.sync_states() || changed) backend.update_words(model);
    },
    restore,
    dispose() {
      if (disposed) return;
      restore();
      disposed = true;
      stop_observing();
      backend?.dispose();
      model = null;
      flock = null;
      delete menu.dataset.letteringRenderer;
    },
  };
};

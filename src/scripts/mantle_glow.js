import { register_node_disposal } from "../../public/js/modules/node_disposal.js";
import {
  ACTOR_FLOATS,
  MAX_GLOWS,
  ornament_sources,
  write_mantle_glow_actors,
} from "./mantle_glow_model.js";

const HOST_SELECTOR = 'mantle[data-shape="container"]';
const CANVAS_SELECTOR = ":scope > [data-mantle-glow]";
const ORNAMENT_SELECTOR = "ornament[data-position]";
const MANTLE_GLOW_RUNTIME = Symbol.for("solarisael.mantle_glow");

const load_mantle_glow_gpu = async (canvas, options) => {
  const { create_mantle_glow_gpu } = await import("./mantle_glow_gpu.js");

  return create_mantle_glow_gpu(canvas, options);
};

export const create_mantle_glow_runtime = (
  host,
  canvas,
  load_gpu = load_mantle_glow_gpu,
) => {
  const actor_data = new Float32Array(MAX_GLOWS * ACTOR_FLOATS);
  const frame = {
    resolution: [1, 1],
    count: 0,
    intensity: 1,
  };
  let backend = null;
  let atlas_entries = null;
  let animation_frame = 0;
  let pending = false;
  let disposed = false;
  let failed = false;
  let dirty = true;

  host.dataset.mantleGlowRenderer = "static";

  const active = () =>
    !disposed && !failed && host.isConnected && canvas.isConnected;

  const cancel = () => {
    if (animation_frame) cancelAnimationFrame(animation_frame);
    animation_frame = 0;
  };

  const release = () => {
    const current = backend;
    backend = null;
    atlas_entries = null;
    current?.dispose();
  };

  const fail = (error) => {
    if (disposed || failed) return;

    failed = true;
    cancel();
    host.dataset.mantleGlowRenderer = "unavailable";
    host.dataset.mantleGlowError =
      error instanceof Error ? error.message : String(error);
    console.error("[mantle-glow] VGPU runtime failed", error);
    release();
  };

  const measure = () => {
    const canvas_bounds = canvas.getBoundingClientRect();
    const document_element = document.documentElement;

    actor_data.fill(0);
    frame.resolution[0] = canvas_bounds.width;
    frame.resolution[1] = canvas_bounds.height;
    const glow = Number.parseFloat(
      getComputedStyle(document_element).getPropertyValue(
        "--site_shell_glow_mult",
      ),
    );
    frame.intensity = Number.isFinite(glow)
      ? Math.min(2, Math.max(0, glow))
      : 1;
    frame.count = write_mantle_glow_actors(
      host,
      atlas_entries,
      canvas_bounds,
      actor_data,
    );
    dirty = false;
  };

  const render = () => {
    try {
      backend.render(frame, actor_data);
    } catch (error) {
      fail(error);
      return;
    }

    host.dataset.mantleGlowRenderer = "vgpu";
  };

  const draw = () => {
    animation_frame = 0;
    if (!active() || !backend) return;

    if (dirty) measure();
    if (frame.resolution[0] <= 0 || frame.resolution[1] <= 0) return;

    render();
  };

  const request = () => {
    if (!active() || !backend || animation_frame) return;

    if (document.hidden) {
      draw();
      return;
    }

    animation_frame = requestAnimationFrame(draw);
  };

  const initialize = async () => {
    if (pending || backend || !active()) return;

    if (!navigator.gpu) {
      fail(new Error("WebGPU is unavailable."));
      return;
    }

    pending = true;
    host.dataset.mantleGlowRenderer = "loading";

    try {
      const loaded = await load_gpu(canvas, {
        sources: ornament_sources(host),
        on_error: fail,
        on_state: (state) => {
          host.dataset.mantleGlowGpuState = state;
        },
      });
      if (disposed || failed) {
        loaded.dispose();
        return;
      }

      backend = loaded;
      atlas_entries = loaded.atlas_entries;
      dirty = true;
      request();
    } catch (error) {
      fail(error);
    } finally {
      pending = false;
    }
  };

  const sync = () => {
    if (!active()) {
      cancel();
      return;
    }

    if (backend) request();
    else void initialize();
  };

  const invalidate = () => {
    if (disposed || failed) return;

    dirty = true;
    sync();
  };

  const resize_observer = new ResizeObserver(invalidate);
  resize_observer.observe(host);
  resize_observer.observe(canvas);
  for (const ornament of host.querySelectorAll(ORNAMENT_SELECTOR)) {
    resize_observer.observe(ornament);
  }

  const display_observer = new MutationObserver(invalidate);
  display_observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });

  window.addEventListener("resize", invalidate);
  window.addEventListener("scroll", invalidate, { passive: true });
  document.fonts?.ready.then(invalidate);
  sync();

  return {
    dispose() {
      if (disposed) return;

      disposed = true;
      cancel();
      resize_observer.disconnect();
      display_observer.disconnect();
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("scroll", invalidate);
      release();
      host.dataset.mantleGlowRenderer = "static";
    },
  };
};

const mantle_hosts_in = (root) => {
  const hosts = Array.from(root.querySelectorAll?.(HOST_SELECTOR) ?? []);
  if (root.matches?.(HOST_SELECTOR)) hosts.unshift(root);

  return hosts;
};

export const initialize_mantle_glows = (root = document) => {
  for (const host of mantle_hosts_in(root)) {
    if (host[MANTLE_GLOW_RUNTIME]) continue;

    const canvas = host.querySelector(CANVAS_SELECTOR);
    if (!(canvas instanceof HTMLCanvasElement)) continue;

    const runtime = create_mantle_glow_runtime(host, canvas);
    let unregister = () => {};
    const dispose = () => {
      unregister();
      runtime.dispose();
      delete host[MANTLE_GLOW_RUNTIME];
    };

    unregister = register_node_disposal(host, dispose);
    host[MANTLE_GLOW_RUNTIME] = Object.freeze({ dispose });
  }
};

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => initialize_mantle_glows(document),
    { once: true },
  );
} else {
  initialize_mantle_glows(document);
}

globalThis.htmx?.onLoad(initialize_mantle_glows);

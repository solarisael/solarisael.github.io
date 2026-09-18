import { create_frame_gate } from "./gpu/frame_gate.js";

const PANEL_SELECTOR = ".sol__block_fx";

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const effect_seed = (effect_name = "window") => {
  let hash = 2166136261;

  for (const character of effect_name) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};

const load_terminal_gpu = async (canvas, options) => {
  const { create_terminal_window_gpu } =
    await import("./effect_window_terminal_gpu.js");
  return create_terminal_window_gpu(canvas, options);
};

export const create_terminal_runtime = (
  host,
  canvas,
  load_gpu = load_terminal_gpu,
) => {
  const motion_query = matchMedia("(prefers-reduced-motion: reduce)");
  const frame_gate = create_frame_gate();
  const panel = host.querySelector(PANEL_SELECTOR);
  const values = {
    resolution: [1, 1],
    time: 0,
    intensity: 1,
    motion: 1,
    scheme: 0,
    seed: effect_seed(host.dataset.effectWindow),
    rune_count: 1,
    frame_inset: [16, 16],
    halo_radius: 12,
    frame_radius: 6,
  };
  let backend = null;
  let animation_frame = 0;
  let last_frame = null;
  let elapsed = 0;
  let pending = false;
  let disposed = false;
  let failed = false;
  let visible = true;
  let dirty = true;
  let needs_frame = true;

  host.dataset.effectWindowRenderer = "static";

  const active = () =>
    !disposed && !failed && visible && host.isConnected && !document.hidden;

  const cancel = () => {
    if (animation_frame) cancelAnimationFrame(animation_frame);
    animation_frame = 0;
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
    release();
    host.dataset.effectWindowRenderer = "static";
    host.dataset.effectWindowError =
      error instanceof Error ? error.message : String(error);
  };

  const measure = () => {
    const bounds = canvas.getBoundingClientRect();
    const style = getComputedStyle(panel ?? host);
    const marker_intensity =
      Number.parseFloat(
        style.getPropertyValue("--block_fx_marker_intensity"),
      ) || 1;
    const glow_multiplier =
      Number.parseFloat(style.getPropertyValue("--site_fx_glow_mult")) || 1;

    values.resolution[0] = bounds.width;
    const panel_bounds = (panel ?? host).getBoundingClientRect();
    values.frame_inset[0] = Math.max(0, panel_bounds.left - bounds.left);
    values.frame_inset[1] = Math.max(0, panel_bounds.top - bounds.top);
    values.halo_radius =
      Number.parseFloat(
        style.getPropertyValue("--effect-window-terminal-halo-radius"),
      ) || 0;
    values.frame_radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
    values.resolution[1] = bounds.height;
    values.intensity = clamp(marker_intensity * glow_multiplier, 0.2, 2);
    values.motion = clamp(
      Number.parseFloat(style.getPropertyValue("--site_fx_motion_mult")) || 1,
      0.2,
      2,
    );
    values.scheme =
      document.documentElement.dataset.siteScheme === "dark" ? 1 : 0;
    dirty = false;
  };

  const empty_size = () =>
    values.resolution[0] <= 0 || values.resolution[1] <= 0;

  const update_time = (now) => {
    if (!motion_query.matches && last_frame !== null)
      elapsed += now - last_frame;
    last_frame = now;
    values.time = motion_query.matches ? 0 : elapsed / 1000;
  };

  const request = () => {
    if (!active() || !backend || animation_frame) return;
    if (motion_query.matches && !needs_frame) return;

    animation_frame = requestAnimationFrame((now) => {
      animation_frame = 0;
      draw(now);
    });
  };

  const render = () => {
    try {
      backend.render(values);
    } catch (error) {
      fail(error);
      return;
    }

    host.dataset.effectWindowRenderer = "vgpu";
    needs_frame = false;
    if (!motion_query.matches) request();
  };

  function draw(now) {
    if (!active() || !backend) {
      cancel();
      return;
    }
    if (!motion_query.matches && !frame_gate.due(now)) {
      request();
      return;
    }

    if (dirty) measure();
    if (empty_size()) return;

    update_time(now);
    render();
  }

  const initialize = async () => {
    if (pending || backend || !active()) return;

    pending = true;
    host.dataset.effectWindowRenderer = "loading";

    try {
      const loaded = await load_gpu(canvas, {
        on_error: fail,
        on_state: (state) => {
          host.dataset.effectWindowGpuState = state;
        },
      });
      if (disposed || failed) {
        loaded.dispose();
        return;
      }

      backend = loaded;
      values.rune_count = loaded.rune_count;
      dirty = true;
      needs_frame = true;
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
    needs_frame = true;
    sync();
  };

  const motion_change = () => {
    if (disposed || failed) return;

    cancel();
    invalidate();
  };

  const resize_observer = new ResizeObserver(invalidate);
  resize_observer.observe(host);
  resize_observer.observe(canvas);

  const intersection_observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting === true;
      sync();
    },
    { rootMargin: "160px" },
  );
  intersection_observer.observe(host);

  const display_observer = new MutationObserver(invalidate);
  display_observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-site-scheme", "data-site-fx", "data-site-fps"],
  });

  motion_query.addEventListener("change", motion_change);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    dispose() {
      if (disposed) return;

      disposed = true;
      cancel();
      resize_observer.disconnect();
      intersection_observer.disconnect();
      display_observer.disconnect();
      motion_query.removeEventListener("change", motion_change);
      document.removeEventListener("visibilitychange", sync);
      release();
      host.dataset.effectWindowRenderer = "static";
    },
  };
};

import { create_ink_gpu } from "./portal_ink_gpu.js";
import { create_frame_gate } from "./gpu/frame_gate.js";
import { ensure_portal_ink_values } from "./portal_ink_state.js";

export const create_ink_shadow = (menu, panel, canvas, artifact) => {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const frame_gate = create_frame_gate();
  menu.dataset.portalInkController = "ready";
  let reveal_guard = null;
  let close_guard = null,
    closing = false,
    close_started = 0,
    close_from = 1;
  const reveal_artifact = () => {
    if (!opened || closing || disposed || !menu.isConnected) return;
    clearTimeout(reveal_guard);
    reveal_guard = null;
    if (menu.dataset.portalPhase === "artifact") return;
    menu.dataset.portalPhase = "artifact";
    artifact.inert = false;
    menu.dispatchEvent(new Event("sol:portal-revealed"));
    if (
      document.activeElement === panel ||
      document.activeElement === document.body
    ) {
      menu
        .querySelector("[data-side-menu-close]")
        ?.focus({ preventScroll: true });
    }
  };
  let failed = false,
    disposed = false,
    opened = false;
  let frame = null,
    last_frame = null,
    elapsed = 0,
    reveal_started = 0;
  const active = () =>
    !disposed && !failed && opened && menu.isConnected && !document.hidden;
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    last_frame = null;
    frame_gate.reset();
  };
  const finish_close = () => {
    opened = false;
    closing = false;
    clearTimeout(close_guard);
    close_guard = null;
    cancel();
    artifact.inert = false;
    menu.dataset.portalPhase = "closed";
    panel.dispatchEvent(new Event("sol:portal-close-finished"));
  };
  const release = () => {
    cancel();
    renderer.release();
  };
  const fail = (error) => {
    if (disposed || failed) return;
    failed = true;
    menu.dataset.portalInkRenderer = "unavailable";
    release();
    if (closing) finish_close();
    else reveal_artifact();
    console.warn(
      "Ink renderer unavailable; the navigation keeps its static backdrop.",
      error,
    );
  };
  const request = () => {
    if (active() && renderer.ready() && frame === null)
      frame = requestAnimationFrame(draw);
  };
  const values = ensure_portal_ink_values(menu);
  const ink_change = new Event("sol:ink-change");
  const renderer_ready = () => {
    reveal_started =
      menu.dataset.portalPhase === "artifact"
        ? performance.now() - 900
        : performance.now();
    request();
  };
  const renderer = create_ink_gpu(canvas, values, {
    disposed: () => disposed,
    failed: () => failed,
    fail,
    loading: () => {
      menu.dataset.portalInkRenderer = "loading";
    },
    ready: renderer_ready,
  });
  const begin_frame = (now) => {
    frame = null;
    if (!active() || !renderer.ready()) {
      last_frame = null;
      return false;
    }
    if (closing && motion.matches) {
      finish_close();
      return false;
    }
    if (!motion.matches && !frame_gate.due(now)) {
      request();
      return false;
    }
    if (last_frame !== null) elapsed += Math.min(now - last_frame, 100);
    last_frame = now;
    return true;
  };
  const update_viewport = () => {
    const viewport = canvas.getBoundingClientRect();
    if (!viewport.width || !viewport.height) return false;
    values.resolution[0] = viewport.width;
    values.resolution[1] = viewport.height;
    values.center[0] = 0.5;
    values.center[1] = 0.5;
    values.extent[0] = (viewport.width / viewport.height) * 0.375;
    values.extent[1] = 0.375;
    values.time = motion.matches ? 0 : elapsed / 1000;
    values.sdr = document.documentElement.dataset.siteDisplay === "hdr" ? 0 : 1;
    values.scheme =
      document.documentElement.dataset.siteScheme === "dark" ? 1 : 0;
    return true;
  };
  const advance_reveal = (now) => {
    const close_progress = Math.max(
      0,
      Math.min(1, (now - close_started - 220) / 550),
    );
    values.reveal = closing
      ? close_from * (1 - close_progress)
      : motion.matches
        ? 1
        : Math.min(1, (now - reveal_started) / 900);
    return close_progress;
  };
  const submit_frame = (close_progress) => {
    try {
      renderer.submit();
      menu.dataset.portalInkRenderer = "vgpu";
      if (motion.matches) menu.dispatchEvent(ink_change);
      if (closing && close_progress === 1) {
        finish_close();
        return false;
      }
      if (!closing && values.reveal >= 0.65) reveal_artifact();
    } catch (error) {
      fail(error);
      return false;
    }
    return true;
  };
  function draw(now) {
    if (!begin_frame(now)) return;
    if (!update_viewport()) return;
    const close_progress = advance_reveal(now);
    if (!submit_frame(close_progress)) return;
    if (!motion.matches) request();
  }
  const visibility = () => {
    if (document.hidden) cancel();
    else request();
  };
  const resize = new ResizeObserver(request);
  resize.observe(panel);
  const display = new MutationObserver(request);
  display.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-site-display", "data-site-fps", "data-site-scheme"],
  });
  motion.addEventListener("change", request);
  document.addEventListener("visibilitychange", visibility);
  return {
    open() {
      if ((opened && !closing) || disposed) return;
      clearTimeout(close_guard);
      close_guard = null;
      closing = false;
      values.reveal = 0;
      opened = true;
      menu.dataset.portalPhase = "ink";
      artifact.inert = true;
      reveal_guard = setTimeout(reveal_artifact, 1500);
      if (motion.matches || failed) reveal_artifact();
      reveal_started = performance.now();
      if (renderer.ready()) request();
      else renderer.initialize();
    },
    close() {
      if (closing) return;
      clearTimeout(reveal_guard);
      reveal_guard = null;
      if (!opened || motion.matches) {
        finish_close();
        return;
      }
      closing = true;
      close_started = performance.now();
      close_from = values.reveal;
      artifact.inert = true;
      close_guard = setTimeout(
        finish_close,
        renderer.ready() && !failed ? 1000 : 240,
      );
      request();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(reveal_guard);
      clearTimeout(close_guard);
      artifact.inert = false;
      delete menu.dataset.portalInkController;
      release();
      resize.disconnect();
      display.disconnect();
      motion.removeEventListener("change", request);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
};

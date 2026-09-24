import { hydrate_interactions } from "scripts-of-folly/interactions";
import { install_pretext } from "scripts-of-folly/pretext";
import { hydrate_text_effects } from "scripts-of-folly/text";
import { install_gpu_effects } from "scripts-of-folly/gpu";
import { define_inscription_element } from "./inscription_element.js";
import { create_obsidian_runtime } from "./obsidian_runtime.js";
import "./portal_navigation.js";
import { install_route_failure } from "./route_failure.js";

const RUNTIME_FLAG = "__monochrome_runtime_bound";

const as_element = (value) =>
  value && typeof value.querySelectorAll === "function" ? value : document;

const root_contains = (root, selector) =>
  root.matches?.(selector) || root.querySelector(selector);

const hydrate_page_runtimes = (root) => {
  if (root_contains(root, "[data-albedo-archive]")) {
    void import("./albedo_archive.js").then(({ init_albedo_archive }) =>
      init_albedo_archive(),
    );
  }

  if (root_contains(root, "[data-nigredo-archive]")) {
    void import("./nigredo_archive.js").then(({ init_nigredo_archive }) =>
      init_nigredo_archive(),
    );
  }

  if (root_contains(root, "[data-search]")) {
    void import("./search.js").then(({ init_search }) => init_search());
  }

  const effect_window_lab = root.matches?.("[data-effect-window-lab]")
    ? root
    : root.querySelector("[data-effect-window-lab]");

  if (effect_window_lab) {
    effect_window_lab.dataset.effectWindowRuntime = "loading";

    void import("./effect_window_lab.js")
      .then(({ init_effect_window_lab }) => {
        init_effect_window_lab(root);
        effect_window_lab.dataset.effectWindowRuntime = "ready";
      })
      .catch((error) => {
        effect_window_lab.dataset.effectWindowRuntime = "failed";
        effect_window_lab.dataset.effectWindowError =
          error instanceof Error ? error.message : String(error);
        console.error("[effect-window] runtime failed", error);
      });
  }
};

const define_obsidian_tablet_element = () => {
  if (customElements.get("sol-obsidian-tablet")) {
    return;
  }

  customElements.define(
    "sol-obsidian-tablet",
    class extends HTMLElement {
      connectedCallback() {
        if (this.runtime) return;

        const menu = this.closest("#sol_side_menu");
        const canvas = menu?.querySelector("[data-obsidian-surface]");
        if (!menu || !canvas) return;

        this.runtime = create_obsidian_runtime({ owner: this, menu, canvas });
      }

      disconnectedCallback() {
        this.runtime?.dispose();
        this.runtime = null;
      }
    },
  );
};

const define_tablet_frame_element = () => {
  if (customElements.get("sol-tablet-frame")) {
    return;
  }

  customElements.define(
    "sol-tablet-frame",
    class extends HTMLElement {
      on_visibility = () => {
        this.dataset.pageVisible = String(!document.hidden);
      };

      connectedCallback() {
        this.on_visibility();
        document.addEventListener("visibilitychange", this.on_visibility);
      }

      disconnectedCallback() {
        document.removeEventListener("visibilitychange", this.on_visibility);
      }
    },
  );
};

export const hydrate_monochrome_runtime = (root = document) => {
  if (typeof document === "undefined") {
    return;
  }

  const hydration_root = as_element(root);
  hydrate_interactions(hydration_root);
  hydrate_text_effects(hydration_root);

  pretext_controller?.refresh(hydration_root);
  hydrate_page_runtimes(hydration_root);
};

let pretext_controller = null;

const boot = () => {
  define_inscription_element();
  define_obsidian_tablet_element();
  define_tablet_frame_element();
  install_route_failure();

  if (!pretext_controller) {
    pretext_controller = install_pretext({ root: document });
  }

  const gpu_key = Symbol.for("scripts-of-folly.gpu");
  globalThis[gpu_key] ??= install_gpu_effects();

  hydrate_monochrome_runtime();
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const window_any = /** @type {any} */ (globalThis);

  if (!window_any[RUNTIME_FLAG]) {
    window_any[RUNTIME_FLAG] = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }

    document.addEventListener("htmx:afterSwap", (event) => {
      const target = event?.detail?.target;
      hydrate_monochrome_runtime(target ?? document);
    });
  }
}

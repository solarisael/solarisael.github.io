import { hydrate_interactions } from "scripts-of-folly/interactions";
import { install_pretext } from "scripts-of-folly/pretext";
import { hydrate_text_effects } from "scripts-of-folly/text";
import { define_inscription_element } from "./inscription_element.js";
import { create_obsidian_runtime } from "./obsidian_runtime.js";
import "./portal_navigation.js";
import { install_route_failure } from "./route_failure.js";

const RUNTIME_FLAG = "__monochrome_runtime_bound";
const MENU_SELECTOR = "#sol_side_menu";

const as_element = (value) =>
  value && typeof value.querySelectorAll === "function" ? value : document;

const menu_in = (root) => {
  if (root.matches?.(MENU_SELECTOR)) {
    return root;
  }

  return root.querySelector(MENU_SELECTOR);
};

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

  const menu = menu_in(hydration_root);
  if (menu) {
    hydrate_text_effects(menu);
  }

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

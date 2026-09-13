import { hydrate_interactions } from "scripts-of-folly/interactions";
import { hydrate_text_effects } from "scripts-of-folly/text";
import { install_pretext } from "scripts-of-folly/pretext";

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
};

let pretext_controller = null;

const boot = () => {
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

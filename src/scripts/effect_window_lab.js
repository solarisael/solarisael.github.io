import { create_terminal_runtime } from "scripts-of-folly/terminal";
import { RUNIC_GLYPHS, SYMBOL_GLYPHS } from "./enchantment_glyphs.js";

const EFFECT_WINDOW_TAG = "sol-effect-window";
const LAB_SELECTOR = "[data-effect-window-lab]";
const PANEL_SELECTOR = ".sol__block_fx";
const VGPU_EFFECTS = new Set(["terminal"]);
const TERMINAL_GLYPHS = Object.freeze([
  ...RUNIC_GLYPHS.map((text) => ({
    text,
    font: '18px "Solarisael Runic"',
  })),
  ...SYMBOL_GLYPHS.map((text) => ({
    text,
    font: '18px "Solarisael Symbols"',
  })),
]);

const mount_effect_window = (host) => {
  if (host.effect_window_mounted) return;

  host.effect_window_mounted = true;
  const effect_name = host.dataset.effectWindow ?? "window";

  if (!VGPU_EFFECTS.has(effect_name)) {
    host.dataset.effectWindowRenderer = "legacy";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "sol__effect_window_field";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  host.runtime = create_terminal_runtime(host, canvas, {
    glyphs: TERMINAL_GLYPHS,
  });
};

const define_effect_window_element = () => {
  if (customElements.get(EFFECT_WINDOW_TAG)) return;

  customElements.define(
    EFFECT_WINDOW_TAG,
    class extends HTMLElement {
      connectedCallback() {
        mount_effect_window(this);
      }

      disconnectedCallback() {
        this.runtime?.dispose();
        this.runtime = null;
        this.effect_window_mounted = false;
      }
    },
  );
};

const lab_roots_in = (root) => {
  const roots = Array.from(root.querySelectorAll?.(LAB_SELECTOR) ?? []);
  if (root.matches?.(LAB_SELECTOR)) roots.unshift(root);
  return roots;
};

const wrap_effect_panels = (lab_root) => {
  const content_root =
    lab_root.closest("#sol_content") ?? lab_root.parentElement;
  if (!content_root) return;

  for (const panel of content_root.querySelectorAll(PANEL_SELECTOR)) {
    if (panel.closest(EFFECT_WINDOW_TAG)) continue;

    const parent = panel.parentNode;
    if (!parent) continue;

    const next_sibling = panel.nextSibling;
    const window_element = document.createElement(EFFECT_WINDOW_TAG);
    window_element.dataset.effectWindow = panel.dataset.textFx ?? "window";
    window_element.append(panel);
    parent.insertBefore(window_element, next_sibling);
    mount_effect_window(window_element);
  }
};

export const init_effect_window_lab = (root = document) => {
  define_effect_window_element();

  for (const lab_root of lab_roots_in(root)) {
    wrap_effect_panels(lab_root);
  }
};

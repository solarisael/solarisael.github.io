import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import {
  hydrate_pretext_justification,
  layout_pretext_root,
  reset_pretext_source,
} from "scripts-of-folly/pretext";
import { transition_pretext_content } from "scripts-of-folly/transitions";

if (!globalThis.window) {
  GlobalRegistrator.register();
}
// Pretext tests use synthetic DOM only. Keep Happy DOM from starting external
// resource loads that can outlive a test and report unrelated network errors.
const happy_dom_settings = globalThis.window?.happyDOM?.settings;
if (happy_dom_settings) {
  Object.assign(happy_dom_settings, {
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
    enableImageFileLoading: false,
  });
}
const style_prototype = Object.getPrototypeOf(
  document.createElement("span").style,
);
if (typeof style_prototype[Symbol.iterator] !== "function") {
  Object.defineProperty(style_prototype, Symbol.iterator, {
    configurable: true,
    value: function* iterate_style_properties() {
      for (let index = 0; index < this.length; index += 1)
        yield this.item(index);
    },
  });
}

let restore_canvas_measurement_context = () => {};

const install_canvas_measurement_context = () => {
  const original_offscreen_canvas = globalThis.OffscreenCanvas;
  const original_get_context = HTMLCanvasElement.prototype.getContext;
  const context = {
    font: "",
    measureText: (text) => ({ width: String(text).length * 10 }),
  };

  globalThis.OffscreenCanvas = class {
    getContext(context_type) {
      return context_type === "2d" ? context : null;
    }
  };
  HTMLCanvasElement.prototype.getContext = function getContext(context_type) {
    if (context_type !== "2d") {
      return typeof original_get_context === "function"
        ? original_get_context.call(this, context_type)
        : null;
    }
    return context;
  };

  restore_canvas_measurement_context = () => {
    globalThis.OffscreenCanvas = original_offscreen_canvas;
    HTMLCanvasElement.prototype.getContext = original_get_context;
  };
};

const create_root = (html) => {
  const root = document.createElement("p");
  root.dataset.solPretext = "justify";
  root.innerHTML = html;
  Object.defineProperty(root, "clientWidth", {
    configurable: true,
    value: 600,
  });
  document.body.append(root);
  return root;
};

afterEach(() => {
  restore_canvas_measurement_context();
  restore_canvas_measurement_context = () => {};
  document.body.innerHTML = "";
});

describe("pretext transition source reset", () => {
  test("reset_pretext_source makes re-layout read replacement content", () => {
    install_canvas_measurement_context();
    const root = create_root("old sentence");
    hydrate_pretext_justification(root);

    root.innerHTML = "new sentence";
    reset_pretext_source(root);
    expect(layout_pretext_root(root)).toBe(true);
    expect(root.textContent).toContain("new sentence");
    expect(root.textContent).not.toContain("old sentence");
  });
});

describe("pretext content transitions", () => {
  test("swaps content and preserves next fragment effects in happy-dom", async () => {
    install_canvas_measurement_context();
    const root = create_root("old sentence");
    hydrate_pretext_justification(root);

    const result = await transition_pretext_content(
      root,
      '<span class="sol__text_fx sol__text_fx_glow" data-text-fx="glow">new sentence</span>',
    );

    expect(result).toBe(true);
    expect(root.textContent).toContain("new sentence");
    expect(
      root.querySelector(".sol__pretext_fragment.sol__text_fx_glow"),
    ).not.toBeNull();
    expect(root.classList.contains("sol__pretext_transitioning")).toBe(false);
  });

  test("falls back to the dust transition for an unknown effect", async () => {
    install_canvas_measurement_context();
    const root = create_root("old sentence");
    hydrate_pretext_justification(root);

    await expect(
      transition_pretext_content(root, "new sentence", { effect: "unknown" }),
    ).resolves.toBe(true);

    expect(root.textContent).toContain("new sentence");
    expect(root.classList.contains("sol__pretext_transitioning")).toBe(false);
  });
});

describe("pretext transition swap hook", () => {
  test("on_swap fires once the new content is in the root", async () => {
    install_canvas_measurement_context();
    const root = create_root("the old sentence");
    hydrate_pretext_justification(root);

    let seen = null;
    const resolved = await transition_pretext_content(
      root,
      "the new sentence",
      {
        on_swap: (element) => {
          seen = element.textContent;
        },
      },
    );

    expect(resolved).toBe(true);
    expect(seen).toBe("the new sentence");
  });
});

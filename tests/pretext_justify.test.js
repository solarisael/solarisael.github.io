import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import {
  compute_justified_gap_extra,
  hydrate_pretext_justification,
  split_text_for_pretext_items,
} from "scripts-of-folly/pretext";

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

const create_canvas_measurement_context = () => ({
  font: "",
  measureText: (text) => ({ width: String(text).length * 10 }),
});

const install_canvas_measurement_context = () => {
  const original_offscreen_canvas = globalThis.OffscreenCanvas;
  const original_get_context = HTMLCanvasElement.prototype.getContext;

  globalThis.OffscreenCanvas = class {
    getContext(context_type) {
      return context_type === "2d" ? create_canvas_measurement_context() : null;
    }
  };

  HTMLCanvasElement.prototype.getContext = function getContext(context_type) {
    if (context_type !== "2d") {
      return typeof original_get_context === "function"
        ? original_get_context.call(this, context_type)
        : null;
    }

    return create_canvas_measurement_context();
  };

  restore_canvas_measurement_context = () => {
    globalThis.OffscreenCanvas = original_offscreen_canvas;
    HTMLCanvasElement.prototype.getContext = original_get_context;
  };
};

afterEach(() => {
  restore_canvas_measurement_context();
  restore_canvas_measurement_context = () => {};
  document.body.innerHTML = "";
});

describe("pretext justification text splitting", () => {
  test("keeps normal words as separate Pretext items with whitespace attached to each following word", () => {
    const result = split_text_for_pretext_items("alpha  beta\tgamma\n delta");

    expect(result).toEqual({
      tokens: ["alpha", " beta", " gamma", " delta"],
      pendingSpace: "",
    });
  });

  test("returns trailing whitespace as pendingSpace for the next text node or element", () => {
    const result = split_text_for_pretext_items("alpha beta  \n");

    expect(result).toEqual({
      tokens: ["alpha", " beta"],
      pendingSpace: " ",
    });
  });
});

describe("pretext justification DOM hydration", () => {
  test("renders text-fx fragments through Pretext without leaking stale hydration attributes or dropping text", () => {
    install_canvas_measurement_context();

    const paragraph = document.createElement("p");
    paragraph.dataset.solPretext = "justify";
    paragraph.innerHTML =
      'Before <span class="sol__text_fx sol__text_fx--glow fx-sigil" data-text-fx="glow whisper" data-text-fx-glow-intensity="0.7" data-text-fx-whisper-intensity="0.9" data-text-fx-hydrated="true" data-combat-tokens-hydrated="true">soft spectral emphasis</span> after ordinary words.';
    Object.defineProperty(paragraph, "clientWidth", {
      configurable: true,
      value: 600,
    });
    document.body.append(paragraph);

    hydrate_pretext_justification(paragraph);

    const lines = paragraph.querySelectorAll(":scope > .sol__pretext_line");
    const fragments = paragraph.querySelectorAll(".sol__pretext_fragment");
    const fx_fragment = paragraph.querySelector(
      '.sol__pretext_fragment.sol__text_fx[data-text-fx="glow whisper"]',
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(fragments.length).toBeGreaterThan(0);
    expect(paragraph.textContent.replace(/\s+/gu, " ").trim()).toBe(
      "Before soft spectral emphasis after ordinary words.",
    );
    expect(fx_fragment).not.toBeNull();
    expect([...fx_fragment.classList]).toEqual(
      expect.arrayContaining([
        "sol__text_fx",
        "sol__text_fx--glow",
        "fx-sigil",
        "sol__pretext_fragment",
      ]),
    );
    expect(fx_fragment.getAttribute("data-text-fx-glow-intensity")).toBe("0.7");
    expect(fx_fragment.getAttribute("data-text-fx-whisper-intensity")).toBe(
      "0.9",
    );
    expect(paragraph.querySelector("[data-text-fx-hydrated]")).toBeNull();
    expect(paragraph.querySelector("[data-combat-tokens-hydrated]")).toBeNull();
  });
});

describe("pretext justified gap distribution", () => {
  test("distributes remaining width over justifiable gaps on non-last lines", () => {
    expect(
      compute_justified_gap_extra({
        lineWidth: 80,
        targetWidth: 100,
        gapCount: 4,
        isLastLine: false,
      }),
    ).toBe(5);
  });

  test("returns zero when a line should not receive extra gap width", () => {
    const cases = [
      {
        name: "last line",
        input: {
          lineWidth: 80,
          targetWidth: 100,
          gapCount: 4,
          isLastLine: true,
        },
      },
      {
        name: "no gaps",
        input: {
          lineWidth: 80,
          targetWidth: 100,
          gapCount: 0,
          isLastLine: false,
        },
      },
      {
        name: "target already reached",
        input: {
          lineWidth: 100,
          targetWidth: 100,
          gapCount: 4,
          isLastLine: false,
        },
      },
      {
        name: "line exceeds target",
        input: {
          lineWidth: 120,
          targetWidth: 100,
          gapCount: 4,
          isLastLine: false,
        },
      },
    ];

    for (const { name, input } of cases) {
      expect(compute_justified_gap_extra(input), name).toBe(0);
    }
  });
});

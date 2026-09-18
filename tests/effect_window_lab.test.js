import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { init_effect_window_lab } from "../src/scripts/effect_window_lab.js";

if (!globalThis.window) {
  GlobalRegistrator.register({ url: "https://solarisael.local/codex/labs/" });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Effect Window lab", () => {
  test("wraps every effect panel once", () => {
    const content = document.createElement("main");
    content.id = "sol_content";

    const lab = document.createElement("section");
    lab.dataset.effectWindowLab = "";
    content.append(lab);

    for (const effect of ["administrative_trace", "game_screen"]) {
      const panel = document.createElement("article");
      panel.className = "sol__block_fx";
      panel.dataset.textFx = effect;
      content.append(panel);
    }

    document.body.append(content);
    init_effect_window_lab(lab);
    init_effect_window_lab(lab);

    const windows = [...content.querySelectorAll("sol-effect-window")];
    expect(windows).toHaveLength(2);
    expect(windows.map((element) => element.dataset.effectWindow)).toEqual([
      "administrative_trace",
      "game_screen",
    ]);
    expect(
      windows.every(
        (element) =>
          element.dataset.effectWindowRenderer === "legacy" &&
          element.children.length === 1 &&
          element.firstElementChild?.classList.contains("sol__block_fx"),
      ),
    ).toBe(true);
  });
});

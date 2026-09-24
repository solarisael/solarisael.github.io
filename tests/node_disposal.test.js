import { describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.window) {
  GlobalRegistrator.register({ url: "https://solarisael.local/current/" });
}

const {
  dispose_removed_root,
  install_node_disposal_lifecycle,
  register_node_disposal,
} = await import("../public/js/modules/node_disposal.js");

install_node_disposal_lifecycle(document);

const dispatch_htmx_event = (event_name, detail, target = document) => {
  target.dispatchEvent(
    new CustomEvent(event_name, {
      bubbles: true,
      detail,
    }),
  );
};

describe("node disposal lifecycle", () => {
  test("disposes a removed root exactly once across cleanup and afterSwap", () => {
    const root = document.createElement("div");
    let disposal_count = 0;
    document.body.append(root);

    const unregister = register_node_disposal(root, () => {
      disposal_count += 1;
    });

    dispatch_htmx_event("htmx:beforeCleanupElement", { elt: root }, root);
    root.remove();
    dispatch_htmx_event("htmx:afterSwap", { target: document.body });

    expect(disposal_count).toBe(1);
    unregister();
  });

  test("disposes registered descendants when an ancestor is cleaned up", () => {
    const removal_root = document.createElement("section");
    const feature_root = document.createElement("div");
    let disposal_count = 0;
    removal_root.append(feature_root);
    document.body.append(removal_root);

    const unregister = register_node_disposal(feature_root, () => {
      disposal_count += 1;
    });

    dispatch_htmx_event(
      "htmx:beforeCleanupElement",
      { elt: removal_root },
      removal_root,
    );
    removal_root.remove();
    dispatch_htmx_event("htmx:afterSwap", { target: document.body });

    expect(disposal_count).toBe(1);
    unregister();
  });

  test("does not dispose a connected root preserved through a swap", () => {
    const root = document.createElement("div");
    let disposal_count = 0;
    document.body.append(root);

    const unregister = register_node_disposal(root, () => {
      disposal_count += 1;
    });

    dispatch_htmx_event("htmx:afterSwap", { target: document.body });

    expect(disposal_count).toBe(0);
    unregister();
    root.remove();
  });

  test("supports direct disposal after a native DOM removal", () => {
    const root = document.createElement("div");
    let disposal_count = 0;
    document.body.append(root);

    register_node_disposal(root, () => {
      disposal_count += 1;
    });
    root.remove();

    expect(dispose_removed_root(root)).toBe(true);
    expect(disposal_count).toBe(1);
  });

  test("continues disposing callbacks when one callback throws", () => {
    const root = document.createElement("div");
    let second_disposal_count = 0;
    document.body.append(root);

    register_node_disposal(root, () => {
      throw new Error("first cleanup failed");
    });
    register_node_disposal(root, () => {
      second_disposal_count += 1;
    });

    const original_console_error = console.error;
    console.error = () => {};

    try {
      root.remove();
      dispatch_htmx_event("htmx:afterSwap", { target: document.body });
    } finally {
      console.error = original_console_error;
    }

    expect(second_disposal_count).toBe(1);
  });

  test("a second module instance feeds the installed registry", async () => {
    // Production serves this module from /js/modules/ and the Astro bundle
    // may inline another copy; the copy that loads last owns the global API.
    const bundled_copy =
      await import("../public/js/modules/node_disposal.js?bundled_copy");
    const global_api = globalThis[Symbol.for("solarisael.node_disposal")];
    const root = document.createElement("div");
    let disposal_count = 0;
    document.body.append(root);

    expect(bundled_copy.register_node_disposal).not.toBe(
      register_node_disposal,
    );
    expect(bundled_copy.install_node_disposal_lifecycle(document)).toBe(false);

    global_api.register_node_disposal(root, () => {
      disposal_count += 1;
    });
    root.remove();
    dispatch_htmx_event("htmx:afterSwap", { target: document.body });

    expect(disposal_count).toBe(1);
  });
});

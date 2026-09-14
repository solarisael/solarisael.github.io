import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import {
  IX_ACTION_NAMES,
  IX_BASE_CLASS,
  IX_TRIGGER_NAMES,
  build_ix_attribute_value,
  parse_ix_descriptor,
} from "scripts-of-folly/contract";
import {
  build_ix_span_html,
  parse_ix_marker_descriptor,
  split_ix_markers,
  transform_ix_markers_in_tree,
} from "scripts-of-folly/interaction-markdown";

// `scripts-of-folly/interactions` reads `document` at module top-level (to
// bind global dismiss listeners), so register the DOM before importing it.
// The contract and interaction-markdown modules are DOM-free.
if (!globalThis.window) {
  GlobalRegistrator.register();
}
// Fetch actions intentionally cross the network boundary. Return an empty
// successful document so idle prefetch cannot reach the synthetic origin.
const native_fetch = globalThis.fetch;
globalThis.fetch = async () => new Response("", { status: 200 });
afterAll(() => {
  globalThis.fetch = native_fetch;
});

const { hydrate_interactions } = await import("scripts-of-folly/interactions");

const IX_POPUP_ID = "sol_ix_popup";
const IX_POPUP_SLOT_ID = "sol_ix_popup_slot";
const IX_POPUP_PINNED_CLASS = `${IX_BASE_CLASS}_popup_pinned`;
const IX_POPUP_DOOR_CLASS = `${IX_BASE_CLASS}_popup_door`;
const HIDE_SETTLE_MS = 220; // > interactions.js's internal 120ms hide delay

const settle = (ms = HIDE_SETTLE_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// The popup engine keeps its "is this pinned / who's the active trigger"
// state as module-private closure variables (by design — there's no reset
// hook). Dispatching a bubbling click on a neutral node exercises the same
// global dismiss listener the real page relies on, so it's the only
// supported way to force a clean pin state between tests. We wait out the
// hide delay before wiping the DOM so no stray timer fires against a
// removed element.
afterEach(async () => {
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await settle();
  document.body.innerHTML = "";
});

describe("contract.js interaction descriptor grammar", () => {
  test("exposes the trigger/action vocabulary and base class", () => {
    expect(IX_BASE_CLASS).toBe("sol__ix");
    expect(IX_TRIGGER_NAMES).toEqual(["hover", "click"]);
    expect(IX_ACTION_NAMES).toEqual(["preview", "reveal", "fetch"]);
  });

  test("parses a valid trigger:action:payload triple", () => {
    expect(parse_ix_descriptor("hover:preview:some text")).toEqual({
      trigger: "hover",
      action: "preview",
      payload: "some text",
    });
  });

  test("rejects an invalid trigger", () => {
    expect(parse_ix_descriptor("bogus:preview:some text")).toBeNull();
  });

  test("rejects an invalid action", () => {
    expect(parse_ix_descriptor("hover:bogus:some text")).toBeNull();
  });

  test("rejects a descriptor missing the second colon", () => {
    expect(parse_ix_descriptor("hover:preview")).toBeNull();
  });

  test("rejects a descriptor with no colon at all", () => {
    expect(parse_ix_descriptor("hover")).toBeNull();
  });

  test("keeps a payload containing colons intact past the first two", () => {
    expect(
      parse_ix_descriptor("click:fetch:https://example.com:8080/path"),
    ).toEqual({
      trigger: "click",
      action: "fetch",
      payload: "https://example.com:8080/path",
    });
  });

  test("trims and lowercases trigger/action but leaves payload untouched", () => {
    expect(parse_ix_descriptor(" HOVER : PREVIEW :  spaced payload ")).toEqual({
      trigger: "hover",
      action: "preview",
      payload: "  spaced payload ",
    });
  });

  test("build_ix_attribute_value round-trips through parse_ix_descriptor", () => {
    const descriptor = {
      trigger: "click",
      action: "reveal",
      payload: "#lantern-detail",
    };
    const attribute_value = build_ix_attribute_value(descriptor);

    expect(attribute_value).toBe("click:reveal:#lantern-detail");
    expect(parse_ix_descriptor(attribute_value)).toEqual(descriptor);
  });
});

describe("interaction_markdown.js descriptor + door_href grammar", () => {
  test("parses a marker descriptor with no door_href", () => {
    expect(parse_ix_marker_descriptor("hover:preview:some text")).toEqual({
      trigger: "hover",
      action: "preview",
      payload: "some text",
      door_href: null,
    });
  });

  test("splits a trailing |door_href segment off the payload", () => {
    expect(
      parse_ix_marker_descriptor(
        "hover:preview:a lantern kept lit past its oil|/codex/lantern",
      ),
    ).toEqual({
      trigger: "hover",
      action: "preview",
      payload: "a lantern kept lit past its oil",
      door_href: "/codex/lantern",
    });
  });

  test("keeps payload colons intact ahead of the door_href split", () => {
    expect(
      parse_ix_marker_descriptor("click:fetch:http://example.com:8080/x|/door"),
    ).toEqual({
      trigger: "click",
      action: "fetch",
      payload: "http://example.com:8080/x",
      door_href: "/door",
    });
  });

  test("treats a blank trailing door_href segment as no door_href", () => {
    expect(parse_ix_marker_descriptor("hover:preview:text|   ")).toEqual({
      trigger: "hover",
      action: "preview",
      payload: "text",
      door_href: null,
    });
  });

  test("rejects an invalid trigger or action even with a door_href suffix", () => {
    expect(parse_ix_marker_descriptor("bogus:preview:text|/door")).toBeNull();
    expect(parse_ix_marker_descriptor("hover:bogus:text|/door")).toBeNull();
  });
});

describe("build_ix_span_html", () => {
  test("builds a span with the data-ix attribute and escaped text", () => {
    expect(
      build_ix_span_html(
        { trigger: "hover", action: "preview", payload: "x" },
        "<b>bold</b>",
      ),
    ).toBe(
      '<span class="sol__ix" data-ix="hover:preview:x">&lt;b&gt;bold&lt;/b&gt;</span>',
    );
  });

  test("escapes quotes inside the data-ix attribute value", () => {
    const html = build_ix_span_html(
      { trigger: "hover", action: "preview", payload: 'say "hi"' },
      "text",
    );

    expect(html).toBe(
      '<span class="sol__ix" data-ix="hover:preview:say &quot;hi&quot;">text</span>',
    );
  });

  test("adds a data-ix-href attribute when a door_href is given", () => {
    const html = build_ix_span_html(
      { trigger: "hover", action: "preview", payload: "x" },
      "text",
      { door_href: "/codex/lantern" },
    );

    expect(html).toBe(
      '<span class="sol__ix" data-ix="hover:preview:x" data-ix-href="/codex/lantern">text</span>',
    );
  });
});

describe("split_ix_markers", () => {
  test("splits a single-node marker into interleaved text/html nodes", () => {
    const nodes = split_ix_markers(
      "before {{ix:hover:preview:a lantern}}glow{{/ix}} after",
    );

    expect(nodes).toEqual([
      { type: "text", value: "before " },
      {
        type: "html",
        value:
          '<span class="sol__ix" data-ix="hover:preview:a lantern">glow</span>',
      },
      { type: "text", value: " after" },
    ]);
  });

  test("keeps a malformed descriptor as literal text", () => {
    const nodes = split_ix_markers("{{ix:bogus:preview:x}}text{{/ix}}");

    expect(nodes).toEqual([
      { type: "text", value: "{{ix:bogus:preview:x}}text{{/ix}}" },
    ]);
  });

  test("emits a sanitization warning once per distinct malformed descriptor", () => {
    const warning_messages = [];
    const nodes = split_ix_markers(
      "{{ix:bogus:preview:x}}a{{/ix}} {{ix:bogus:preview:x}}b{{/ix}}",
      {
        warn: (message) => warning_messages.push(message),
        warning_cache: new Set(),
      },
    );

    expect(nodes).toEqual([
      { type: "text", value: "{{ix:bogus:preview:x}}a{{/ix}}" },
      { type: "text", value: " " },
      { type: "text", value: "{{ix:bogus:preview:x}}b{{/ix}}" },
    ]);
    expect(warning_messages).toEqual([
      '{{ix:bogus:preview:x}} is not a valid interaction descriptor ("trigger:action:payload" — ' +
        "trigger \u2208 {hover, click}, action \u2208 {preview, reveal, fetch}); left as literal text.",
    ]);
  });

  test("keeps a payload containing colons intact in the emitted attribute", () => {
    const nodes = split_ix_markers(
      "{{ix:hover:preview:10:30 sharp}}time{{/ix}}",
    );

    expect(nodes).toEqual([
      {
        type: "html",
        value:
          '<span class="sol__ix" data-ix="hover:preview:10:30 sharp">time</span>',
      },
    ]);
  });

  test("splits the |door_href suffix into a separate data-ix-href attribute", () => {
    const nodes = split_ix_markers(
      "{{ix:hover:preview:a lantern kept lit past its oil|/codex/lantern}}the lantern{{/ix}}",
    );

    expect(nodes).toEqual([
      {
        type: "html",
        value:
          '<span class="sol__ix" data-ix="hover:preview:a lantern kept lit past its oil" ' +
          'data-ix-href="/codex/lantern">the lantern</span>',
      },
    ]);
  });
});

describe("transform_ix_markers_in_tree", () => {
  test("transforms a single text node containing a full marker", () => {
    const tree = {
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "before {{ix:hover:preview:a lantern}}glow{{/ix}} after",
        },
      ],
    };

    transform_ix_markers_in_tree(tree);

    expect(tree.children).toEqual([
      { type: "text", value: "before " },
      {
        type: "html",
        value:
          '<span class="sol__ix" data-ix="hover:preview:a lantern">glow</span>',
      },
      { type: "text", value: " after" },
    ]);
  });

  test("leaves a malformed descriptor as literal text and warns", () => {
    const tree = {
      type: "paragraph",
      children: [{ type: "text", value: "{{ix:bogus:preview:x}}text{{/ix}}" }],
    };
    const warning_messages = [];

    transform_ix_markers_in_tree(tree, {
      warn: (message) => warning_messages.push(message),
    });

    expect(tree.children).toEqual([
      { type: "text", value: "{{ix:bogus:preview:x}}text{{/ix}}" },
    ]);
    expect(warning_messages).toHaveLength(1);
    expect(warning_messages[0]).toContain("bogus:preview:x");
  });

  test("wraps intervening inline-node siblings when the marker spans mdast nodes", () => {
    const tree = {
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "{{ix:hover:preview:a lantern kept lit past its oil}}",
        },
        { type: "emphasis", children: [{ type: "text", value: "lantern" }] },
        { type: "text", value: "{{/ix}}" },
      ],
    };

    transform_ix_markers_in_tree(tree);

    expect(tree.children).toEqual([
      {
        type: "html",
        value:
          '<span class="sol__ix" data-ix="hover:preview:a lantern kept lit past its oil">',
      },
      { type: "emphasis", children: [{ type: "text", value: "lantern" }] },
      { type: "html", value: "</span>" },
    ]);
  });

  test("wraps intervening paragraph siblings when open/close markers sit on their own lines", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "{{ix:click:reveal:#lantern-detail}}" },
          ],
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "click for lantern detail" }],
        },
        { type: "paragraph", children: [{ type: "text", value: "{{/ix}}" }] },
      ],
    };

    transform_ix_markers_in_tree(tree);

    expect(tree.children).toEqual([
      {
        type: "html",
        value: '<span class="sol__ix" data-ix="click:reveal:#lantern-detail">',
      },
      {
        type: "paragraph",
        children: [{ type: "text", value: "click for lantern detail" }],
      },
      { type: "html", value: "</span>" },
    ]);
  });

  test("carries a door_href through the cross-node wrap", () => {
    const tree = {
      type: "paragraph",
      children: [
        {
          type: "text",
          value: "{{ix:hover:preview:a lantern|/codex/lantern}}",
        },
        { type: "emphasis", children: [{ type: "text", value: "lantern" }] },
        { type: "text", value: "{{/ix}}" },
      ],
    };

    transform_ix_markers_in_tree(tree);

    expect(tree.children[0]).toEqual({
      type: "html",
      value:
        '<span class="sol__ix" data-ix="hover:preview:a lantern" data-ix-href="/codex/lantern">',
    });
  });
});

describe("hydrate_interactions DOM popup engine", () => {
  test("hover trigger shows the popup with preview text on mouseenter and hides after mouseleave delay", async () => {
    const trigger_el = document.createElement("span");
    trigger_el.dataset.ix = "hover:preview:a lantern kept lit past its oil";
    document.body.append(trigger_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(new MouseEvent("mouseenter"));

    const popup_el = document.getElementById(IX_POPUP_ID);
    const slot_el = document.getElementById(IX_POPUP_SLOT_ID);

    expect(popup_el).not.toBeNull();
    expect(popup_el.hidden).toBe(false);
    expect(slot_el.textContent).toBe("a lantern kept lit past its oil");

    trigger_el.dispatchEvent(new MouseEvent("mouseleave"));
    // Hide is debounced — immediately after mouseleave the popup is still visible.
    expect(popup_el.hidden).toBe(false);

    await settle();
    expect(popup_el.hidden).toBe(true);
  });

  test("reveal action copies the target selector's innerHTML into the popup slot", () => {
    const detail_el = document.createElement("div");
    detail_el.id = "lantern-detail";
    detail_el.innerHTML = "<strong>a lantern</strong> kept lit past its oil";
    document.body.append(detail_el);

    const trigger_el = document.createElement("span");
    trigger_el.dataset.ix = "hover:reveal:#lantern-detail";
    document.body.append(trigger_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(new MouseEvent("mouseenter"));

    const slot_el = document.getElementById(IX_POPUP_SLOT_ID);
    expect(slot_el.innerHTML).toBe(
      "<strong>a lantern</strong> kept lit past its oil",
    );
  });

  test("fetch action marks the popup slot as pending for HTMX to fill in", () => {
    const trigger_el = document.createElement("a");
    trigger_el.dataset.ix = "click:fetch:";
    document.body.append(trigger_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const slot_el = document.getElementById(IX_POPUP_SLOT_ID);
    expect(slot_el.dataset.ixFetchPending).toBe("true");
  });

  test("click pins the popup, and a second click on the same trigger unpins it", () => {
    const trigger_el = document.createElement("div");
    trigger_el.dataset.ix = "click:preview:pinned content";
    document.body.append(trigger_el);

    hydrate_interactions();

    const first_click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    trigger_el.dispatchEvent(first_click);

    expect(first_click.defaultPrevented).toBe(true);
    const popup_el = document.getElementById(IX_POPUP_ID);
    expect(popup_el.hidden).toBe(false);
    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(true);

    const second_click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    trigger_el.dispatchEvent(second_click);

    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(false);
  });

  test("clicking outside a pinned popup dismisses it", () => {
    const trigger_el = document.createElement("div");
    trigger_el.dataset.ix = "click:preview:pinned content";
    document.body.append(trigger_el);
    const outside_el = document.createElement("div");
    document.body.append(outside_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const popup_el = document.getElementById(IX_POPUP_ID);
    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(true);

    outside_el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(false);
  });

  test("clicking inside the pinned popup itself does not dismiss it", () => {
    const trigger_el = document.createElement("div");
    trigger_el.dataset.ix = "click:preview:pinned content";
    document.body.append(trigger_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const popup_el = document.getElementById(IX_POPUP_ID);
    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(true);

    popup_el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(true);
  });

  test("pressing Escape dismisses a pinned popup", () => {
    const trigger_el = document.createElement("div");
    trigger_el.dataset.ix = "click:preview:pinned content";
    document.body.append(trigger_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const popup_el = document.getElementById(IX_POPUP_ID);
    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(popup_el.classList.contains(IX_POPUP_PINNED_CLASS)).toBe(false);
  });

  test("pinning a trigger with a door href reveals the door link", () => {
    const trigger_el = document.createElement("span");
    trigger_el.dataset.ix = "click:preview:a lantern kept lit past its oil";
    trigger_el.dataset.ixHref = "/codex/lantern";
    document.body.append(trigger_el);

    hydrate_interactions();
    trigger_el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const popup_el = document.getElementById(IX_POPUP_ID);
    const door_el = popup_el.querySelector(`.${IX_POPUP_DOOR_CLASS}`);

    expect(door_el.hidden).toBe(false);
    expect(door_el.getAttribute("href")).toBe("/codex/lantern");
    expect(door_el.textContent).toBe("\u2192 open");
  });

  test("a real navigation link with a hover trigger is left alone on click (native navigation wins)", () => {
    const trigger_el = document.createElement("a");
    trigger_el.href = "https://example.com/somewhere";
    trigger_el.dataset.ix = "hover:preview:a hint";
    document.body.append(trigger_el);

    hydrate_interactions();

    const click_event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    trigger_el.dispatchEvent(click_event);

    expect(click_event.defaultPrevented).toBe(false);
  });

  test("elements with an invalid data-ix descriptor are left unbound", () => {
    const trigger_el = document.createElement("span");
    trigger_el.dataset.ix = "bogus:preview:x";
    document.body.append(trigger_el);

    hydrate_interactions();

    expect(trigger_el.classList.contains(IX_BASE_CLASS)).toBe(false);
    expect(trigger_el.dataset.ixHydrated).toBeUndefined();
  });

  test("does not re-bind an already-hydrated node on a second hydrate_interactions() call", () => {
    const trigger_el = document.createElement("span");
    trigger_el.dataset.ix = "hover:preview:a lantern";
    document.body.append(trigger_el);

    let add_listener_calls = 0;
    const original_add_event_listener =
      trigger_el.addEventListener.bind(trigger_el);
    trigger_el.addEventListener = (...args) => {
      add_listener_calls += 1;
      return original_add_event_listener(...args);
    };

    hydrate_interactions();
    const calls_after_first_hydrate = add_listener_calls;
    expect(calls_after_first_hydrate).toBeGreaterThan(0);

    hydrate_interactions();
    expect(add_listener_calls).toBe(calls_after_first_hydrate);
  });

  test("hydrate_interactions can scope binding to a subtree root", () => {
    const outside_el = document.createElement("span");
    outside_el.dataset.ix = "hover:preview:outside";
    document.body.append(outside_el);

    const container_el = document.createElement("div");
    const inside_el = document.createElement("span");
    inside_el.dataset.ix = "hover:preview:inside";
    container_el.append(inside_el);
    document.body.append(container_el);

    hydrate_interactions(container_el);

    expect(inside_el.classList.contains(IX_BASE_CLASS)).toBe(true);
    expect(outside_el.classList.contains(IX_BASE_CLASS)).toBe(false);
  });
});

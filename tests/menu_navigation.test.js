import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { bind_navigation_controls } from "../public/js/modules/menu/navigation_controls.js";
import { set_menu_state } from "../public/js/modules/menu/view_state.js";
import {
  SITE_MENU_OPEN_COOKIE_NAME,
  SITE_MENU_VIEW_COOKIE_NAME,
  read_cookie_value,
  write_cookie_value,
} from "../public/js/modules/menu/preferences.js";

if (!globalThis.window) {
  GlobalRegistrator.register({ url: "https://solarisael.local/current/" });
}

const keydown = (target, options = {}) => {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
};

const next_task = () => new Promise((resolve) => window.setTimeout(resolve, 0));

describe("menu navigation lifecycle", () => {
  let menu;
  let panel;
  let trigger;
  let close;
  let overflow;
  let cookies;

  beforeEach(() => {
    overflow = document.documentElement.style.overflow;
    cookies = [SITE_MENU_OPEN_COOKIE_NAME, SITE_MENU_VIEW_COOKIE_NAME].map(
      (name) => [name, read_cookie_value(name)],
    );
    menu = document.createElement("div");
    menu.innerHTML = `
      <button data-side-menu-trigger>Menu</button>
      <dialog data-side-menu-panel-shell>
        <button data-side-menu-close>Close</button>
        <section data-side-menu-view-page="root">
          <button data-side-menu-view-focus>First view control</button>
          <a href="#destination" data-side-menu-route>Destination</a>
          <button disabled>Disabled</button>
          <button data-hidden-control>Hidden</button>
        </section>
        <section data-side-menu-view-page="settings">
          <button data-side-menu-view-focus>Inactive control</button>
        </section>
      </dialog>
    `;
    document.body.append(menu);
    panel = menu.querySelector("dialog");
    trigger = menu.querySelector("[data-side-menu-trigger]");
    close = menu.querySelector("[data-side-menu-close]");
    set_menu_state(menu, false, "root");
    bind_navigation_controls(menu);
  });

  afterEach(async () => {
    menu.dataset.portalInkController = "";
    set_menu_state(menu, false, "root");
    menu.remove();
    await next_task();
    document.documentElement.style.overflow = overflow;
    for (const [name, value] of cookies) {
      if (value === null) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      } else {
        write_cookie_value(name, value);
      }
    }
  });

  test("Escape opens a closed menu and focuses its close control", async () => {
    const event = keydown(document);
    expect(event.defaultPrevented).toBe(true);
    expect(menu.dataset.sideMenuOpen).toBe("true");
    expect(panel.open).toBe(true);
    expect(panel.inert).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(read_cookie_value(SITE_MENU_OPEN_COOKIE_NAME)).toBe("true");
    expect(read_cookie_value(SITE_MENU_VIEW_COOKIE_NAME)).toBe("root");
    await next_task();
    expect(document.activeElement).toBe(close);
  });

  test("Escape ignores editable targets", () => {
    for (const markup of [
      "<input>",
      "<textarea></textarea>",
      "<select><option>Choice</option></select>",
      '<div contenteditable="true"><span>Editing</span></div>',
    ]) {
      const host = document.createElement("div");
      host.innerHTML = markup;
      menu.append(host);
      const event = keydown(
        host.querySelector("span") ?? host.firstElementChild,
      );
      expect(event.defaultPrevented).toBe(false);
      expect(menu.dataset.sideMenuOpen).toBe("false");
      expect(panel.open).toBe(false);
      host.remove();
    }
  });

  test("Escape ignores repeated, modified, and already-handled events", () => {
    for (const options of [
      { repeat: true },
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
    ]) {
      const event = keydown(document, options);
      expect(event.defaultPrevented).toBe(false);
      expect(panel.open).toBe(false);
      expect(menu.dataset.sideMenuOpen).toBe("false");
    }
    const handled = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    document.dispatchEvent(handled);
    expect(panel.open).toBe(false);
    expect(menu.dataset.sideMenuOpen).toBe("false");
  });

  test("native dialog cancel closes and restores trigger focus", () => {
    set_menu_state(menu, true, "root");
    const event = new Event("cancel", { cancelable: true });
    panel.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(panel.open).toBe(false);
    expect(panel.inert).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(menu.dataset.sideMenuOpen).toBe("false");
    expect(read_cookie_value(SITE_MENU_OPEN_COOKIE_NAME)).toBe("false");
    expect(document.documentElement.style.overflow).toBe(overflow);
    expect(document.activeElement).toBe(trigger);
  });

  test("animated close waits for completion before closing the dialog", () => {
    menu.dataset.portalInkController = "ready";
    set_menu_state(menu, true, "root");
    menu.dataset.portalPhase = "artifact";
    close.click();
    expect(menu.dataset.sideMenuOpen).toBe("false");
    expect(menu.dataset.portalPhase).toBe("closing");
    expect(panel.open).toBe(true);
    expect(panel.inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe("hidden");
    panel.dispatchEvent(new Event("sol:portal-close-finished"));
    expect(panel.open).toBe(false);
    expect(panel.inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe(overflow);
    expect(document.activeElement).toBe(trigger);
  });

  test("stale animated completion cannot close a reopened menu", async () => {
    menu.dataset.portalInkController = "ready";
    set_menu_state(menu, true, "root");
    close.click();
    expect(menu.dataset.portalPhase).toBe("closing-ink");
    expect(panel.open).toBe(true);
    trigger.click();
    await next_task();
    expect(document.activeElement).toBe(close);
    panel.dispatchEvent(new Event("sol:portal-close-finished"));
    expect(menu.dataset.sideMenuOpen).toBe("true");
    expect(panel.open).toBe(true);
    expect(panel.inert).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  test("Escape returns through the nested parent and focuses its entry control", async () => {
    const settings = menu.querySelector(
      '[data-side-menu-view-page="settings"]',
    );
    settings.insertAdjacentHTML(
      "beforeend",
      '<button data-side-menu-view-target="effects">Effects</button>',
    );
    panel.insertAdjacentHTML(
      "beforeend",
      '<section data-side-menu-view-page="effects" data-side-menu-parent="settings"><input type="range"></section>',
    );
    set_menu_state(menu, true, "effects");
    keydown(menu.querySelector("input"));
    await next_task();

    expect(menu.dataset.sideMenuView).toBe("settings");
    expect(panel.open).toBe(true);
    expect(document.activeElement).toBe(
      settings.querySelector('[data-side-menu-view-target="effects"]'),
    );
    keydown(document.activeElement);
    await next_task();
    expect(menu.dataset.sideMenuView).toBe("root");
    expect(panel.open).toBe(true);
  });

  test("Tab wraps past inert, disabled, and non-visible controls", () => {
    set_menu_state(menu, true, "root");
    // Happy DOM has no layout; supply visibility without replacing focus behavior.
    for (const node of panel.querySelectorAll("button, a")) {
      node.getClientRects = () => [new DOMRect(0, 0, 10, 10)];
    }
    panel.querySelector("[data-hidden-control]").getClientRects = () => [];
    const last = panel.querySelector("[data-side-menu-route]");
    const inactive = panel.querySelector(
      '[data-side-menu-view-page="settings"]',
    );
    expect(inactive.inert).toBe(true);
    last.focus();
    const forward = keydown(last, { key: "Tab" });
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    const backward = keydown(close, { key: "Tab", shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    const middle = panel.querySelector(
      '[data-side-menu-view-page="root"] button',
    );
    middle.focus();
    expect(keydown(middle, { key: "Tab" }).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);
  });
});

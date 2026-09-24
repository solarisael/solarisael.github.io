import {
  SITE_MENU_VIEW_DEFAULT,
  SITE_MENU_VIEW_COOKIE_NAME,
  SITE_MENU_OPEN_COOKIE_NAME,
  write_cookie_value,
} from "./preferences.js";
import { set_menu_state, set_menu_view_state } from "./view_state.js";

const navigate_menu_view = (menu_node, requested_view) => {
  const previous_view = menu_node.dataset.sideMenuView;
  const safe_view = set_menu_view_state(menu_node, requested_view);
  write_cookie_value(SITE_MENU_VIEW_COOKIE_NAME, safe_view);

  const active_view = menu_node.querySelector(
    `[data-side-menu-view-page="${safe_view}"]`,
  );
  const focus_target =
    active_view?.querySelector(
      `[data-side-menu-view-target="${previous_view}"]`,
    ) ?? active_view?.querySelector("[data-side-menu-view-focus]");
  window.setTimeout(() => {
    if (
      focus_target instanceof HTMLElement &&
      menu_node.dataset.sideMenuView === safe_view
    ) {
      focus_target.focus();
    }
  }, 0);
};

const is_menu_open_escape = (menu_node, event) =>
  !(
    !menu_node.isConnected ||
    event.defaultPrevented ||
    event.repeat ||
    event.key !== "Escape" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    menu_node.dataset.sideMenuOpen === "true"
  );

const is_escape_reserved = (event) => {
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      "input, textarea, select, [contenteditable='true'], dialog[open]",
    )
  )
    return true;
  return Boolean(document.querySelector("dialog[open]"));
};

const cycle_panel_focus = (panel_node, event) => {
  const focusable = [
    ...panel_node.querySelectorAll(
      "a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex='0']",
    ),
  ].filter(
    (node) => !node.closest("[inert]") && node.getClientRects().length > 0,
  );
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
};

export const bind_navigation_controls = (menu_node) => {
  const close_node = menu_node.querySelector("[data-side-menu-close]");
  const trigger_node = menu_node.querySelector("[data-side-menu-trigger]");
  const panel_node = menu_node.querySelector("[data-side-menu-panel-shell]");

  const commit_menu_state = (is_open, view_name) => {
    const safe_view = set_menu_state(menu_node, is_open, view_name);
    write_cookie_value(SITE_MENU_OPEN_COOKIE_NAME, is_open ? "true" : "false");
    write_cookie_value(SITE_MENU_VIEW_COOKIE_NAME, safe_view);
  };

  const close_menu = () => {
    commit_menu_state(
      false,
      menu_node.dataset.sideMenuView ?? SITE_MENU_VIEW_DEFAULT,
    );
    if (trigger_node instanceof HTMLButtonElement) {
      trigger_node.focus();
    }
  };

  if (trigger_node instanceof HTMLButtonElement) {
    trigger_node.addEventListener("click", () => {
      const next_open_state = menu_node.dataset.sideMenuOpen !== "true";
      commit_menu_state(
        next_open_state,
        menu_node.dataset.sideMenuView ?? SITE_MENU_VIEW_DEFAULT,
      );
      if (next_open_state && close_node instanceof HTMLButtonElement) {
        window.setTimeout(() => {
          if (menu_node.dataset.sideMenuOpen === "true") {
            close_node.focus();
          }
        }, 0);
      }
    });
  }

  for (const target_node of menu_node.querySelectorAll(
    "[data-side-menu-view-target]",
  )) {
    if (!(target_node instanceof HTMLButtonElement)) {
      continue;
    }

    target_node.addEventListener("click", () => {
      navigate_menu_view(menu_node, target_node.dataset.sideMenuViewTarget);
    });
  }

  for (const route_node of menu_node.querySelectorAll(
    "[data-side-menu-route]",
  )) {
    if (!(route_node instanceof HTMLAnchorElement)) {
      continue;
    }

    route_node.addEventListener("click", () => {
      commit_menu_state(
        false,
        menu_node.dataset.sideMenuView ?? SITE_MENU_VIEW_DEFAULT,
      );
    });
  }

  if (close_node instanceof HTMLButtonElement) {
    close_node.addEventListener("click", close_menu);
  }

  panel_node?.addEventListener("cancel", (event) => {
    event.preventDefault();
    close_menu();
  });
  panel_node?.addEventListener("click", (event) => {
    if (event.target === panel_node) close_menu();
  });
  document.addEventListener("keydown", (event) => {
    if (!is_menu_open_escape(menu_node, event)) return;
    if (is_escape_reserved(event)) return;
    event.preventDefault();
    trigger_node?.click();
  });

  menu_node.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && menu_node.dataset.sideMenuOpen === "true") {
      cycle_panel_focus(panel_node, event);
      return;
    }
    if (event.key !== "Escape" || menu_node.dataset.sideMenuOpen !== "true") {
      return;
    }

    event.preventDefault();
    if (menu_node.dataset.sideMenuView !== SITE_MENU_VIEW_DEFAULT) {
      const previous_view = menu_node.dataset.sideMenuView;
      const current_view = menu_node.querySelector(
        `[data-side-menu-view-page="${previous_view}"]`,
      );
      const parent_view =
        current_view?.dataset.sideMenuParent ?? SITE_MENU_VIEW_DEFAULT;
      navigate_menu_view(menu_node, parent_view);
      return;
    }

    close_menu();
  });
};

import { SITE_MENU_VIEW_DEFAULT, get_safe_option } from "./preferences.js";

const set_view_page_state = (view_node, index, active_index) => {
  const is_active = index === active_index;
  view_node.dataset.viewPosition =
    index < active_index ? "before" : index > active_index ? "after" : "active";
  view_node.setAttribute("aria-hidden", is_active ? "false" : "true");
  view_node.inert = !is_active;
};

const set_menu_trigger_state = (trigger_node, is_open) => {
  if (!(trigger_node instanceof HTMLButtonElement)) return;
  trigger_node.setAttribute("aria-expanded", is_open ? "true" : "false");
  trigger_node.setAttribute(
    "aria-label",
    is_open ? "Close Solarisael menu" : "Open Solarisael menu",
  );
};

const panel_scroll_styles = new WeakMap();

const sync_dialog_lifecycle = (panel_node, is_open) => {
  if (is_open && !panel_node.open) {
    panel_node.inert = false;
    panel_node.removeAttribute("aria-hidden");
    panel_scroll_styles.set(
      panel_node,
      document.documentElement.style.overflow,
    );
    panel_node.showModal();
    document.documentElement.style.overflow = "hidden";
  } else if (!is_open && panel_node.open) {
    panel_node.close();
    document.documentElement.style.overflow =
      panel_scroll_styles.get(panel_node) ?? "";
    panel_scroll_styles.delete(panel_node);
  }
};

const set_menu_panel_state = (panel_node, is_open) => {
  if (!(panel_node instanceof HTMLElement)) return;
  if (panel_node instanceof HTMLDialogElement) {
    sync_dialog_lifecycle(panel_node, is_open);
  }
  panel_node.setAttribute("aria-hidden", is_open ? "false" : "true");
  panel_node.inert = !is_open;
};

const set_select_value = (select_node, value) => {
  if (select_node instanceof HTMLSelectElement) {
    select_node.value = value;
  }
};

const set_menu_view_state = (menu_node, requested_view) => {
  if (!(menu_node instanceof HTMLElement)) {
    return SITE_MENU_VIEW_DEFAULT;
  }

  const view_nodes = Array.from(
    menu_node.querySelectorAll("[data-side-menu-view-page]"),
  ).filter((node) => node instanceof HTMLElement);
  const available_views = view_nodes.map(
    (node) => node.dataset.sideMenuViewPage,
  );
  const safe_view = get_safe_option(
    requested_view,
    available_views,
    available_views.includes(SITE_MENU_VIEW_DEFAULT)
      ? SITE_MENU_VIEW_DEFAULT
      : available_views[0],
  );
  const active_index = Math.max(available_views.indexOf(safe_view), 0);

  menu_node.dataset.sideMenuView = safe_view;

  view_nodes.forEach((view_node, index) => {
    set_view_page_state(view_node, index, active_index);
  });

  for (const target_node of menu_node.querySelectorAll(
    "[data-side-menu-view-target]",
  )) {
    const is_current_target =
      target_node.dataset.sideMenuViewTarget === safe_view;
    target_node.setAttribute(
      "aria-expanded",
      is_current_target ? "true" : "false",
    );
  }

  return safe_view;
};

const should_animate_menu_close = (menu_node, panel_node, is_open) =>
  !is_open &&
  panel_node instanceof HTMLDialogElement &&
  panel_node.open &&
  menu_node.dataset.portalInkController === "ready" &&
  menu_node.dataset.portalPhase !== "closed";

const begin_menu_close = (menu_node, panel_node, trigger_node) => {
  if (!menu_node.dataset.portalPhase.startsWith("closing")) {
    menu_node.dataset.portalPhase =
      menu_node.dataset.portalPhase === "artifact" ? "closing" : "closing-ink";
    panel_node.addEventListener(
      "sol:portal-close-finished",
      () => {
        if (menu_node.dataset.sideMenuOpen !== "true") {
          set_menu_panel_state(panel_node, false);
          trigger_node?.focus({ preventScroll: true });
        }
      },
      { once: true },
    );
  }
};

const set_menu_state = (menu_node, is_open, view_name) => {
  if (!(menu_node instanceof HTMLElement)) return SITE_MENU_VIEW_DEFAULT;
  const safe_view = set_menu_view_state(menu_node, view_name);
  const trigger_node = menu_node.querySelector("[data-side-menu-trigger]");
  const panel_node = menu_node.querySelector("[data-side-menu-panel-shell]");
  if (is_open && menu_node.dataset.sideMenuOpen !== "true") {
    menu_node.dataset.portalPhase =
      menu_node.dataset.portalInkController === "ready" ? "ink" : "artifact";
  }
  menu_node.dataset.sideMenuOpen = is_open ? "true" : "false";
  set_menu_trigger_state(trigger_node, is_open);
  if (should_animate_menu_close(menu_node, panel_node, is_open)) {
    begin_menu_close(menu_node, panel_node, trigger_node);
    return safe_view;
  }
  if (!is_open) menu_node.dataset.portalPhase = "closed";
  set_menu_panel_state(panel_node, is_open);
  return safe_view;
};

const sync_side_menu_controls = (
  theme_name,
  shell_name,
  fx_name,
  scale_name,
  text_name,
  measure_name,
  menu_open,
  menu_view,
  display_name,
  fps_name,
) => {
  const menu_node = document.querySelector("#sol_side_menu");

  if (!(menu_node instanceof HTMLElement)) {
    return;
  }

  const theme_select_node = menu_node.querySelector(
    "[data-site-theme-control]",
  );
  const shell_select_node = menu_node.querySelector(
    "[data-site-shell-control]",
  );
  const fx_select_node = menu_node.querySelector("[data-site-fx-control]");
  const scale_select_node = menu_node.querySelector(
    "[data-site-scale-control]",
  );
  const display_select_node = menu_node.querySelector(
    "[data-site-display-control]",
  );
  const fps_select_node = menu_node.querySelector("[data-site-fps-control]");
  const text_select_node = menu_node.querySelector("[data-user-text-control]");
  const measure_select_node = menu_node.querySelector(
    "[data-user-measure-control]",
  );

  set_select_value(theme_select_node, theme_name);
  set_select_value(shell_select_node, shell_name);
  set_select_value(fx_select_node, fx_name);
  set_select_value(scale_select_node, scale_name);
  set_select_value(display_select_node, display_name);
  set_select_value(fps_select_node, fps_name);
  set_select_value(text_select_node, text_name);
  set_select_value(measure_select_node, measure_name);

  set_menu_state(menu_node, menu_open, menu_view);
};

export { set_menu_view_state, set_menu_state, sync_side_menu_controls };

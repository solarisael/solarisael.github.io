import {
  derive_request_pathname,
  is_route_swap_target,
} from "./htmx_route_lifecycle.js";
import {
  apply_side_menu_route_state,
  invalidate_side_menu_route_state,
} from "./menu/route_state.js";
import { bind_navigation_controls } from "./menu/navigation_controls.js";
import { bind_settings_controls } from "./menu/settings_controls.js";
import { sync_side_menu_controls } from "./menu/view_state.js";
import {
  apply_site_style_state,
  apply_user_settings_state,
  resolve_saved_style,
  resolve_saved_user_settings,
  resolve_saved_menu_state,
} from "./menu/preferences.js";
import {
  bind_effect_controls,
  restore_effect_controls,
} from "./menu/effect_controls.js";

const window_any = /** @type {any} */ (globalThis);
const initialized_menus = new WeakSet();

const apply_saved_preferences = () => {
  if (typeof document === "undefined") {
    return;
  }

  const {
    saved_theme_class,
    saved_scale_class,
    saved_display_class,
    saved_fps_class,
  } = resolve_saved_style();
  const { saved_text_class, saved_measure_class } =
    resolve_saved_user_settings();
  const { saved_menu_open, saved_menu_view } = resolve_saved_menu_state();

  apply_site_style_state(
    document.documentElement,
    saved_theme_class,
    saved_scale_class,
    saved_display_class,
    saved_fps_class,
  );
  apply_user_settings_state(
    document.documentElement,
    saved_text_class,
    saved_measure_class,
  );
  sync_side_menu_controls(
    saved_theme_class,
    saved_scale_class,
    saved_text_class,
    saved_measure_class,
    saved_menu_open,
    saved_menu_view,
    saved_display_class,
    saved_fps_class,
  );
  restore_effect_controls(document.querySelector("#sol_side_menu"));
};

const bind_side_menu_controls = () => {
  if (typeof document === "undefined") {
    return;
  }

  const menu_node = document.querySelector("#sol_side_menu");

  if (!(menu_node instanceof HTMLElement)) {
    return;
  }

  if (initialized_menus.has(menu_node)) {
    return;
  }

  initialized_menus.add(menu_node);
  bind_navigation_controls(menu_node);
  bind_settings_controls(menu_node);
  bind_effect_controls(menu_node);
};

const init_side_menu = () => {
  apply_saved_preferences();
  bind_side_menu_controls();
  invalidate_side_menu_route_state();
  apply_side_menu_route_state();
};

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  !window_any.__side_menu_init_bound
) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init_side_menu);
  } else {
    init_side_menu();
  }

  window_any.__side_menu_init_bound = true;
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  !window_any.__side_menu_htmx_after_swap_bound
) {
  document.body?.addEventListener("htmx:afterSwap", (event) => {
    apply_saved_preferences();
    bind_side_menu_controls();

    if (!is_route_swap_target(event.target)) {
      return;
    }

    invalidate_side_menu_route_state();
    apply_side_menu_route_state(
      derive_request_pathname(event) ?? window.location.pathname,
    );
  });
  document.body?.addEventListener("htmx:historyRestore", init_side_menu);

  window_any.__side_menu_htmx_after_swap_bound = true;
}

if (typeof window !== "undefined" && !window_any.__side_menu_popstate_bound) {
  window.addEventListener("popstate", () => {
    invalidate_side_menu_route_state();
    apply_side_menu_route_state();
  });
  window_any.__side_menu_popstate_bound = true;
}

export { init_side_menu, apply_side_menu_route_state };
export { set_menu_view_state } from "./menu/view_state.js";
export {
  COOKIE_MAX_AGE_SECONDS,
  LEGACY_HOME_THEME_COOKIE_NAME,
  SITE_DISPLAY_COOKIE_NAME,
  SITE_DISPLAY_DEFAULT,
  SITE_FPS_COOKIE_NAME,
  SITE_FPS_DEFAULT,
  SITE_SCALE_COOKIE_NAME,
  SITE_SCALE_DEFAULT,
  SITE_MENU_OPEN_COOKIE_NAME,
  SITE_MENU_OPEN_DEFAULT,
  SITE_MENU_VIEW_COOKIE_NAME,
  SITE_MENU_VIEW_DEFAULT,
  SITE_THEME_COOKIE_NAME,
  SITE_THEME_DEFAULT,
  USER_MEASURE_COOKIE_NAME,
  USER_MEASURE_DEFAULT,
  USER_TEXT_COOKIE_NAME,
  USER_TEXT_DEFAULT,
  apply_site_style_state,
  apply_user_settings_state,
  build_cookie_string,
  get_safe_option,
  has_site_root,
  legacy_theme_alias_map,
  normalize_legacy_theme_value,
  normalize_theme_alias_value,
  parse_cookie_map,
  read_cookie_value,
  resolve_saved_menu_state,
  resolve_saved_style,
  resolve_saved_user_settings,
  site_display_options,
  site_fps_options,
  site_scale_options,
  site_theme_options,
  user_measure_options,
  user_text_options,
} from "./menu/preferences.js";

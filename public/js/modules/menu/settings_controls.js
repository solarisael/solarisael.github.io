import {
  SITE_DISPLAY_COOKIE_NAME,
  SITE_DISPLAY_DEFAULT,
  SITE_FPS_COOKIE_NAME,
  SITE_FPS_DEFAULT,
  SITE_SCALE_COOKIE_NAME,
  SITE_SCALE_DEFAULT,
  SITE_THEME_COOKIE_NAME,
  SITE_THEME_DEFAULT,
  USER_MEASURE_COOKIE_NAME,
  USER_MEASURE_DEFAULT,
  USER_TEXT_COOKIE_NAME,
  USER_TEXT_DEFAULT,
  apply_site_style_state,
  apply_user_settings_state,
  get_safe_option,
  resolve_saved_style,
  resolve_saved_user_settings,
  site_display_options,
  site_fps_options,
  site_scale_options,
  site_theme_options,
  user_measure_options,
  user_text_options,
  write_cookie_value,
  delete_cookie_value,
} from "./preferences.js";
import { sync_side_menu_controls } from "./view_state.js";
import { reset_effect_controls } from "./effect_controls.js";

const bind_select_change = (select_node, commit_state) => {
  if (select_node instanceof HTMLSelectElement) {
    select_node.addEventListener("change", commit_state);
  }
};

export const bind_settings_controls = (menu_node) => {
  const theme_select_node = menu_node.querySelector(
    "[data-site-theme-control]",
  );
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

  const commit_site_state = () => {
    const selected_theme_name = get_safe_option(
      theme_select_node instanceof HTMLSelectElement
        ? theme_select_node.value
        : SITE_THEME_DEFAULT,
      site_theme_options,
      SITE_THEME_DEFAULT,
    );
    const selected_scale_name = get_safe_option(
      scale_select_node instanceof HTMLSelectElement
        ? scale_select_node.value
        : SITE_SCALE_DEFAULT,
      site_scale_options,
      SITE_SCALE_DEFAULT,
    );
    const selected_display_name = get_safe_option(
      display_select_node instanceof HTMLSelectElement
        ? display_select_node.value
        : SITE_DISPLAY_DEFAULT,
      site_display_options,
      SITE_DISPLAY_DEFAULT,
    );
    const selected_fps_name = get_safe_option(
      fps_select_node instanceof HTMLSelectElement
        ? fps_select_node.value
        : SITE_FPS_DEFAULT,
      site_fps_options,
      SITE_FPS_DEFAULT,
    );

    apply_site_style_state(
      document.documentElement,
      selected_theme_name,
      selected_scale_name,
      selected_display_name,
      selected_fps_name,
    );
    write_cookie_value(SITE_THEME_COOKIE_NAME, selected_theme_name);
    write_cookie_value(SITE_SCALE_COOKIE_NAME, selected_scale_name);
    write_cookie_value(SITE_DISPLAY_COOKIE_NAME, selected_display_name);
    write_cookie_value(SITE_FPS_COOKIE_NAME, selected_fps_name);
  };

  const commit_user_state = () => {
    const selected_text_name = get_safe_option(
      text_select_node instanceof HTMLSelectElement
        ? text_select_node.value
        : USER_TEXT_DEFAULT,
      user_text_options,
      USER_TEXT_DEFAULT,
    );
    const selected_measure_name = get_safe_option(
      measure_select_node instanceof HTMLSelectElement
        ? measure_select_node.value
        : USER_MEASURE_DEFAULT,
      user_measure_options,
      USER_MEASURE_DEFAULT,
    );

    apply_user_settings_state(
      document.documentElement,
      selected_text_name,
      selected_measure_name,
    );
    write_cookie_value(USER_TEXT_COOKIE_NAME, selected_text_name);
    write_cookie_value(USER_MEASURE_COOKIE_NAME, selected_measure_name);
  };

  bind_select_change(theme_select_node, commit_site_state);
  bind_select_change(scale_select_node, commit_site_state);
  bind_select_change(display_select_node, commit_site_state);
  bind_select_change(fps_select_node, commit_site_state);
  bind_select_change(text_select_node, commit_user_state);
  bind_select_change(measure_select_node, commit_user_state);

  for (const reset_node of menu_node.querySelectorAll(
    "[data-side-menu-reset]",
  )) {
    if (!(reset_node instanceof HTMLButtonElement)) continue;
    reset_node.addEventListener("click", () => {
      if (reset_node.dataset.sideMenuReset === "site") {
        reset_effect_controls(menu_node);
      }
      const cookie_names =
        reset_node.dataset.sideMenuReset === "site"
          ? [
              SITE_THEME_COOKIE_NAME,
              SITE_SCALE_COOKIE_NAME,
              SITE_DISPLAY_COOKIE_NAME,
              SITE_FPS_COOKIE_NAME,
            ]
          : [USER_TEXT_COOKIE_NAME, USER_MEASURE_COOKIE_NAME];
      for (const cookie_name of cookie_names) delete_cookie_value(cookie_name);

      const {
        saved_theme_class,
        saved_scale_class,
        saved_display_class,
        saved_fps_class,
      } = resolve_saved_style();
      const { saved_text_class, saved_measure_class } =
        resolve_saved_user_settings();
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
        true,
        menu_node.dataset.sideMenuView,
        saved_display_class,
        saved_fps_class,
      );
    });
  }
};

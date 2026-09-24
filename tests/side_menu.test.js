import { describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import {
  COOKIE_MAX_AGE_SECONDS,
  LEGACY_HOME_THEME_COOKIE_NAME,
  SITE_FPS_COOKIE_NAME,
  SITE_FPS_DEFAULT,
  SITE_SCALE_DEFAULT,
  SITE_MENU_OPEN_DEFAULT,
  SITE_THEME_COOKIE_NAME,
  SITE_THEME_DEFAULT,
  USER_MEASURE_DEFAULT,
  USER_TEXT_DEFAULT,
  apply_site_style_state,
  build_cookie_string,
  get_safe_option,
  normalize_legacy_theme_value,
  normalize_theme_alias_value,
  parse_cookie_map,
  read_cookie_value,
  resolve_saved_menu_state,
  resolve_saved_style,
  resolve_saved_user_settings,
  set_menu_view_state,
  site_theme_options,
  user_measure_options,
  user_text_options,
} from "../public/js/modules/side_menu.js";
import {
  resolve_effect_preferences,
  resolve_effect_preset,
} from "../public/js/modules/menu/effect_preferences.js";

if (!globalThis.window) {
  GlobalRegistrator.register({ url: "https://solarisael.local/current/" });
}

describe("side_menu cookie parsing", () => {
  test("parse_cookie_map returns expected values", () => {
    const cookie_map = parse_cookie_map(
      "site_theme=gilded_arcane; site_fx=bold; site_shell=strong",
    );

    expect(cookie_map.site_theme).toBe("gilded_arcane");
    expect(cookie_map.site_fx).toBe("bold");
    expect(cookie_map.site_shell).toBe("strong");
  });

  test("read_cookie_value returns null when missing", () => {
    expect(read_cookie_value("missing_key", "site_fx=subtle")).toBeNull();
  });

  test("build_cookie_string uses expected persistence attributes", () => {
    const cookie_string = build_cookie_string(
      SITE_THEME_COOKIE_NAME,
      "cosmic_overlay",
      COOKIE_MAX_AGE_SECONDS,
    );

    expect(cookie_string).toContain("site_theme=cosmic_overlay");
    expect(cookie_string).toContain("path=/");
    expect(cookie_string).toContain(`max-age=${COOKIE_MAX_AGE_SECONDS}`);
    expect(cookie_string).toContain("SameSite=Lax");
  });
});

describe("side_menu option safety", () => {
  test("get_safe_option accepts only allowed values", () => {
    expect(
      get_safe_option("solarisael", site_theme_options, SITE_THEME_DEFAULT),
    ).toBe("solarisael");
    expect(
      get_safe_option("cosmic_overlay", site_theme_options, SITE_THEME_DEFAULT),
    ).toBe(SITE_THEME_DEFAULT);
  });

  test("legacy normalizers map old values", () => {
    expect(normalize_legacy_theme_value("site_theme_vibrant")).toBe(
      "solarisael",
    );
    expect(normalize_theme_alias_value("golden_mystical_tarot")).toBe(
      "solarisael",
    );
    expect(normalize_theme_alias_value("cosmic_themed")).toBe("solarisael");
    expect(normalize_legacy_theme_value("bad")).toBeNull();
    expect(normalize_theme_alias_value(42)).toBeNull();
  });

  test("resolve_saved_style falls back on invalid cookie values", () => {
    const resolved_style = resolve_saved_style(
      "site_theme=nope; site_fx=not_real; site_shell=invalid; site_scale=huge",
    );

    expect(resolved_style.saved_theme_class).toBe(SITE_THEME_DEFAULT);
    expect(resolved_style.saved_scale_class).toBe(SITE_SCALE_DEFAULT);
  });

  test("resolve_saved_style accepts valid cookie values", () => {
    const resolved_style = resolve_saved_style(
      "site_theme=solarisael; site_fx=subtle; site_shell=strong; site_scale=80",
    );

    expect(resolved_style.saved_theme_class).toBe("solarisael");
    expect(resolved_style.saved_scale_class).toBe("80");
  });

  test.each(["60", "120", "display"])(
    "saved pacing %s reaches the site root",
    (fps) => {
      const cookie = build_cookie_string(SITE_FPS_COOKIE_NAME, fps);
      const saved = resolve_saved_style(cookie);
      const root = document.createElement("div");

      apply_site_style_state(
        root,
        saved.saved_theme_class,
        saved.saved_scale_class,
        saved.saved_display_class,
        saved.saved_fps_class,
      );

      expect(saved.saved_fps_class).toBe(fps);
      expect(root.getAttribute("data-site-fps")).toBe(fps);
    },
  );

  test.each([
    "",
    `${SITE_FPS_COOKIE_NAME}=`,
    `${SITE_FPS_COOKIE_NAME}=30`,
    `${SITE_FPS_COOKIE_NAME}=120fps`,
    `${SITE_FPS_COOKIE_NAME}=DISPLAY`,
  ])("missing or malformed pacing falls back: %s", (cookie) => {
    const saved = resolve_saved_style(cookie);
    const root = document.createElement("div");

    apply_site_style_state(
      root,
      saved.saved_theme_class,
      saved.saved_scale_class,
      saved.saved_display_class,
      saved.saved_fps_class,
    );

    expect(saved.saved_fps_class).toBe(SITE_FPS_DEFAULT);
    expect(root.getAttribute("data-site-fps")).toBe(SITE_FPS_DEFAULT);
  });

  test("resolve_saved_style supports legacy cookies", () => {
    const resolved_style = resolve_saved_style(
      `${LEGACY_HOME_THEME_COOKIE_NAME}=site_theme_arcane`,
    );

    expect(resolved_style.saved_theme_class).toBe("solarisael");
  });

  test("resolve_saved_style normalizes external alias values", () => {
    const resolved_style = resolve_saved_style(
      "site_theme=golden_mystical_tarot; site_fx=balanced; site_shell=medium",
    );

    expect(resolved_style.saved_theme_class).toBe("solarisael");
  });

  test("resolve_saved_user_settings accepts valid text and measure cookies", () => {
    const resolved_user_settings = resolve_saved_user_settings(
      "user_text=large; user_measure=wide",
    );

    expect(
      user_text_options.includes(resolved_user_settings.saved_text_class),
    ).toBe(true);
    expect(resolved_user_settings.saved_text_class).toBe("large");
    expect(
      user_measure_options.includes(resolved_user_settings.saved_measure_class),
    ).toBe(true);
    expect(resolved_user_settings.saved_measure_class).toBe("wide");
  });

  test("resolve_saved_user_settings falls back on invalid user cookies", () => {
    const resolved_user_settings = resolve_saved_user_settings(
      "user_text=tiny; user_measure=endless",
    );

    expect(resolved_user_settings.saved_text_class).toBe(USER_TEXT_DEFAULT);
    expect(resolved_user_settings.saved_measure_class).toBe(
      USER_MEASURE_DEFAULT,
    );
  });

  test("resolve_saved_menu_state preserves a requested generic view", () => {
    const open_state = resolve_saved_menu_state(
      "site_menu_open=true; site_menu_view=settings",
    );
    const closed_state = resolve_saved_menu_state(
      "site_menu_open=false; site_menu_view=root",
    );

    expect(open_state.saved_menu_open).toBe(true);
    expect(open_state.saved_menu_view).toBe("settings");
    expect(closed_state.saved_menu_open).toBe(false);
    expect(closed_state.saved_menu_view).toBe("root");
  });

  test("resolve_saved_menu_state defers view availability to the rendered menu", () => {
    const resolved_menu_state = resolve_saved_menu_state(
      "site_menu_open=maybe; site_menu_view=future-pane",
    );

    expect(resolved_menu_state.saved_menu_open).toBe(SITE_MENU_OPEN_DEFAULT);
    expect(resolved_menu_state.saved_menu_view).toBe("future-pane");
  });
});

describe("side_menu generic view states", () => {
  test("orders any rendered pane around the requested active view", () => {
    document.body.replaceChildren();
    const menu = document.createElement("div");
    menu.innerHTML = `
      <section data-side-menu-view-page="root"></section>
      <section data-side-menu-view-page="settings"></section>
      <section data-side-menu-view-page="future-pane"></section>
      <button data-side-menu-view-target="root"></button>
      <button data-side-menu-view-target="settings"></button>
      <button data-side-menu-view-target="future-pane"></button>
    `;
    document.body.append(menu);

    expect(set_menu_view_state(menu, "future-pane")).toBe("future-pane");
    expect(menu.dataset.sideMenuView).toBe("future-pane");

    const panes = [...menu.querySelectorAll("[data-side-menu-view-page]")];
    expect(panes.map((pane) => pane.dataset.viewPosition)).toEqual([
      "before",
      "before",
      "active",
    ]);
    expect(panes.map((pane) => pane.getAttribute("aria-hidden"))).toEqual([
      "true",
      "true",
      "false",
    ]);
    expect(panes.map((pane) => pane.inert)).toEqual([true, true, false]);
    expect(
      menu
        .querySelector('[data-side-menu-view-target="future-pane"]')
        .getAttribute("aria-expanded"),
    ).toBe("true");

    expect(set_menu_view_state(menu, "missing")).toBe("root");
    expect(panes.map((pane) => pane.dataset.viewPosition)).toEqual([
      "active",
      "after",
      "after",
    ]);
  });
});

describe("effect preference cutover", () => {
  test("legacy shell and home effects migrate with current-cookie precedence", () => {
    expect(
      resolve_effect_preferences("site_shell=subtle; home_fx=home_fx_bold"),
    ).toEqual({ ornaments: 74, shell_glow: 82, folly_intensity: 128 });
    expect(
      resolve_effect_preferences(
        "site_shell=strong; site_fx=invalid; home_fx=home_fx_bold",
      ),
    ).toEqual({ ornaments: 95, shell_glow: 118, folly_intensity: 100 });
  });

  test("zero survives while excessive and nonnumeric channels normalize independently", () => {
    const value = encodeURIComponent(
      JSON.stringify({ ornaments: 0, shell_glow: 300, folly_intensity: "80" }),
    );
    expect(
      resolve_effect_preferences(`site_theme=%E0%A4%A; site_effects=${value}`),
    ).toEqual({ ornaments: 0, shell_glow: 200, folly_intensity: 100 });
  });

  test("corrupt canonical preferences never resurrect superseded presets", () => {
    for (const value of ["broken-json", "null", "%E0%A4%A"]) {
      expect(
        resolve_effect_preferences(
          `site_effects=${value}; site_shell=strong; site_fx=bold`,
        ),
      ).toEqual({ ornaments: 90, shell_glow: 100, folly_intensity: 100 });
    }
  });

  test("mixed categories and manual changes cannot claim an overall preset", () => {
    const values = { ornaments: 74, shell_glow: 82, folly_intensity: 128 };
    expect(resolve_effect_preset(values)).toBe("custom");
    expect(resolve_effect_preset(values, "shell")).toBe("subtle");
    expect(resolve_effect_preset(values, "folly")).toBe("bold");
    values.ornaments = 75;
    expect(resolve_effect_preset(values, "shell")).toBe("custom");
    expect(resolve_effect_preset(values, "folly")).toBe("bold");
  });
});

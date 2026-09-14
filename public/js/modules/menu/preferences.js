const SITE_THEME_COOKIE_NAME = "site_theme";
const SITE_SHELL_COOKIE_NAME = "site_shell";
const SITE_FX_COOKIE_NAME = "site_fx";
const SITE_SCALE_COOKIE_NAME = "site_scale";
const SITE_DISPLAY_COOKIE_NAME = "site_display";
const SITE_FPS_COOKIE_NAME = "site_fps";
const SITE_MENU_OPEN_COOKIE_NAME = "site_menu_open";
const SITE_MENU_VIEW_COOKIE_NAME = "site_menu_view";
const USER_TEXT_COOKIE_NAME = "user_text";
const USER_MEASURE_COOKIE_NAME = "user_measure";

const LEGACY_HOME_THEME_COOKIE_NAME = "home_theme";
const LEGACY_HOME_FX_COOKIE_NAME = "home_fx";

const SITE_THEME_DEFAULT = "solarisael";
const SITE_SHELL_DEFAULT = "medium";
const SITE_FX_DEFAULT = "balanced";
const SITE_SCALE_DEFAULT = "100";
const SITE_DISPLAY_DEFAULT = "sdr";
const SITE_FPS_DEFAULT = "60";
const SITE_MENU_OPEN_DEFAULT = false;
const SITE_MENU_VIEW_DEFAULT = "root";
const USER_TEXT_DEFAULT = "normal";
const USER_MEASURE_DEFAULT = "comfort";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const site_theme_options = ["solarisael"];
const site_shell_options = ["subtle", "medium", "strong"];
const site_fx_options = ["subtle", "balanced", "bold"];
const site_scale_options = ["100", "90", "80"];
const site_display_options = ["sdr", "hdr"];
const site_fps_options = ["60", "120", "display"];
const user_text_options = ["compact", "normal", "large"];
const user_measure_options = ["focused", "comfort", "wide"];

const legacy_theme_alias_map = {
  ritual: "solarisael",
  vibrant: "solarisael",
  gilded_arcana: "solarisael",
  arcane: "solarisael",
  verdigris: "solarisael",
  golden_mystical_tarot: "solarisael",
  astrology_themed: "solarisael",
  cosmic_themed: "solarisael",
  wicca_ornamentation: "solarisael",
  gothic_dark_girl: "solarisael",
  relic_gothic: "solarisael",
  grimdark_tarot: "solarisael",
  cinza: "solarisael",
};

const parse_cookie_map = (cookie_header = "") => {
  const cookie_map = {};

  for (const cookie_pair of String(cookie_header).split(";")) {
    const [raw_key, ...raw_value_parts] = cookie_pair.split("=");
    const cookie_key = raw_key?.trim();

    if (!cookie_key) {
      continue;
    }

    cookie_map[cookie_key] = decodeURIComponent(
      raw_value_parts.join("=").trim(),
    );
  }

  return cookie_map;
};

const read_cookie_value = (cookie_name, cookie_header = null) => {
  if (cookie_header === null && typeof document === "undefined") {
    return null;
  }

  const cookie_map = parse_cookie_map(cookie_header ?? document.cookie);
  return cookie_map[cookie_name] ?? null;
};

const build_cookie_string = (
  cookie_name,
  cookie_value,
  max_age_seconds = COOKIE_MAX_AGE_SECONDS,
) => {
  return `${cookie_name}=${encodeURIComponent(cookie_value)}; path=/; max-age=${max_age_seconds}; SameSite=Lax`;
};

const write_cookie_value = (cookie_name, cookie_value) => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = build_cookie_string(cookie_name, cookie_value);
};

const delete_cookie_value = (cookie_name) => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = build_cookie_string(cookie_name, "", 0);
};

const get_safe_option = (candidate_value, allowed_options, fallback_value) => {
  if (allowed_options.includes(candidate_value)) {
    return candidate_value;
  }

  return fallback_value;
};

const has_site_root = (node_value) => {
  return (
    typeof node_value === "object" &&
    node_value !== null &&
    typeof node_value.setAttribute === "function"
  );
};

const apply_site_style_state = (
  site_root,
  theme_name,
  shell_name,
  fx_name,
  scale_name = SITE_SCALE_DEFAULT,
  display_name = SITE_DISPLAY_DEFAULT,
  fps_name = SITE_FPS_DEFAULT,
) => {
  if (!has_site_root(site_root)) {
    return;
  }

  site_root.setAttribute("data-site-theme", theme_name);
  site_root.setAttribute("data-site-shell", shell_name);
  site_root.setAttribute("data-site-fx", fx_name);
  site_root.setAttribute("data-site-scale", scale_name);
  site_root.setAttribute("data-site-display", display_name);
  site_root.setAttribute("data-site-fps", fps_name);
};

const apply_user_settings_state = (site_root, text_name, measure_name) => {
  if (!has_site_root(site_root)) {
    return;
  }

  site_root.setAttribute("data-user-text", text_name);
  site_root.setAttribute("data-user-measure", measure_name);
};

const normalize_legacy_fx_value = (legacy_fx_value) => {
  if (typeof legacy_fx_value !== "string") {
    return null;
  }

  return legacy_fx_value.replace(/^home_fx_/, "");
};

const normalize_legacy_theme_value = (legacy_theme_value) => {
  if (typeof legacy_theme_value !== "string") {
    return null;
  }

  const normalized_theme = legacy_theme_value.replace(/^site_theme_/, "");
  return legacy_theme_alias_map[normalized_theme] ?? null;
};

const normalize_theme_alias_value = (theme_value) => {
  if (typeof theme_value !== "string") {
    return null;
  }

  return legacy_theme_alias_map[theme_value] ?? theme_value;
};

const resolve_saved_style = (cookie_header = null) => {
  const saved_theme_class = get_safe_option(
    normalize_theme_alias_value(
      read_cookie_value(SITE_THEME_COOKIE_NAME, cookie_header),
    ) ??
      normalize_legacy_theme_value(
        read_cookie_value(LEGACY_HOME_THEME_COOKIE_NAME, cookie_header),
      ),
    site_theme_options,
    SITE_THEME_DEFAULT,
  );

  const saved_shell_class = get_safe_option(
    read_cookie_value(SITE_SHELL_COOKIE_NAME, cookie_header),
    site_shell_options,
    SITE_SHELL_DEFAULT,
  );

  const saved_fx_class = get_safe_option(
    read_cookie_value(SITE_FX_COOKIE_NAME, cookie_header) ??
      normalize_legacy_fx_value(
        read_cookie_value(LEGACY_HOME_FX_COOKIE_NAME, cookie_header),
      ),
    site_fx_options,
    SITE_FX_DEFAULT,
  );
  const saved_scale_class = get_safe_option(
    read_cookie_value(SITE_SCALE_COOKIE_NAME, cookie_header),
    site_scale_options,
    SITE_SCALE_DEFAULT,
  );
  const saved_display_class = get_safe_option(
    read_cookie_value(SITE_DISPLAY_COOKIE_NAME, cookie_header),
    site_display_options,
    SITE_DISPLAY_DEFAULT,
  );
  const saved_fps_class = get_safe_option(
    read_cookie_value(SITE_FPS_COOKIE_NAME, cookie_header),
    site_fps_options,
    SITE_FPS_DEFAULT,
  );

  return {
    saved_theme_class,
    saved_shell_class,
    saved_fx_class,
    saved_scale_class,
    saved_display_class,
    saved_fps_class,
  };
};

const resolve_saved_user_settings = (cookie_header = null) => {
  const saved_text_class = get_safe_option(
    read_cookie_value(USER_TEXT_COOKIE_NAME, cookie_header),
    user_text_options,
    USER_TEXT_DEFAULT,
  );
  const saved_measure_class = get_safe_option(
    read_cookie_value(USER_MEASURE_COOKIE_NAME, cookie_header),
    user_measure_options,
    USER_MEASURE_DEFAULT,
  );

  return {
    saved_text_class,
    saved_measure_class,
  };
};

const resolve_saved_menu_state = (cookie_header = null) => {
  const raw_open_value = read_cookie_value(
    SITE_MENU_OPEN_COOKIE_NAME,
    cookie_header,
  );
  const saved_menu_open =
    raw_open_value === "true"
      ? true
      : raw_open_value === "false"
        ? false
        : SITE_MENU_OPEN_DEFAULT;
  const saved_menu_view =
    read_cookie_value(SITE_MENU_VIEW_COOKIE_NAME, cookie_header) ??
    SITE_MENU_VIEW_DEFAULT;

  return {
    saved_menu_open,
    saved_menu_view,
  };
};

export {
  COOKIE_MAX_AGE_SECONDS,
  LEGACY_HOME_FX_COOKIE_NAME,
  LEGACY_HOME_THEME_COOKIE_NAME,
  SITE_DISPLAY_COOKIE_NAME,
  SITE_DISPLAY_DEFAULT,
  SITE_FPS_COOKIE_NAME,
  SITE_FPS_DEFAULT,
  SITE_FX_COOKIE_NAME,
  SITE_FX_DEFAULT,
  SITE_SCALE_COOKIE_NAME,
  SITE_SCALE_DEFAULT,
  SITE_MENU_OPEN_COOKIE_NAME,
  SITE_MENU_OPEN_DEFAULT,
  SITE_MENU_VIEW_COOKIE_NAME,
  SITE_MENU_VIEW_DEFAULT,
  SITE_SHELL_COOKIE_NAME,
  SITE_SHELL_DEFAULT,
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
  normalize_legacy_fx_value,
  normalize_legacy_theme_value,
  normalize_theme_alias_value,
  parse_cookie_map,
  read_cookie_value,
  resolve_saved_menu_state,
  resolve_saved_style,
  resolve_saved_user_settings,
  site_display_options,
  site_fps_options,
  site_fx_options,
  site_scale_options,
  site_shell_options,
  site_theme_options,
  user_measure_options,
  user_text_options,
  write_cookie_value,
  delete_cookie_value,
};

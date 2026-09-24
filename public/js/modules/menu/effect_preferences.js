import { parse_cookie_map } from "./preferences.js";

export const EFFECT_COOKIE_NAME = "site_effects";
export const LEGACY_EFFECT_COOKIE_NAMES = ["site_shell", "site_fx", "home_fx"];

export const effect_presets = {
  subtle: { ornaments: 74, shell_glow: 82, folly_intensity: 80 },
  balanced: { ornaments: 90, shell_glow: 100, folly_intensity: 100 },
  bold: { ornaments: 95, shell_glow: 118, folly_intensity: 128 },
};

export const effect_categories = [
  {
    id: "shell",
    label: "Shell decoration",
    sliders: [
      {
        key: "ornaments",
        label: "Ornament opacity",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: effect_presets.balanced.ornaments,
        cssProperty: "--cinza_reliquary_opacity",
      },
      {
        key: "shell_glow",
        label: "Ornament glow",
        min: 0,
        max: 200,
        step: 1,
        defaultValue: effect_presets.balanced.shell_glow,
        cssProperty: "--site_shell_glow_mult",
      },
    ],
  },
  {
    id: "folly",
    label: "Scripts of Folly",
    sliders: [
      {
        key: "folly_intensity",
        label: "Visual intensity",
        min: 20,
        max: 200,
        step: 1,
        defaultValue: effect_presets.balanced.folly_intensity,
        cssProperty: "--site_fx_glow_mult",
      },
    ],
  },
];

export const effect_sliders = effect_categories.flatMap(
  ({ sliders }) => sliders,
);

const normalize_effect_values = (candidate) => {
  const values = { ...effect_presets.balanced };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return values;
  }

  for (const { key, min, max } of effect_sliders) {
    const value = candidate[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      values[key] = Math.min(max, Math.max(min, Math.round(value)));
    }
  }

  return values;
};

const resolve_legacy_effect_values = (cookies) => {
  const values = { ...effect_presets.balanced };
  const shell_name = { subtle: "subtle", medium: "balanced", strong: "bold" }[
    cookies.site_shell
  ];
  const shell = Object.hasOwn(effect_presets, shell_name)
    ? effect_presets[shell_name]
    : null;
  if (shell) {
    values.ornaments = shell.ornaments;
    values.shell_glow = shell.shell_glow;
  }

  const folly_name =
    cookies.site_fx ?? cookies.home_fx?.replace(/^home_fx_/, "");
  if (Object.hasOwn(effect_presets, folly_name)) {
    values.folly_intensity = effect_presets[folly_name].folly_intensity;
  }

  return values;
};

export const resolve_effect_preferences = (cookie_header = null) => {
  const cookies = parse_cookie_map(
    cookie_header ?? (typeof document === "undefined" ? "" : document.cookie),
  );
  const stored = cookies[EFFECT_COOKIE_NAME];
  if (stored === undefined) return resolve_legacy_effect_values(cookies);

  try {
    return normalize_effect_values(JSON.parse(stored));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    // A corrupt current preference must not resurrect superseded cookies.
    return { ...effect_presets.balanced };
  }
};

export const apply_effect_preferences = (root, candidate) => {
  const values = normalize_effect_values(candidate);
  for (const { key, cssProperty } of effect_sliders) {
    root.style.setProperty(cssProperty, String(values[key] / 100));
  }
};

export const resolve_effect_preset = (values, category = "all") => {
  const sliders =
    category === "all"
      ? effect_sliders
      : effect_categories.find(({ id }) => id === category)?.sliders;
  if (!sliders) return "custom";

  for (const [name, preset] of Object.entries(effect_presets)) {
    if (sliders.every(({ key }) => values[key] === preset[key])) return name;
  }

  return "custom";
};

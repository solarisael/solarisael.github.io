import {
  delete_cookie_value,
  read_cookie_value,
  write_cookie_value,
} from "./preferences.js";
import {
  EFFECT_COOKIE_NAME,
  LEGACY_EFFECT_COOKIE_NAMES,
  apply_effect_preferences,
  effect_categories,
  effect_presets,
  effect_sliders,
  resolve_effect_preferences,
  resolve_effect_preset,
} from "./effect_preferences.js";

const sync_effect_controls = (menu, values) => {
  for (const { key } of effect_sliders) {
    const input = menu.querySelector(`[data-effect-slider="${key}"]`);
    const output = menu.querySelector(`[data-effect-value="${key}"]`);
    if (input) input.value = String(values[key]);
    if (output) output.textContent = `${values[key]}%`;
  }

  for (const select of menu.querySelectorAll("[data-effect-preset]")) {
    select.value = resolve_effect_preset(values, select.dataset.effectPreset);
  }
};

const remove_legacy_effect_cookies = () => {
  for (const name of LEGACY_EFFECT_COOKIE_NAMES) {
    if (read_cookie_value(name) !== null) delete_cookie_value(name);
  }
};

const commit_effect_controls = (menu, values) => {
  write_cookie_value(EFFECT_COOKIE_NAME, JSON.stringify(values));
  apply_effect_preferences(document.documentElement, values);
  sync_effect_controls(menu, values);
};

export const restore_effect_controls = (menu) => {
  if (!menu) return;

  const values = resolve_effect_preferences();
  if (read_cookie_value(EFFECT_COOKIE_NAME) === null) {
    write_cookie_value(EFFECT_COOKIE_NAME, JSON.stringify(values));
  }
  remove_legacy_effect_cookies();
  apply_effect_preferences(document.documentElement, values);
  sync_effect_controls(menu, values);
};

export const reset_effect_controls = (menu) => {
  remove_legacy_effect_cookies();
  commit_effect_controls(menu, { ...effect_presets.balanced });
};

export const bind_effect_controls = (menu) => {
  for (const input of menu.querySelectorAll("[data-effect-slider]")) {
    const key = input.dataset.effectSlider;
    if (!effect_sliders.some((slider) => slider.key === key)) continue;

    input.addEventListener("input", () => {
      const values = resolve_effect_preferences();
      values[key] = input.valueAsNumber;
      commit_effect_controls(menu, values);
    });
  }

  for (const select of menu.querySelectorAll("[data-effect-preset]")) {
    select.addEventListener("change", () => {
      if (!Object.hasOwn(effect_presets, select.value)) return;

      const category = select.dataset.effectPreset;
      const sliders =
        category === "all"
          ? effect_sliders
          : effect_categories.find(({ id }) => id === category)?.sliders;
      if (!sliders) return;

      const values = resolve_effect_preferences();
      const preset = effect_presets[select.value];
      for (const { key } of sliders) values[key] = preset[key];
      commit_effect_controls(menu, values);
    });
  }

  for (const reset of menu.querySelectorAll("[data-effect-reset]")) {
    reset.addEventListener("click", () => reset_effect_controls(menu));
  }
};

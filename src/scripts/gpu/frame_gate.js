import {
  get_safe_option,
  SITE_FPS_DEFAULT,
  site_fps_options,
} from "../../../public/js/modules/menu/preferences.js";

export const create_frame_gate = (
  read_limit = () => document.documentElement.dataset.siteFps,
) => {
  let deadline = null,
    previous_interval = null;

  return {
    due(now) {
      const limit = get_safe_option(
        read_limit(),
        site_fps_options,
        SITE_FPS_DEFAULT,
      );
      const interval = limit === "display" ? 0 : 1000 / Number(limit);
      if (interval !== previous_interval) {
        deadline = null;
        previous_interval = interval;
      }

      if (interval === 0) return true;
      if (deadline === null) {
        deadline = now + interval;
        return true;
      }
      if (now + 0.25 < deadline) return false;

      deadline +=
        Math.max(1, Math.floor((now - deadline) / interval) + 1) * interval;
      return true;
    },
    reset() {
      deadline = null;
      previous_interval = null;
    },
  };
};

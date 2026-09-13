const RUBEDO_CONSTELLATION_VIEW = Object.freeze({
  max_dpr: 2,
  min_zoom: 0.75,
  max_zoom: 8,
  attractor_strength: 0.03,
  horizontal_range_multiplier: 3,
  vertical_range_multiplier: 2,
  edge_idle_return_delay_ms: 1400,
  edge_pull_strength: 0.0025,
  edge_pull_max_step_x: 0.32,
  edge_pull_max_step_y: 0.24,
  edge_pull_deadzone: 0.05,
  edge_resist_k: 0.085,
});

const RUBEDO_CONSTELLATION_INTERACTION = Object.freeze({
  hover_intent_ms: 280,
  inactivity_timeout_ms: 900,
  drag_threshold_px: 5,
  inertia_damping: 0.988,
  inertia_stop_px: 0.008,
  arrow_pan_nudge: 32,
  outside_velocity_damp_mult: 0.9,
  hover_preview_offset_x: 20,
  hover_preview_offset_y: 18,
  hover_preview_margin: 10,
});

const RUBEDO_CONSTELLATION_LAYOUT = Object.freeze({
  center_x: 50,
  side_lane_step: 18,
  vertical_step: 18,
  base_y: 12,
  side_lane_y_nudge: 2.6,
});

const RUBEDO_CONSTELLATION_THREADS = Object.freeze({
  default_keys: Object.freeze(["cinza", "suul", "solarisael"]),
  image_src: Object.freeze({
    cinza: "/images/eyes/cinza.jpg",
    suul: "/images/eyes/suul.jpg",
    solarisael: "/images/small_render_4.png",
  }),
  trail_rotation: Object.freeze({
    cinza: 334,
    suul: 312,
    solarisael: 348,
  }),
  neon_rgb: Object.freeze({
    cinza: "23 23 23",
    suul: "23 23 23",
    solarisael: "23 23 23",
  }),
  rgb: Object.freeze({
    cinza: Object.freeze([23, 23, 23]),
    suul: Object.freeze([23, 23, 23]),
    solarisael: Object.freeze([23, 23, 23]),
  }),
});

const RUBEDO_CONSTELLATION_WORLD_BOUNDS = Object.freeze({
  padding_ratio_x: 0.42 * RUBEDO_CONSTELLATION_VIEW.horizontal_range_multiplier,
  padding_min_x: 18 * RUBEDO_CONSTELLATION_VIEW.horizontal_range_multiplier,
  padding_max_x: 96 * RUBEDO_CONSTELLATION_VIEW.horizontal_range_multiplier,
  padding_ratio_y: 0.28 * RUBEDO_CONSTELLATION_VIEW.vertical_range_multiplier,
  padding_min_y: 12 * RUBEDO_CONSTELLATION_VIEW.vertical_range_multiplier,
  padding_max_y: 64 * RUBEDO_CONSTELLATION_VIEW.vertical_range_multiplier,
  edge_soft_overscroll_x:
    72 * RUBEDO_CONSTELLATION_VIEW.horizontal_range_multiplier,
  edge_hard_overscroll_x:
    132 * RUBEDO_CONSTELLATION_VIEW.horizontal_range_multiplier,
  edge_soft_overscroll_y:
    48 * RUBEDO_CONSTELLATION_VIEW.vertical_range_multiplier,
  edge_hard_overscroll_y:
    88 * RUBEDO_CONSTELLATION_VIEW.vertical_range_multiplier,
});

export {
  RUBEDO_CONSTELLATION_INTERACTION,
  RUBEDO_CONSTELLATION_LAYOUT,
  RUBEDO_CONSTELLATION_THREADS,
  RUBEDO_CONSTELLATION_VIEW,
  RUBEDO_CONSTELLATION_WORLD_BOUNDS,
};

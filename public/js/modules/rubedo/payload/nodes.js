import {
  RUBEDO_CONSTELLATION_LAYOUT,
  RUBEDO_CONSTELLATION_THREADS,
} from "../constellation_config.js";

const build_side_lane_x_map = (side_thread_keys) => {
  const side_lane_x_map = new Map();

  for (
    let side_index = 0;
    side_index < side_thread_keys.length;
    side_index += 1
  ) {
    const thread_key = side_thread_keys[side_index];
    const lane_rank = Math.floor(side_index / 2) + 1;
    const lane_direction = side_index % 2 === 0 ? -1 : 1;
    const lane_x =
      RUBEDO_CONSTELLATION_LAYOUT.center_x +
      lane_direction * lane_rank * RUBEDO_CONSTELLATION_LAYOUT.side_lane_step;

    side_lane_x_map.set(thread_key, lane_x);
  }

  return side_lane_x_map;
};

const build_row_entries = (chapters) => {
  const row_entries = [];

  for (let row_index = 0; row_index < chapters.length; row_index += 1) {
    const chapter_entry = chapters[row_index];
    const thread_key_set = new Set(chapter_entry.thread_keys ?? []);

    row_entries.push({
      chapter: chapter_entry,
      row_index,
      row_y:
        RUBEDO_CONSTELLATION_LAYOUT.base_y +
        row_index * RUBEDO_CONSTELLATION_LAYOUT.vertical_step,
      has_cinza: thread_key_set.has("cinza"),
      thread_keys: [...thread_key_set],
    });
  }

  return row_entries;
};

const build_row_anchor_nodes = (row_entries) => {
  const row_anchor_nodes = [];

  for (const row_entry of row_entries) {
    row_anchor_nodes.push({
      node_id: row_entry.has_cinza
        ? `${row_entry.chapter.chapter_id}:cinza`
        : `${row_entry.chapter.chapter_id}:cinza:phantom`,
      chapter_id: row_entry.chapter.chapter_id,
      chapter_slug: row_entry.chapter.chapter_slug,
      thread_key: "cinza",
      node_kind: row_entry.has_cinza ? "real" : "phantom",
      x: RUBEDO_CONSTELLATION_LAYOUT.center_x,
      y: row_entry.row_y,
      row_index: row_entry.row_index,
      timeline_position: row_entry.chapter.timeline_position,
    });
  }

  return row_anchor_nodes;
};

const build_thread_node = (row_entry, thread_key, side_lane_x_map) => {
  const lane_x =
    thread_key === "cinza"
      ? RUBEDO_CONSTELLATION_LAYOUT.center_x
      : (side_lane_x_map.get(thread_key) ??
        RUBEDO_CONSTELLATION_LAYOUT.center_x);
  const lane_y =
    thread_key === "cinza"
      ? row_entry.row_y
      : row_entry.row_y + RUBEDO_CONSTELLATION_LAYOUT.side_lane_y_nudge;
  return {
    node_id: `${row_entry.chapter.chapter_id}:${thread_key}`,
    chapter_id: row_entry.chapter.chapter_id,
    chapter_slug: row_entry.chapter.chapter_slug,
    thread_key,
    node_kind: "real",
    x: lane_x,
    y: lane_y,
    row_index: row_entry.row_index,
    timeline_position: row_entry.chapter.timeline_position,
  };
};

const build_real_nodes = (row_entries, side_lane_x_map) => {
  const real_nodes = [];

  for (const row_entry of row_entries) {
    for (const thread_key of row_entry.thread_keys) {
      real_nodes.push(
        build_thread_node(row_entry, thread_key, side_lane_x_map),
      );
    }
  }

  return real_nodes;
};

const build_canvas_nodes = ({ all_nodes, base_path, book_slug }) => {
  return all_nodes.map((node_entry) => {
    const is_clickable = node_entry.node_kind === "real";
    const core_radius = node_entry.thread_key === "cinza" ? 2.7 : 1.95;
    const highlight_radius = core_radius + 0.22;
    const halo_radius = highlight_radius + 0.04;
    const neon_rgb =
      RUBEDO_CONSTELLATION_THREADS.neon_rgb[node_entry.thread_key] ??
      "23 23 23";
    const trail_rotation =
      RUBEDO_CONSTELLATION_THREADS.trail_rotation[node_entry.thread_key] ?? 18;
    const image_src_rel =
      RUBEDO_CONSTELLATION_THREADS.image_src[node_entry.thread_key] ?? null;
    const image_src = image_src_rel ? `${base_path}${image_src_rel}` : null;

    if (!is_clickable) {
      return {
        ...node_entry,
        is_clickable: false,
        link: null,
        image_src: null,
        neon_rgb,
        trail_rotation,
        core_radius: 2,
        highlight_radius: 2.2,
        halo_radius: 2.34,
        label: node_entry.chapter_id,
        hover_preview: null,
      };
    }

    const chapter_href = `${base_path}/rubedo/${book_slug}/${node_entry.chapter_slug}`;

    return {
      ...node_entry,
      is_clickable: true,
      link: {
        href: chapter_href,
        hx_get: chapter_href,
        hx_target: "#sol_page_shell",
        hx_select: "#sol_page_shell",
        hx_swap: "morph swap:220ms settle:260ms",
        hx_push_url: "true",
      },
      hover_preview: null,
      image_src,
      neon_rgb,
      trail_rotation,
      core_radius,
      highlight_radius,
      halo_radius,
      label: node_entry.chapter_id,
    };
  });
};

export {
  build_side_lane_x_map,
  build_row_entries,
  build_row_anchor_nodes,
  build_real_nodes,
  build_canvas_nodes,
};

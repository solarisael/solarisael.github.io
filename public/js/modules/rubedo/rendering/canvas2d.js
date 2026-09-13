import { resize_canvas_to_display_size } from "../../webgl/canvas.js";
import { world_to_screen } from "../../webgl/math.js";
import { RUBEDO_CONSTELLATION_VIEW } from "../constellation_config.js";
import {
  create_texture_source_list,
  create_texture_loader,
} from "./textures.js";

const create_canvas2d_renderer = (canvas, payload, view_state) => {
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    return null;
  }

  const image_map = new Map();
  const texture_loader = create_texture_loader();
  const dispose = () => {
    texture_loader.dispose();
    image_map.clear();
  };
  const clickable_nodes = (payload.nodes || []).filter((node_entry) => {
    return node_entry.is_clickable;
  });

  const resize = () => {
    resize_canvas_to_display_size(canvas, RUBEDO_CONSTELLATION_VIEW.max_dpr);
  };

  const load_textures = async (signal) => {
    await texture_loader.load(
      create_texture_source_list(clickable_nodes),
      (source, image) => image_map.set(source, image),
      signal,
    );
  };

  const draw_line = (edge, stroke_style, width, alpha = 1) => {
    const p1 = world_to_screen(edge.x1, edge.y1, view_state, canvas);
    const p2 = world_to_screen(edge.x2, edge.y2, view_state, canvas);

    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = stroke_style;
    context.lineWidth = width * view_state.zoom;
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();
    context.restore();
  };

  const draw_halo = (p, halo_radius, is_focus) => {
    context.save();
    context.strokeStyle = `rgba(23,23,23,${is_focus ? 0.88 : 0.44})`;
    context.lineWidth = is_focus ? 1.4 : 1;
    context.shadowColor = "rgba(23,23,23,0.22)";
    context.shadowBlur = is_focus ? 4 : 0;
    context.beginPath();
    context.arc(p.x, p.y, halo_radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  };

  const draw_edge_group = (edges, color, width) => {
    for (const edge of edges || []) {
      draw_line(edge, color, width);
    }
  };

  const draw_node = (node, is_focus) => {
    const p = world_to_screen(node.x, node.y, view_state, canvas);
    const core_radius = node.core_radius * view_state.zoom;
    const halo_radius = node.halo_radius * view_state.zoom;
    const highlight_radius = node.highlight_radius * view_state.zoom;

    draw_halo(p, halo_radius, is_focus);

    const image = node.image_src ? image_map.get(node.image_src) : null;

    if (image) {
      context.save();
      context.filter = "grayscale(1) contrast(0.9)";
      context.beginPath();
      context.arc(p.x, p.y, core_radius, 0, Math.PI * 2);
      context.clip();
      context.drawImage(
        image,
        p.x - core_radius,
        p.y - core_radius,
        core_radius * 2,
        core_radius * 2,
      );
      context.restore();
    } else {
      context.save();
      context.fillStyle = "rgba(23,23,23,0.16)";
      context.beginPath();
      context.arc(p.x, p.y, core_radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    context.save();
    context.strokeStyle = `rgba(23,23,23,${is_focus ? 0.96 : 0.62})`;
    context.lineWidth = is_focus ? 1.3 : 0.9;
    context.beginPath();
    context.arc(p.x, p.y, highlight_radius, 0, Math.PI * 2);
    context.stroke();

    const angle = ((Number(node.trail_rotation) || 18) * Math.PI) / 180;
    const spark_x = p.x + Math.cos(angle) * highlight_radius;
    const spark_y = p.y + Math.sin(angle) * highlight_radius;
    context.fillStyle = "rgba(23,23,23,0.92)";
    context.beginPath();
    context.arc(spark_x, spark_y, is_focus ? 2.2 : 1.7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const render = (active_node_id, hover_node_id) => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    draw_edge_group(payload.edges.branch, "rgba(23,23,23,0.2)", 1);
    draw_edge_group(payload.edges.trunk, "rgba(23,23,23,0.62)", 1.1);
    draw_edge_group(payload.edges.connectors, "rgba(23,23,23,0.16)", 1);

    for (const edge of payload.edges.canonical || []) {
      draw_line(edge, "rgba(23,23,23,0.44)", 1.06);
    }

    for (const node of clickable_nodes) {
      const is_focus =
        node.node_id === active_node_id || node.node_id === hover_node_id;
      draw_node(node, is_focus);
    }
  };

  return {
    type: "canvas2d",
    resize,
    render,
    load_textures,
    dispose,
  };
};

export { create_canvas2d_renderer };

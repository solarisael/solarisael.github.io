const LAB_SELECTOR = "[data-sol-shader-chalice-lab]";
const CANVAS_SELECTOR = "[data-sol-shader-chalice-canvas]";
const TEXT_SELECTOR = ".sol__shader_chalice_text";
const CHALICE_ANIMATION_CYCLE_MS = 7600;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const smoothstep = (start, end, value) => {
  const amount = clamp01((value - start) / (end - start));
  return amount * amount * (3 - 2 * amount);
};

export const compute_chalice_animation_state = (time) => {
  const phase =
    (((time % CHALICE_ANIMATION_CYCLE_MS) + CHALICE_ANIMATION_CYCLE_MS) %
      CHALICE_ANIMATION_CYCLE_MS) /
    CHALICE_ANIMATION_CYCLE_MS;
  const fade_out = smoothstep(0.68, 0.76, phase);
  const fade_in = smoothstep(0.84, 1, phase);
  const text_hidden = clamp01(fade_out * (1 - fade_in));
  const glitch = Math.pow(
    smoothstep(0.68, 0.8, phase) * (1 - smoothstep(0.9, 1, phase)),
    1.15,
  );

  return {
    phase,
    glitch,
    textBlurRem: 0.22 * text_hidden,
    textOpacity: 0.9 * (1 - text_hidden),
  };
};

const sync_text_animation = ({ lab, text }, animation) => {
  if (!text) {
    return;
  }

  lab.style.setProperty(
    "--sol_shader_chalice_text_blur",
    `${animation.textBlurRem.toFixed(3)}rem`,
  );
  lab.style.setProperty(
    "--sol_shader_chalice_text_opacity",
    animation.textOpacity.toFixed(3),
  );
};

const active_labs = new WeakMap();

const resize_canvas = (canvas) => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height, dpr };
};

const edge_noise = (time, seed, force) =>
  (Math.sin(time * 0.0017 + seed * 1.91) +
    Math.sin(time * 0.0031 + seed * 0.73)) *
  force;

const draw_chalice_path = (context, width, height, time, force) => {
  const point = (x, y, seed) => [
    x * width + edge_noise(time, seed, force),
    y * height + edge_noise(time, seed + 11, force * 0.62),
  ];

  const p0 = point(0.16, 0.11, 1);
  const p1 = point(0.84, 0.11, 2);
  const p2 = point(0.75, 0.24, 3);
  const p3 = point(0.6, 0.58, 4);
  const p4 = point(0.55, 0.74, 5);
  const p5 = point(0.73, 0.92, 6);
  const p6 = point(0.27, 0.92, 7);
  const p7 = point(0.45, 0.74, 8);
  const p8 = point(0.4, 0.58, 9);
  const p9 = point(0.25, 0.24, 10);

  context.beginPath();
  context.moveTo(...p0);
  context.bezierCurveTo(
    width * 0.3,
    height * 0.04,
    width * 0.7,
    height * 0.04,
    ...p1,
  );
  context.bezierCurveTo(
    width * 0.8,
    height * 0.14,
    width * 0.78,
    height * 0.19,
    ...p2,
  );
  context.bezierCurveTo(
    width * 0.72,
    height * 0.35,
    width * 0.66,
    height * 0.48,
    ...p3,
  );
  context.bezierCurveTo(
    width * 0.58,
    height * 0.64,
    width * 0.56,
    height * 0.7,
    ...p4,
  );
  context.bezierCurveTo(
    width * 0.6,
    height * 0.83,
    width * 0.68,
    height * 0.86,
    ...p5,
  );
  context.bezierCurveTo(
    width * 0.58,
    height * 0.97,
    width * 0.42,
    height * 0.97,
    ...p6,
  );
  context.bezierCurveTo(
    width * 0.32,
    height * 0.86,
    width * 0.4,
    height * 0.83,
    ...p7,
  );
  context.bezierCurveTo(
    width * 0.44,
    height * 0.7,
    width * 0.42,
    height * 0.64,
    ...p8,
  );
  context.bezierCurveTo(
    width * 0.34,
    height * 0.48,
    width * 0.28,
    height * 0.35,
    ...p9,
  );
  context.bezierCurveTo(
    width * 0.22,
    height * 0.19,
    width * 0.2,
    height * 0.14,
    ...p0,
  );
  context.closePath();
};

const draw_lab = ({ canvas, context }, time, animation) => {
  const { width, height, dpr } = resize_canvas(canvas);
  const scaled_width = width / dpr;
  const scaled_height = height / dpr;
  const { glitch } = animation;
  const force = scaled_width * (0.004 + glitch * 0.035);

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, scaled_width, scaled_height);

  const background = context.createRadialGradient(
    scaled_width * 0.5,
    scaled_height * 0.42,
    scaled_width * 0.08,
    scaled_width * 0.5,
    scaled_height * 0.5,
    scaled_width * 0.58,
  );
  background.addColorStop(0, "rgba(244, 205, 135, 0.2)");
  background.addColorStop(0.45, "rgba(157, 102, 255, 0.12)");
  background.addColorStop(1, "rgba(8, 6, 16, 0)");
  context.fillStyle = background;
  context.fillRect(0, 0, scaled_width, scaled_height);

  context.save();
  draw_chalice_path(context, scaled_width, scaled_height, time, force);
  const fill = context.createLinearGradient(
    0,
    scaled_height * 0.08,
    0,
    scaled_height * 0.94,
  );
  fill.addColorStop(0, `rgba(244, 211, 146, ${0.18 + glitch * 0.18})`);
  fill.addColorStop(0.48, `rgba(105, 64, 210, ${0.08 + glitch * 0.16})`);
  fill.addColorStop(1, `rgba(244, 136, 94, ${0.12 + glitch * 0.18})`);
  context.fillStyle = fill;
  context.shadowColor = `rgba(241, 196, 122, ${0.28 + glitch * 0.46})`;
  context.shadowBlur = 24 + glitch * 18;
  context.fill();
  context.restore();

  context.save();
  draw_chalice_path(context, scaled_width, scaled_height, time, force * 1.28);
  context.lineWidth = 1.2 + glitch * 1.4;
  context.strokeStyle = `rgba(244, 208, 143, ${0.46 + glitch * 0.36})`;
  context.shadowColor = `rgba(255, 211, 128, ${0.22 + glitch * 0.5})`;
  context.shadowBlur = 10 + glitch * 18;
  context.stroke();
  context.restore();

  if (glitch > 0.1) {
    context.save();
    context.globalCompositeOperation = "lighter";
    draw_chalice_path(context, scaled_width, scaled_height, time, force * 1.4);
    context.clip();
    for (let index = 0; index < 7; index += 1) {
      const y =
        scaled_height * (0.16 + index * 0.1 + edge_noise(time, index, 0.01));
      const x = scaled_width * (0.2 + Math.random() * 0.6);
      context.fillStyle = `rgba(255, 228, 166, ${glitch * 0.22})`;
      context.fillRect(
        x,
        y,
        scaled_width * (0.12 + Math.random() * 0.28),
        1 + glitch * 3,
      );
    }
    context.restore();
  }
};

const hydrate_lab = (lab) => {
  if (active_labs.has(lab)) {
    return;
  }

  const canvas = lab.querySelector(CANVAS_SELECTOR);

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const state = {
    lab,
    canvas,
    context,
    text: lab.querySelector(TEXT_SELECTOR),
    frame: 0,
  };
  active_labs.set(lab, state);

  const frame = (time) => {
    if (!document.contains(lab)) {
      active_labs.delete(lab);
      return;
    }

    const animation = compute_chalice_animation_state(time);
    sync_text_animation(state, animation);
    draw_lab(state, time, animation);
    state.frame = requestAnimationFrame(frame);
  };

  state.frame = requestAnimationFrame(frame);
};

export const hydrate_shader_chalice_labs = (root = document) => {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  for (const lab of root.querySelectorAll(LAB_SELECTOR)) {
    hydrate_lab(lab);
  }

  if (root instanceof HTMLElement && root.matches(LAB_SELECTOR)) {
    hydrate_lab(root);
  }
};

import { WATER_OPTICS } from "../water_optics.js";

export const MOTH_COUNT = 36;
export const NARROW_MOTH_COUNT = 24;
export const MOTE_COUNT = 6;
export const MOTH_DEPTHS = {
  near: {
    size: 1.725,
    light: 0.66,
    softness: 0.15,
    water: WATER_OPTICS.near_depth,
  },
  far: {
    size: 1.125,
    light: 0.285,
    softness: 0.65,
    water: WATER_OPTICS.far_depth,
  },
};
export const MOTE_SIZE = 0.45;

const STRIDE = 16;
const MOTH = 0;
const MOTE = 1;
const is_near = (rank) => rank % 3 === 0;
const spread = (range) => (Math.random() - 0.5) * range;

// Field order mirrors `struct Moth` in portal_moths.wgsl: place, glyph, motion, look.
const seed_moth = (rank, depth, data, offset) => {
  const side = rank % 2 === 0 ? -1 : 1;
  data.set(
    [
      (50 + side * (24 + Math.random() * 21)) / 100,
      (5 + Math.random() * 90) / 100,
      rank,
      depth.water,
      0,
      0,
      Math.floor(Math.random() * 1_000_000),
      Math.random(),
      17 + Math.random() * 19,
      spread(3),
      spread(5),
      spread(22) * (Math.PI / 180),
      depth.light,
      depth.softness,
      MOTH,
      0,
    ],
    offset,
  );
};

// Motes come in staggered pairs sharing one clock, half a cycle apart.
const seed_mote = (phase, duration, data, offset) => {
  data.set(
    [
      0,
      0,
      -1,
      WATER_OPTICS.near_depth,
      0,
      0,
      Math.floor(Math.random() * 1_000_000),
      phase,
      duration,
      0,
      0,
      0,
      1,
      0,
      MOTE,
      0,
    ],
    offset,
  );
};

const seed_flock = (data) => {
  const ranks = Array.from({ length: MOTH_COUNT }, (_, rank) => rank);
  const ordered = [
    ...ranks.filter((rank) => !is_near(rank)),
    ...ranks.filter(is_near),
  ];
  ordered.forEach((rank, index) => {
    const depth = is_near(rank) ? MOTH_DEPTHS.near : MOTH_DEPTHS.far;
    seed_moth(rank, depth, data, index * STRIDE);
  });
  for (let pair = 0; pair < MOTE_COUNT / 2; pair++) {
    const duration = 6.2 + Math.random() * 2.8;
    const phase = Math.random();
    const offset = (MOTH_COUNT + pair * 2) * STRIDE;
    seed_mote(phase, duration, data, offset);
    seed_mote(phase + 0.5, duration, data, offset + STRIDE);
  }
};

const point_at_entries = (data, index, entries, keys) => {
  data[index * STRIDE + 4] = entries.get(keys[0]).index;
  data[index * STRIDE + 5] = keys.length;
};

// Far moths fill the buffer first so near moths draw over them; the six rim
// motes follow and are drawn by their own call. A rebuilt atlas keeps the
// previous flock in place and only points it at the new entries.
export const create_moth_model = (plan, atlas, previous) => {
  const data = new Float32Array((MOTH_COUNT + MOTE_COUNT) * STRIDE);
  if (previous) data.set(previous.data);
  else seed_flock(data);
  for (let index = 0; index < MOTH_COUNT + MOTE_COUNT; index++) {
    const kind = data[index * STRIDE + 14];
    const rank = data[index * STRIDE + 2];
    const keys =
      kind === MOTE
        ? plan.motes
        : is_near(rank)
          ? plan.moths.near
          : plan.moths.far;
    point_at_entries(data, index, atlas.entries, keys);
  }
  return {
    data,
    moth_count: MOTH_COUNT,
    mote_count: MOTE_COUNT,
    measure(canvas, tablet, rim, scene) {
      const origin = canvas.getBoundingClientRect();
      const frame = tablet.getBoundingClientRect();
      const ring = rim.getBoundingClientRect();
      scene.resolution[0] = origin.width;
      scene.resolution[1] = origin.height;
      scene.offset[0] = origin.left - frame.left;
      scene.offset[1] = origin.top - frame.top;
      scene.root_size = plan.root_size;
      scene.visible = matchMedia("(max-width: 700px)").matches
        ? NARROW_MOTH_COUNT
        : MOTH_COUNT;
      scene.rim[0] = ring.left + ring.width / 2 - origin.left;
      scene.rim[1] = ring.top + ring.height / 2 - origin.top;
      scene.rim[2] = ring.width / 2;
      scene.rim[3] = ring.height / 2;
    },
  };
};

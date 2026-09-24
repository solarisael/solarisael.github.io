import { with_base } from "../utils/routes.js";

const MANTLE_POSITIONS = Object.freeze([
  "northwest",
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
]);

const RELIQUARY_CORNER = Object.freeze({
  src: with_base("ornaments/reliquary/card_corner.svg"),
});
const RELIQUARY_CREST_TOP = Object.freeze({
  src: with_base("ornaments/reliquary/sigil_concentric.svg"),
  symbol: "reliquary-sigil-concentric",
  view_box: "0 0 48 48",
});
const RELIQUARY_CREST_BOTTOM = Object.freeze({
  src: with_base("ornaments/reliquary/divider_center.svg"),
  symbol: "reliquary-divider-center",
  view_box: "0 0 48 24",
});
const RELIQUARY_SIDE_FLOURISH = Object.freeze({
  src: with_base("ornaments/reliquary/divider_flourish.svg"),
  symbol: "reliquary-divider-flourish",
  view_box: "0 0 44 14",
});

const CARD_CORNER_NORTHWEST = Object.freeze({
  src: with_base("ornaments/cinza/card_corner_a.svg"),
});
const CARD_CORNER_NORTHEAST = Object.freeze({
  src: with_base("ornaments/cinza/card_corner_b.svg"),
});
const CARD_CORNER_SOUTHWEST = Object.freeze({
  src: with_base("ornaments/cinza/card_corner_c.svg"),
});
const CARD_CORNER_SOUTHEAST = Object.freeze({
  src: with_base("ornaments/cinza/card_corner_d.svg"),
});
const CARD_SIDE_FLOURISH = Object.freeze({
  src: with_base("ornaments/cinza/card_side_flourish.svg"),
});

const MANTLE_ORNAMENTS = Object.freeze({
  container: Object.freeze({
    northwest: RELIQUARY_CORNER,
    north: RELIQUARY_CREST_TOP,
    northeast: RELIQUARY_CORNER,
    east: RELIQUARY_SIDE_FLOURISH,
    southeast: RELIQUARY_CORNER,
    south: RELIQUARY_CREST_BOTTOM,
    southwest: RELIQUARY_CORNER,
    west: RELIQUARY_SIDE_FLOURISH,
  }),
  "phase-card": Object.freeze({
    northwest: CARD_CORNER_NORTHWEST,
    north: RELIQUARY_CREST_TOP,
    northeast: CARD_CORNER_NORTHEAST,
    east: CARD_SIDE_FLOURISH,
    southeast: CARD_CORNER_SOUTHEAST,
    south: RELIQUARY_CREST_BOTTOM,
    southwest: CARD_CORNER_SOUTHWEST,
    west: CARD_SIDE_FLOURISH,
  }),
});

export { MANTLE_ORNAMENTS, MANTLE_POSITIONS };

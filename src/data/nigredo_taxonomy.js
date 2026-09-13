// Nigredo descent arc — the fire burns down, stage by stage, toward the
// burnt-quiet ember that is the threshold into albedo (the washing).
// Ordered as a progression: kindling (the ache catches) -> blaze (open
// flame) -> scorch (the burn-mark) -> smoke (can''t-see dread) -> soot
// (bitter residue) -> cinder (burnt-out, the dawn-edge).
//
// Polyglot vocabulary: pt/he/de/fr/la/ja/en (+ one welsh anchor, hiraeth).
// Each state has an ASCII `key` (stored in frontmatter, used in URLs and
// filtering), a display `label` (may carry diacritics/spaces), and a `gloss`
// (the meaning, shown as a hint in the Templater picker, never stored).
//
// 6 containers x 3 states = 18. Enforced by z.enum(NIGREDO_STATES) in
// content.config.js; the vault's alchemy_writing/z_nigredo/README.md mirrors this.

export const NIGREDO_CONTAINERS = [
  {
    key: "kindling",
    label: "kindling",
    gloss: "the ache that catches",
    states: [
      {
        key: "saudade",
        label: "saudade",
        gloss: "the presence of an absence (pt)",
      },
      {
        key: "hiraeth",
        label: "hiraeth",
        gloss: "longing for a home that may never have been (cy)",
      },
      { key: "loneliness", label: "loneliness", gloss: "" },
    ],
  },
  {
    key: "blaze",
    label: "blaze",
    gloss: "open violent flame",
    states: [
      {
        key: "charon",
        label: "charon",
        gloss: "the burning heat of wrath (he)",
      },
      { key: "rage", label: "rage", gloss: "" },
      { key: "spite", label: "spite", gloss: "" },
    ],
  },
  {
    key: "scorch",
    label: "scorch",
    gloss: "the burn-mark",
    states: [
      { key: "busha", label: "busha", gloss: "shame (he)" },
      { key: "shame", label: "shame", gloss: "" },
      { key: "guilt", label: "guilt", gloss: "" },
    ],
  },
  {
    key: "smoke",
    label: "smoke",
    gloss: "what rises, the can''t-see dread",
    states: [
      { key: "angst", label: "Angst", gloss: "existential dread (de)" },
      {
        key: "unheimlich",
        label: "unheimlich",
        gloss: "the uncanny; dread of the familiar-gone-wrong (de)",
      },
      { key: "panic", label: "panic", gloss: "" },
    ],
  },
  {
    key: "soot",
    label: "soot",
    gloss: "the bitter residue",
    states: [
      { key: "rot", label: "rot", gloss: "" },
      { key: "envy", label: "envy", gloss: "" },
      { key: "malaise", label: "malaise", gloss: "formless unease (fr)" },
    ],
  },
  {
    key: "cinder",
    label: "cinder",
    gloss: "burnt-quiet, the dawn-edge into albedo",
    states: [
      {
        key: "acedia",
        label: "acedia",
        gloss: "the noonday torpor; not caring that you don''t care (la)",
      },
      { key: "exhaustion", label: "exhaustion", gloss: "" },
      {
        key: "mono-no-aware",
        label: "mono no aware",
        gloss: "gentle sorrow at the passing of things (ja)",
      },
    ],
  },
];

// Flat array of state keys, in descent order — the enum source of truth.
export const NIGREDO_STATES = NIGREDO_CONTAINERS.flatMap((container) =>
  container.states.map((state) => state.key),
);

// key -> container key
export const NIGREDO_STATE_TO_CONTAINER = Object.fromEntries(
  NIGREDO_CONTAINERS.flatMap((container) =>
    container.states.map((state) => [state.key, container.key]),
  ),
);

// key -> display label (diacritics/spaces preserved)
export const NIGREDO_STATE_LABEL = Object.fromEntries(
  NIGREDO_CONTAINERS.flatMap((container) =>
    container.states.map((state) => [state.key, state.label]),
  ),
);

// key -> gloss (meaning hint; never stored in frontmatter)
export const NIGREDO_STATE_GLOSS = Object.fromEntries(
  NIGREDO_CONTAINERS.flatMap((container) =>
    container.states.map((state) => [state.key, state.gloss]),
  ),
);

// Content collections — single source of truth: the Obsidian vault.
//
// Each alchemical phase lives in its own holding-pen directory inside the
// vault. Astro's glob loader reads markdown from there at build time, so
// authoring happens in Obsidian (templater, dataview, daily notes) and the
// site renders without an explicit migration step.
//
// To move the vault, set SOLARISAEL_OBSIDIAN_ROOT. The shared resolver in
// src/config/obsidian_vault_root.js is the only root selection source. Per-phase
// subdirs are pinned to the vault's existing naming (`z_` / `zz_` / `zzz_` /
// `zzzz_` for sort-order convenience in Obsidian's file pane — the alchemical
// sequence matches the prefix length).
//
// The rubedo collection stays declared-but-empty here: rubedo book content
// is consumed through `import.meta.glob` in `book_timeline_runtime.js`, not
// `getCollection()`. Declaring it with an empty loader prevents Astro from
// auto-globbing the files (which would produce duplicate-id warnings).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { resolve_obsidian_vault_root } from "./config/obsidian_vault_root.js";
import { NIGREDO_STATES } from "./data/nigredo_taxonomy.js";
import { ALBEDO_STATES } from "./data/albedo_taxonomy.js";

export const OBSIDIAN_VAULT_ROOT = resolve_obsidian_vault_root();

// Astro's glob loader resolves `base` via fileURLToPath — it expects a
// file:// URL, NOT a bare absolute path. Convert with pathToFileURL.
// Trailing slash matters: URL semantics treat the last segment as a file
// unless the URL ends in `/`, so we append before converting.
const vault_phase_url = (subdir) =>
  pathToFileURL(`${path.join(OBSIDIAN_VAULT_ROOT, subdir)}${path.sep}`);

const VAULT_PHASE_DIRS = {
  nigredo: vault_phase_url("alchemy_writing/z_nigredo"),
  albedo: vault_phase_url("alchemy_writing/zz_albedo"),
  citrinitas: vault_phase_url("alchemy_writing/zzz_citrinitas"),
  rubedo: vault_phase_url("alchemy_writing/zzzz_rubedo"),
  codex: vault_phase_url("codex"),
};

// Coerce frontmatter dates to ISO date strings (YYYY-MM-DD). Obsidian
// accepts both quoted strings ("2026-05-05") and bare datetimes
// (2026-05-05T18:36:00 → JS Date). The pages sort by `localeCompare` so
// we normalize to string here once, instead of branching at every callsite.
const date_string = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

// The 16-state Nigredo vocabulary is enforced by `z.enum`; any state outside
// this list fails the build. Container metadata lives in nigredo_taxonomy.js.
// The vault's `alchemy_writing/z_nigredo/README.md` mirrors this list and taxonomy.

// Layout-agnostic posts glob — matches any markdown file at any depth
// whose filename starts with `YYYY-`. The date-prefix on the filename is
// the marker; the directory layout is the author's call (flat, themed
// clusters, year-tree, whatever). README.md and _template.md don't match
// (no year prefix) so they stay invisible to the loader.
//
// The actual published-at date for sorting/display comes from the
// `published_at` frontmatter, not the filename — keep the two in sync
// or `published_at` wins. The filename prefix is purely a glob marker.
const POSTS_PATTERN = "**/[0-9][0-9][0-9][0-9]-*.md";

const nigredo = defineCollection({
  loader: glob({ pattern: POSTS_PATTERN, base: VAULT_PHASE_DIRS.nigredo }),
  schema: z.object({
    title: z.string().optional(),
    slug: z.string(),
    published_at: date_string,
    states: z.array(z.enum(NIGREDO_STATES)).min(1),
    excerpt: z.string().optional(),
    updated_at: date_string.optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional().default(false),
    featured: z.boolean().optional().default(false),
  }),
});

// The 20-state Albedo vocabulary is enforced by `z.enum` (parity with
// nigredo); any state outside this list fails the build. Container metadata
// (the six light/water containers) lives in albedo_taxonomy.js, mirrored by
// the vault's `alchemy_writing/zz_albedo/README.md`. Albedo is the washed/composed stage —
// same machinery as nigredo, opposite register.
const albedo = defineCollection({
  loader: glob({ pattern: POSTS_PATTERN, base: VAULT_PHASE_DIRS.albedo }),
  schema: z.object({
    title: z.string().optional(),
    slug: z.string(),
    published_at: date_string,
    states: z.array(z.enum(ALBEDO_STATES)).min(1),
    excerpt: z.string().optional(),
    updated_at: date_string.optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional().default(false),
    featured: z.boolean().optional().default(false),
  }),
});

// Citrinitas: booklet content is loaded via import.meta.glob in
// src/data/citrinitas/booklet_runtime.js (same posture as rubedo), not
// getCollection(). Booklets carry book/chapter identity frontmatter, not the
// post schema, so the empty loader keeps Astro from auto-globbing + schema-
// failing them (e.g. _book.md has no slug/published_at).
const citrinitas = defineCollection({
  loader: async () => [],
});

// Rubedo: book content (Absurd Faith) is loaded via import.meta.glob in
// src/data/rubedo/book_timeline_runtime.js, not getCollection(). The empty
// loader keeps Astro from auto-globbing those files (duplicate-id risk).
// When/if Sol surfaces a separate "rubedo posts" pattern in
// VAULT_PHASE_DIRS.rubedo, register a second collection here (e.g.
// `rubedo_posts`) instead of mutating this one — keeps the book pipeline
// untouched.
const rubedo = defineCollection({
  loader: async () => [],
});

// Codex: in-site wiki / cross-reference index. Path-routed via the
// `[...entry_path].astro` rest-spread route. Filename stems land in the
// wikilink registry as lookup keys — so `[[cinza]]` from anywhere in the
// vault resolves to `/codex/characters/cinza` (assuming a file at
// `obsidian/codex/characters/cinza.md` exists with that filename).
//
// Schema is loose because Sol's codex entry shape is still unfolding.
// Floor: `slug` is optional (defaults to the URL-derived path); title is
// optional (defaults to the slug); category is optional (derived from the
// first segment of the relative path). Tighten later when patterns surface.
const codex = defineCollection({
  loader: glob({ pattern: "**/*.md", base: VAULT_PHASE_DIRS.codex }),
  schema: z
    .object({
      title: z.string().optional(),
      slug: z.string().optional(),
      category: z.string().optional(),
      summary: z.string().optional(),
      excerpt: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      draft: z.boolean().optional().default(false),
    })
    // Allow unknown frontmatter keys — codex entries will accumulate
    // domain-specific fields (e.g. character.first_appearance,
    // relic.bearer) that don't belong in the floor schema. Astro's
    // collection validator is strict-by-default; passthrough flips that.
    .passthrough(),
});

export const collections = { rubedo, nigredo, albedo, citrinitas, codex };

import { derive_chapter_slug } from "./chapter_slug.js";
import { build_markdown_book_map } from "./assembly/books.js";
// Rubedo scene sources — dual-glob during the obsidian-migration window.
//
// Historically rubedo scenes lived under `src/content/rubedo/` (project-side).
// The canonical home is `obsidian/alchemy_writing/zzzz_rubedo/<book>/...`
// matching the nigredo/albedo/citrinitas pattern (vault = single source of
// truth). The project-side glob stays during transition so Sol can move
// books over carefully without breaking the build mid-way. Once the
// project-side `src/content/rubedo/` is empty, the first glob can be
// dropped — keeping it costs ~0 for empty dirs.
//
// `@vault` alias resolves to the obsidian root (see astro.config.mjs).
// Vite's static analyzer requires alias usage at the glob callsite — do
// not interpolate or precompute the pattern string.
const scene_module_map = {
  ...import.meta.glob(
    ["../../content/rubedo/**/*.md", "!../../content/rubedo/**/refs/**/*.md"],
    { eager: true },
  ),
  ...import.meta.glob(
    [
      "@vault/alchemy_writing/zzzz_rubedo/**/*.md",
      "!@vault/alchemy_writing/zzzz_rubedo/**/refs/**/*.md",
    ],
    { eager: true },
  ),
};

const rubedo_book_map = Object.freeze(
  build_markdown_book_map(scene_module_map),
);

const rubedo_book_slugs = Object.freeze(
  Object.keys(rubedo_book_map).sort((left_slug, right_slug) => {
    return left_slug.localeCompare(right_slug);
  }),
);

// Collects the distinct thread keys present in a chapter's scenes,
// with the default cinza thread always first when present.
const normalized_thread_key = (scene) => {
  if (typeof scene?.thread_key !== "string") return "";
  return scene.thread_key.trim();
};

const compare_thread_keys = (left_key, right_key, default_key) => {
  if (left_key === default_key) return -1;
  if (right_key === default_key) return 1;
  return left_key.localeCompare(right_key);
};

const collect_chapter_thread_keys = (scenes = [], default_key = "cinza") => {
  const key_set = new Set();
  for (const scene of scenes) {
    const key = normalized_thread_key(scene);
    if (key) key_set.add(key);
  }
  return [...key_set].sort((left, right) =>
    compare_thread_keys(left, right, default_key),
  );
};

// Timeline-specific serializer — chapter-level only, no scene prose.
// Purpose: feed the constellation map with everything it needs to render
// nodes, edges, hover previews, and thread color coding.
// Does NOT include scene body content — chapters own their own content.
const to_timeline_chapter = (chapter = {}) => {
  const thread_keys = collect_chapter_thread_keys(chapter.scenes ?? []);

  return {
    chapter_id: chapter.chapter_id,
    chapter_slug: derive_chapter_slug(chapter.timeline_position),
    timeline_position: chapter.timeline_position,
    title: chapter.title,
    description: chapter.chapter_description,
    snippet: chapter.sol__chapter_snippet,
    branch_edges: [...(chapter.branch_edges ?? [])],
    thread_keys,
    has_branches:
      Array.isArray(chapter.branch_edges) && chapter.branch_edges.length > 0,
    // Per-thread scene excerpts for hover popup — keyed by thread_key.
    // The default cinza/core excerpt is the fallback when no thread is active.
    scene_excerpts: Object.fromEntries(
      (chapter.scenes ?? []).map((scene) => {
        return [scene.thread_key, scene.scene_excerpt ?? null];
      }),
    ),
  };
};

// rubedo_book_json_map — timeline-ready, slim, serializable.
// Consumed by /rubedo/data/[book_slug].json and fetched by the timeline page
// on load. Cached client-side in the constellation module — hover preview
// reads from this cache, no per-hover server roundtrip.
//
// FUTURE: add free_chapter_limit field when paywall is implemented.
// e.g. free_chapter_limit: 50 — client can gate reader access without
// a server roundtrip by checking chapter index against this value.
const rubedo_book_json_map = Object.freeze(
  Object.fromEntries(
    Object.entries(rubedo_book_map).map(([book_slug, book_entry]) => {
      return [
        book_slug,
        {
          book_slug: book_entry.book_slug,
          title: book_entry.title,
          synopsis: book_entry.synopsis,
          chapters: (book_entry.chapters ?? []).map((chapter) => {
            return to_timeline_chapter(chapter);
          }),
        },
      ];
    }),
  ),
);

// Derives chapter slugs for all chapters in a book — used by getStaticPaths
// in chapter pages to generate one page per chapter.
const derive_chapter_slug_map = (book_slug = "") => {
  const book_entry = rubedo_book_map[book_slug];

  if (!book_entry) return {};

  return Object.fromEntries(
    (book_entry.chapters ?? []).map((chapter) => {
      return [
        derive_chapter_slug(chapter.timeline_position),
        chapter.chapter_id,
      ];
    }),
  );
};

export {
  rubedo_book_map,
  rubedo_book_json_map,
  rubedo_book_slugs,
  derive_chapter_slug,
  derive_chapter_slug_map,
};

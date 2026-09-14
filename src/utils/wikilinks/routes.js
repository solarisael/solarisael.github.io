import path from "node:path";
import { derive_chapter_slug } from "../../data/book/book_runtime.js";
import { normalize_identity_token } from "../../data/rubedo/scene_identity.js";
import {
  citrinitas_booklet_path,
  citrinitas_chapter_path,
} from "../../data/citrinitas/route_data.js";
const SOLARISAEL_BASE_URL = String(process.env.SOLARISAEL_BASE ?? "/").replace(
  /\/+$/,
  "",
);
const derive_scene_chapter_slug = (timeline_position) => {
  const numeric = Number(timeline_position);
  return derive_chapter_slug(Number.isFinite(numeric) ? numeric : 0);
};
const post_url = ({ frontmatter, file_stem, phase }) => {
  const slug =
    typeof frontmatter.slug === "string" && frontmatter.slug.trim()
      ? frontmatter.slug.trim()
      : file_stem;
  return `${SOLARISAEL_BASE_URL}/${phase}/${slug}`;
};
const booklet_url = ({ frontmatter }) => {
  const book_slug = normalize_identity_token(frontmatter.book_slug);
  if (!book_slug) {
    return null;
  }

  const chapter_id = normalize_identity_token(frontmatter.chapter_id);
  if (!chapter_id) {
    return `${SOLARISAEL_BASE_URL}${citrinitas_booklet_path(book_slug)}`;
  }

  const chapter_slug = derive_scene_chapter_slug(frontmatter.position);
  return `${SOLARISAEL_BASE_URL}${citrinitas_chapter_path(book_slug, chapter_slug)}`;
};
const scene_url = ({ frontmatter }) => {
  const book_slug = normalize_identity_token(frontmatter.book_slug);
  const thread_key = normalize_identity_token(frontmatter.thread_key);
  const chapter_slug = derive_scene_chapter_slug(frontmatter.timeline_position);
  if (!book_slug || !thread_key || !chapter_slug) {
    // Scene is missing required identity — wikilinks shouldn't point at
    // a route the rubedo loader will skip. Return null; caller will mark
    // the registry entry skipped.
    return null;
  }
  // The cinza-core scene is the "canonical" chapter view; non-cinza
  // scenes get the per-thread route.
  if (thread_key === "cinza") {
    return `${SOLARISAEL_BASE_URL}/rubedo/${book_slug}/${chapter_slug}`;
  }
  return `${SOLARISAEL_BASE_URL}/rubedo/${book_slug}/${thread_key}/${chapter_slug}`;
};
const codex_url = ({ scan_root, file_path }) => {
  const relative_path = path
    .relative(scan_root, file_path)
    .replaceAll(path.sep, "/")
    .replace(/\.md$/i, "");
  return `${SOLARISAEL_BASE_URL}/codex/${relative_path}`;
};
const build_url_for_target = (record) => {
  switch (record.url_strategy) {
    case "post_slug":
      return post_url(record);
    case "citrinitas_booklet":
      return booklet_url(record);
    case "rubedo_scene":
      return scene_url(record);
    case "codex_entry_path":
      return codex_url(record);
    default:
      return null;
  }
};
export { SOLARISAEL_BASE_URL, build_url_for_target };

import { getCollection } from "astro:content";
import {
  citrinitas_book_map,
  citrinitas_book_slugs,
} from "../data/citrinitas/booklet_runtime.js";
import {
  citrinitas_chapter_path,
  citrinitas_booklet_path,
} from "../data/citrinitas/route_data.js";
import { redact_length, markdown_to_plain_text } from "./nigredo_feed.js";
import { base_path, with_base } from "./routes.js";
import { collect_rubedo_entries } from "./publication_catalog_rubedo.js";

const page_path = (path_value = "") => {
  const path = with_base(path_value);
  if (path === `${base_path}/` || /\.[a-z0-9]+$/iu.test(path)) return path;
  return `${path}/`;
};
const SITE_SECTIONS = [
  {
    path: "/",
    title: "Our Hearth",
    description:
      "A small public grove for Solarisael's writing, records, experiments, and work.",
    section: "site",
  },
  {
    path: "/writing",
    title: "Writing",
    description:
      "Amateur writing, late-night fragments, reflections, poems, and excerpts.",
    section: "site",
  },
  {
    path: "/work",
    title: "Work",
    description:
      "Original tools, systems, and websites built for people beyond this room.",
    section: "site",
  },
  {
    path: "/about",
    title: "About",
    description:
      "Meet Sol, the creature tending this place, and find a public way to make contact.",
    section: "site",
  },
  {
    path: "/nigredo",
    title: "Nigredo",
    description: "Uncut writing: the thought before it learns to behave.",
    section: "nigredo",
  },
  {
    path: "/albedo",
    title: "Albedo",
    description: "Washed and composed thoughts that reached the other side.",
    section: "albedo",
  },
  {
    path: "/citrinitas",
    title: "Citrinitas",
    description: "Contained works, booklets, and pieces that landed.",
    section: "citrinitas",
  },
  {
    path: "/rubedo",
    title: "Rubedo",
    description: "Long-form writing and work that Sol wants to grow into.",
    section: "rubedo",
  },
  {
    path: "/codex",
    title: "Codex",
    description:
      "The lore index for names, categories, definitions, and cross-references.",
    section: "codex",
  },
  {
    path: "/search",
    title: "Search",
    description: "Search the public writing and reference catalogue.",
    section: "search",
  },
];

const LABS = [
  ["labs/text-effects", "Text Effects Reference"],
  ["labs/effect-windows", "Effect Windows"],
  ["labs/pretext-shapes", "Pretext Shapes"],
  ["labs/text-transitions", "Text Transitions"],
  ["labs/shader-chalice", "Shader Chalice"],
  ["labs/fx-diagnostics", "FX Diagnostics"],
  ["labs/test-interactions", "Interaction Sandbox"],
];

const clean_text = (value = "") => {
  const without_frontmatter = String(value).replace(/^---[\s\S]*?---\s*/u, "");
  return markdown_to_plain_text(without_frontmatter)
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const truncate = (value, limit = 160) => {
  const text = clean_text(value);
  if (text.length <= limit) return text;
  const shortened = text
    .slice(0, limit - 1)
    .replace(/\s+\S*$/u, "")
    .trim();
  return `${shortened || text.slice(0, limit - 1).trim()}…`;
};

const clean_title = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const description_from = (preferred, body, fallback) =>
  truncate(clean_text(preferred) || clean_text(body) || fallback);

const iso_date = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
};

const entry = ({
  path,
  title,
  description,
  text = "",
  section,
  published_at = null,
  canonical_path = path,
}) => ({
  path: page_path(path),
  title: clean_title(title) || "Untitled page",
  description: description_from(description, text, title),
  text: clean_text(text),
  section,
  published_at: iso_date(published_at),
  canonical_path: page_path(canonical_path),
});

const public_collection_entries = async (
  collection_name,
  section,
  path_for,
  title_for,
) => {
  const records = await getCollection(collection_name, ({ data, id }) => {
    if (data?.draft) return false;
    const stem = String(id).split("/").pop()?.toLowerCase() ?? "";
    return stem !== "readme" && stem !== "_template";
  });

  return records.map((record) => {
    const title = title_for(record);
    const path = path_for(record);
    return entry({
      path,
      title,
      description: record.data?.excerpt ?? record.data?.summary,
      text: record.body,
      section,
      published_at: record.data?.published_at,
    });
  });
};

const collect_codex_categories = (records) =>
  [
    ...new Set(
      records
        .map((record) => String(record.id).split("/"))
        .filter((segments) => segments.length > 1)
        .map(([category]) => category),
    ),
  ].sort((left, right) => left.localeCompare(right));

const collect_lab_entries = () =>
  LABS.map(([path, title]) =>
    entry({
      path: `/codex/${path}`,
      title,
      description: `A public reference page for ${title.toLowerCase()}.`,
      section: "codex",
    }),
  );

const collect_citrinitas_entries = () => {
  const records = [];
  for (const book_slug of citrinitas_book_slugs) {
    const book = citrinitas_book_map[book_slug];
    const book_path = citrinitas_booklet_path(book_slug);
    records.push(
      entry({
        path: book_path,
        title: book.title,
        description: book.synopsis,
        text: book.synopsis,
        section: "citrinitas",
      }),
    );
    for (const chapter of book.chapters ?? []) {
      records.push(
        entry({
          path: citrinitas_chapter_path(book_slug, chapter.chapter_slug),
          title: chapter.title,
          description: chapter.excerpt,
          text: chapter.body,
          section: "citrinitas",
        }),
      );
    }
  }
  return records;
};

const is_public_codex = ({ data, id }) => {
  if (data?.draft) return false;
  const stem = String(id).split("/").pop()?.toLowerCase() ?? "";
  return stem !== "readme" && stem !== "_template";
};

const load_catalog_sources = async () => {
  const [nigredo, albedo, codex] = await Promise.all([
    public_collection_entries(
      "nigredo",
      "nigredo",
      (record) => `/nigredo/${record.data.slug}`,
      (record) =>
        record.data.title ?? "■".repeat(redact_length(record.data.slug)),
    ),
    public_collection_entries(
      "albedo",
      "albedo",
      (record) => `/albedo/${record.data.slug}`,
      (record) => record.data.title ?? record.data.slug,
    ),
    getCollection("codex", is_public_codex),
  ]);
  return { nigredo, albedo, codex };
};

const collect_codex_entries = (codex) =>
  codex.map((record) =>
    entry({
      path: `/codex/${record.id}`,
      title:
        record.data?.title ??
        record.data?.slug ??
        String(record.id).split("/").at(-1),
      description: record.data?.summary ?? record.data?.excerpt,
      text: record.body,
      section: "codex",
    }),
  );

const collect_codex_category_entries = (codex) =>
  collect_codex_categories(codex).map((slug) =>
    entry({
      path: `/codex/${slug}`,
      title: slug
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/gu, (letter) => letter.toUpperCase()),
      description: `Entries in the ${slug.replace(/[-_]+/g, " ")} category.`,
      section: "codex",
    }),
  );

const dedupe_entries = (entries) => {
  const seen = new Set();
  return entries.filter((item) => {
    if (seen.has(item.canonical_path)) return false;
    seen.add(item.canonical_path);
    return true;
  });
};

let catalog_cache;

const get_publication_entries = async () => {
  if (catalog_cache) return catalog_cache;
  const { nigredo, albedo, codex } = await load_catalog_sources();
  const rubedo_result = collect_rubedo_entries({
    make_entry: entry,
    make_page_path: page_path,
  });
  const all_entries = [
    ...SITE_SECTIONS.map((item) => entry(item)),
    ...nigredo,
    ...albedo,
    ...collect_codex_category_entries(codex),
    ...collect_codex_entries(codex),
    ...collect_lab_entries(),
    ...collect_citrinitas_entries(),
    ...rubedo_result.records,
  ];
  catalog_cache = dedupe_entries(all_entries);
  publication_aliases = Object.freeze(rubedo_result.aliases);
  return catalog_cache;
};

let publication_aliases = Object.freeze({});

export { get_publication_entries, publication_aliases };

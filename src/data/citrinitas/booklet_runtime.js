import {
  build_book_map,
  list_book_slugs,
  chapter_neighbors,
} from "../book/book_runtime.js";

// Citrinitas booklets — the yellowing: contained works, things that landed.
// A booklet lives under alchemy_writing/zzz_citrinitas/<book-slug>/ with a _book.md
// (booklet meta) and position-ordered chapter files. No threads, no timeline,
// no constellation — just ordered chapters and a masonry portfolio gallery.
//
// The one literal glob lives here (Vite requires the @vault alias at the
// callsite). _book.md is globbed too: it carries book_slug + book meta and no
// chapter_id, so the core folds its meta into the booklet and contributes no
// chapter — a first-class meta-only record, not a skipped file.
const module_map = import.meta.glob(
  "@vault/alchemy_writing/zzz_citrinitas/**/*.md",
  {
    eager: true,
  },
);

// Identity config — names the citrinitas frontmatter fields for the shared
// core. Booklet meta (title/synopsis/cover/size) rides on each chapter via the
// book_* fields; _book.md is the canonical carrier but any chapter may repeat
// them (first non-null wins in the fold).
const CITRINITAS_IDENTITY = {
  book_slug_field: "book_slug",
  chapter_id_field: "chapter_id",
  position_field: "position",
  book_title_field: "book_title",
  book_synopsis_field: "book_synopsis",
  book_cover_field: "book_cover",
  book_size_field: "book_size",
  chapter_title_field: "chapter_title",
  chapter_excerpt_field: "chapter_excerpt",
  chapter_cover_field: "chapter_cover",
};

// Masonry size tokens — architecture as data. A booklet declares book_size in
// _book.md; the gallery reads the span pair here. Unknown/absent -> "regular".
// Spans are [column_span, row_span] against the masonry grid.
const MASONRY_SIZES = {
  regular: { columns: 1, rows: 1 },
  wide: { columns: 2, rows: 1 },
  tall: { columns: 1, rows: 2 },
  large: { columns: 2, rows: 2 },
};
const DEFAULT_SIZE = "regular";

const resolve_masonry_size = (size_token) =>
  MASONRY_SIZES[size_token] ? size_token : DEFAULT_SIZE;

const citrinitas_book_map = build_book_map(module_map, CITRINITAS_IDENTITY);
const citrinitas_book_slugs = list_book_slugs(citrinitas_book_map);

// Gallery view — one card per booklet, with its masonry size + cover + first
// chapter slug as the entry point. Slim and serializable; no chapter bodies.
const citrinitas_gallery = citrinitas_book_slugs.map((book_slug) => {
  const book = citrinitas_book_map[book_slug];
  const first_chapter = book.chapters[0] ?? {};
  const size = resolve_masonry_size(book.size);

  return {
    book_slug,
    title: book.title,
    synopsis: book.synopsis,
    cover: book.cover ?? first_chapter.cover ?? null,
    size,
    masonry: MASONRY_SIZES[size],
    chapter_count: book.chapters.length,
    first_chapter_slug: first_chapter.chapter_slug ?? null,
  };
});

export {
  citrinitas_book_map,
  citrinitas_book_slugs,
  citrinitas_gallery,
  chapter_neighbors,
  MASONRY_SIZES,
};

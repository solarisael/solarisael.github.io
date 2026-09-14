// Shared book core — phase-agnostic spine for any "contained work" phase
// (citrinitas booklets now; rubedo books after its refactor). The core never
// globs the vault itself: Vite''s import.meta.glob demands a literal pattern at
// the callsite, so each phase owns its one glob line and hands the resulting
// module map here. Everything downstream — folding, ordering, slugs, routing —
// lives in this single source so the phases don''t fork.
//
// Architecture is the data: a book is a row built by walking a flat module
// map through named single-job passes. Adding a phase is handing this a
// module map + an identity_config, not threading new branches.

// An identity_config names which frontmatter fields carry the book identity.
// Each phase supplies its own; the core stays ignorant of phase specifics.
//   book_slug_field    -> frontmatter key for the book/booklet slug
//   chapter_id_field   -> frontmatter key for the stable chapter id
//   position_field     -> frontmatter key for ordering (number)
//   book_title_field, book_synopsis_field, book_cover_field
//   chapter_title_field, chapter_excerpt_field, chapter_cover_field

const read_string = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const read_position = (value, chapter_id, source_file) => {
  const position = Number(value);
  if (Number.isFinite(position)) return position;
  console.warn(
    `[book] ${source_file}: chapter "${chapter_id}" has no numeric position; using 0.`,
  );
  return 0;
};

const get_chapter_component = (module) => {
  if (typeof module?.Content === "function") return module.Content;
  if (typeof module?.default === "function") return module.default;
  return null;
};
const get_raw_content = (module) => {
  if (typeof module?.rawContent === "function") return module.rawContent();
  if (typeof module?.rawContent === "string") return module.rawContent;
  if (typeof module?.body === "string") return module.body;
  return "";
};

// Zero-pad an ordering position into a stable URL slug, decoupled from title.
// 0 -> "000", 7 -> "007", 42 -> "042". Min 3 digits.
const derive_chapter_slug = (position = 0) =>
  String(Math.max(0, Math.floor(position))).padStart(3, "0");

// Title-case a slug for a fallback display name. "the-garden" -> "The Garden".
const titleize_slug = (slug = "") =>
  String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

const read_book_meta = (fm, config) => ({
  title: read_string(fm[config.book_title_field]),
  synopsis: read_string(fm[config.book_synopsis_field]),
  cover: read_string(fm[config.book_cover_field]),
  size: read_string(fm[config.book_size_field]),
});

// PASS 1 — collect: flatten the module map into book-keyed records. Each
// record carries book meta always, and a chapter only when it has a
// chapter_id. A meta-only file (e.g. _book.md: a book_slug + book meta, no
// chapter_id) is a first-class record, not an error — it seeds the booklet''s
// meta and contributes no chapter. A file missing book_slug entirely is the
// only skip, since it can''t be placed at all.
const collect_records = (module_map, config) => {
  const records = [];

  for (const [source_file, module] of Object.entries(module_map)) {
    const fm = module?.frontmatter ?? {};
    const book_slug = read_string(fm[config.book_slug_field]);

    if (!book_slug) {
      console.warn(
        `[book] Skipping ${source_file}: missing ${config.book_slug_field}.`,
      );
      continue;
    }

    const chapter_id = read_string(fm[config.chapter_id_field]);
    const record = {
      source_file,
      book_slug,
      book_meta: read_book_meta(fm, config),
      chapter: null,
    };

    if (chapter_id) {
      record.chapter = {
        chapter_id,
        position: read_position(
          fm[config.position_field],
          chapter_id,
          source_file,
        ),
        title:
          read_string(fm[config.chapter_title_field]) ??
          titleize_slug(chapter_id),
        excerpt: read_string(fm[config.chapter_excerpt_field]),
        cover: read_string(fm[config.chapter_cover_field]),
        // Astro's Markdown module exposes rawContent() beside its rendered
        // component. Keep it for the publication catalog; renderers ignore it.
        body: get_raw_content(module),
        Content: get_chapter_component(module),
      };
    }

    records.push(record);
  }

  return records;
};

// PASS 2 — fold: group records under their book, accumulating book-level meta
// from whichever record carries it (first non-null wins) and collecting the
// chapter when present.
const fold_records_into_books = (records) => {
  const books = new Map();

  for (const record of records) {
    if (!books.has(record.book_slug)) {
      books.set(record.book_slug, {
        book_slug: record.book_slug,
        title: null,
        synopsis: null,
        cover: null,
        size: null,
        chapters: [],
      });
    }

    const book = books.get(record.book_slug);
    book.title ??= record.book_meta.title;
    book.synopsis ??= record.book_meta.synopsis;
    book.cover ??= record.book_meta.cover;
    book.size ??= record.book_meta.size;
    if (record.chapter) book.chapters.push(record.chapter);
  }

  return books;
};

// PASS 3 — order: sort each book''s chapters by position and freeze the book
// into its public, serializable shape (chapter slugs derived here, once).
const order_and_freeze = (books) => {
  const book_map = {};

  for (const [book_slug, book] of books) {
    const ordered = [...book.chapters]
      .sort((a, b) => a.position - b.position)
      .map((chapter) => ({
        chapter_id: chapter.chapter_id,
        // Slug baked once here (the chapters are already sorted), so
        // consumers read chapter.chapter_slug instead of re-deriving it at
        // every callsite — mirrors the shared book/ core.
        chapter_slug: derive_chapter_slug(chapter.position),
        position: chapter.position,
        title: chapter.title,
        excerpt: chapter.excerpt,
        cover: chapter.cover,
        body: chapter.body,
        Content: chapter.Content,
      }));

    book_map[book_slug] = Object.freeze({
      book_slug,
      title: book.title ?? titleize_slug(book_slug),
      synopsis: book.synopsis ?? "",
      cover: book.cover,
      size: book.size,
      chapters: Object.freeze(ordered),
    });
  }

  return book_map;
};

// The composer: three named passes, read as a sentence.
const build_book_map = (module_map, config) =>
  Object.freeze(
    order_and_freeze(
      fold_records_into_books(collect_records(module_map, config)),
    ),
  );

// Stable, sorted slug list for galleries and getStaticPaths.
const list_book_slugs = (book_map) =>
  Object.freeze(Object.keys(book_map).sort((a, b) => a.localeCompare(b)));

// Adjacent chapters for prev/next reader nav. Returns { prev, next } slugs
// (or null at the ends) for a given book + chapter slug.
const chapter_neighbors = (book_map, book_slug, chapter_slug) => {
  const book = book_map[book_slug];
  if (!book) return { prev: null, next: null };

  const index = book.chapters.findIndex((c) => c.chapter_slug === chapter_slug);
  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? book.chapters[index - 1] : null,
    next: index < book.chapters.length - 1 ? book.chapters[index + 1] : null,
  };
};

export {
  build_book_map,
  list_book_slugs,
  chapter_neighbors,
  derive_chapter_slug,
  titleize_slug,
};

import {
  rubedo_book_map,
  rubedo_book_slugs,
} from "../data/rubedo/book_timeline_runtime.js";

const thread_keys_for = (chapter) => {
  const keys = [
    ...new Set(
      (chapter.scenes ?? []).map((scene) => scene.thread_key).filter(Boolean),
    ),
  ];
  return keys.sort((left, right) =>
    left === "cinza" ? -1 : right === "cinza" ? 1 : left.localeCompare(right),
  );
};

const select_rubedo_scene = (chapter, thread_key) =>
  (chapter.scenes ?? []).find(
    (candidate) =>
      candidate.thread_key === thread_key &&
      candidate.thread_modifier === "core",
  ) ??
  (chapter.scenes ?? []).find(
    (candidate) => candidate.thread_key === thread_key,
  );

const rubedo_thread_entry = (book_slug, chapter, thread_key, make_entry) => {
  const scene = select_rubedo_scene(chapter, thread_key);
  const chapter_title = chapter.title ?? chapter.chapter_slug;
  const thread_suffix = thread_key === "cinza" ? "" : ` - ${thread_key}`;
  return make_entry({
    path: `/rubedo/${book_slug}/${thread_key}/${chapter.chapter_slug}`,
    title: `${chapter_title}${thread_suffix}`,
    description:
      scene?.scene_excerpt ||
      scene?.chapter_description_override ||
      chapter.chapter_description,
    text:
      scene?.scene_body || scene?.scene_excerpt || chapter.sol__chapter_snippet,
    section: "rubedo",
  });
};

const rubedo_chapter_entries = (
  book_slug,
  chapter,
  aliases,
  make_entry,
  make_page_path,
) => {
  const threads = thread_keys_for(chapter);
  const primary_thread = threads[0] ?? "cinza";
  aliases[make_page_path(`/rubedo/${book_slug}/${chapter.chapter_slug}`)] =
    make_page_path(
      `/rubedo/${book_slug}/${primary_thread}/${chapter.chapter_slug}`,
    );
  return threads.map((thread_key) =>
    rubedo_thread_entry(book_slug, chapter, thread_key, make_entry),
  );
};

const collect_rubedo_entries = ({ make_entry, make_page_path }) => {
  const records = [];
  const aliases = {};
  for (const book_slug of rubedo_book_slugs) {
    const book = rubedo_book_map[book_slug];
    records.push(
      make_entry({
        path: `/rubedo/${book_slug}`,
        title: book.title,
        description: book.synopsis,
        text: book.synopsis,
        section: "rubedo",
      }),
      make_entry({
        path: `/rubedo/${book_slug}/timeline`,
        title: `${book.title} — constellation`,
        description: book.synopsis,
        text: book.synopsis,
        section: "rubedo",
      }),
      ...(book.chapters ?? []).flatMap((chapter) =>
        rubedo_chapter_entries(
          book_slug,
          chapter,
          aliases,
          make_entry,
          make_page_path,
        ),
      ),
    );
  }
  return { records, aliases };
};

export { collect_rubedo_entries };

const escape_html = (raw_value) => {
  return String(raw_value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const find_preview_chapter = (book_data, chapter_id) => {
  for (const chapter_entry of book_data?.chapters ?? []) {
    if (chapter_entry.chapter_id === chapter_id) {
      return chapter_entry;
    }
  }

  return null;
};

const build_branch_label_text = (branch_edges = []) => {
  const labels = [];

  for (const edge of branch_edges) {
    const condition = edge.condition_label ? ` (${edge.condition_label})` : "";
    labels.push(`to ${edge.to_chapter_id}${condition}`);
  }

  return labels.join(", ");
};

const preview_paragraph = (kind, text) => {
  return text
    ? `<p class="timeline-hover-${kind}">${escape_html(text)}</p>`
    : "";
};

const preview_excerpt = (chapter, thread_key) => {
  return (
    chapter.scene_excerpts?.[thread_key] ??
    chapter.scene_excerpts?.cinza ??
    null
  );
};

const process_preview_links = (preview_node) => {
  const window_any = /** @type {any} */ (globalThis);
  const htmx_api = window_any.htmx;
  if (htmx_api?.process) {
    htmx_api.process(preview_node);
  }
};

const render_hover_preview_from_cache = ({
  node_entry,
  book_data,
  base_path,
  preview_node,
}) => {
  if (!(preview_node instanceof HTMLElement)) {
    return;
  }

  const chapter = find_preview_chapter(book_data, node_entry?.chapter_id);

  if (!chapter) {
    preview_node.innerHTML = "";

    return;
  }

  const chapter_href = `${base_path}/rubedo/${book_data.book_slug}/${chapter.chapter_slug}`;
  const excerpt = preview_excerpt(chapter, node_entry.thread_key);
  const branch_labels = build_branch_label_text(chapter.branch_edges ?? []);

  preview_node.innerHTML = `
    <h3 class="timeline-hover-title">${escape_html(chapter.title ?? chapter.chapter_id)}</h3>
    ${preview_paragraph("description", chapter.description)}
    ${preview_paragraph("snippet", chapter.snippet)}
    ${preview_paragraph("excerpt", excerpt)}
    ${preview_paragraph("branches", branch_labels)}
    <p class="timeline-hover-action">
      <a
        href="${escape_html(chapter_href)}"
        hx-get="${escape_html(chapter_href)}"
        hx-target="#sol_page_shell"
        hx-select="#sol_page_shell"
        hx-swap="morph swap:220ms settle:260ms"
        class="timeline-hover-go"
      >Read chapter</a>
    </p>
  `;

  process_preview_links(preview_node);
};

export { build_branch_label_text, render_hover_preview_from_cache };

const normalize_text = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const query_terms = (query) => normalize_text(query).split(" ").filter(Boolean);

const score_entry = (entry, query) => {
  const normalized_query = normalize_text(query);
  const terms = query_terms(query);
  if (!normalized_query || !terms.length) return 0;

  const fields = [
    normalize_text(entry.title),
    normalize_text(entry.description),
    normalize_text(entry.text),
  ];
  let score = 0;
  for (const term of terms) {
    const title_match = fields[0].includes(term);
    const description_match = fields[1].includes(term);
    const body_match = fields[2].includes(term);

    if (title_match) score += 100000;
    else if (description_match) score += 1000;
    else if (body_match) score += 100;
    else return 0;
  }

  if (fields[0].includes(normalized_query)) score += 10000;
  if (fields[2].includes(normalized_query)) score += 10;
  return score;
};

const search_entries = (entries, query) => {
  const seen_paths = new Set();
  return entries
    .map((entry) => ({ entry, score: score_entry(entry, query) }))
    .filter(({ entry, score }) => {
      if (score <= 0 || seen_paths.has(entry.path)) return false;
      seen_paths.add(entry.path);
      return true;
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.entry.title.localeCompare(right.entry.title),
    )
    .map(({ entry }) => entry);
};

export { normalize_text, query_terms, score_entry, search_entries };

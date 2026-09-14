const SEARCH_ENDPOINT = "search-index.json";
const SEARCH_FIELDS = ["path", "title", "description", "text", "section"];
let index_cache = null;

const get_base_path = () =>
  String(document.documentElement?.dataset.basePath ?? "").replace(/\/+$/, "");

const with_base = (path_value) => {
  const path = String(path_value).replace(/^\/+/, "");
  return `${get_base_path()}/${path}`;
};

const is_same_origin_path = (path_value) => {
  const path = String(path_value ?? "");
  if (!path.startsWith("/") || path.startsWith("//")) return false;

  try {
    const resolved = new URL(path, window.location.origin);
    return (
      resolved.origin === window.location.origin &&
      !resolved.search &&
      !resolved.hash
    );
  } catch {
    return false;
  }
};

const prepare_entries = (payload) => {
  if (!Array.isArray(payload)) {
    throw new TypeError("search index must be an array");
  }

  const seen_paths = new Set();
  return payload
    .filter((entry) => entry && is_same_origin_path(entry.path))
    .map((entry) =>
      Object.fromEntries(
        SEARCH_FIELDS.map((field) => [field, String(entry[field] ?? "")]),
      ),
    )
    .filter((entry) => {
      if (seen_paths.has(entry.path)) return false;
      seen_paths.add(entry.path);
      return Boolean(entry.title);
    });
};

const fetch_index = async (signal) => {
  if (index_cache) return index_cache;

  const response = await fetch(with_base(SEARCH_ENDPOINT), {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Search index request failed (${response.status})`);
  }

  index_cache = prepare_entries(await response.json());
  return index_cache;
};

export { fetch_index, with_base };

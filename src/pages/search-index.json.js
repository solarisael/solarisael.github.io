import { get_publication_entries } from "../utils/publication_catalog.js";

const SEARCH_FIELDS = ["path", "title", "description", "text", "section"];

export const GET = async () => {
  const entries = await get_publication_entries();
  const search_entries = entries.map((entry) =>
    Object.fromEntries(
      SEARCH_FIELDS.map((field) => [field, String(entry[field] ?? "")]),
    ),
  );

  return new Response(JSON.stringify(search_entries), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
};

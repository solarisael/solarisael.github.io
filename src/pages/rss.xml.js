import { get_publication_entries } from "../utils/publication_catalog.js";

const xml_escape = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const GET = async ({ site }) => {
  const entries = await get_publication_entries();
  const origin = site?.origin ?? "https://solarisael.github.io";
  const items = entries
    .filter(
      (entry) =>
        (entry.section === "nigredo" || entry.section === "albedo") &&
        entry.published_at,
    )
    .sort((left, right) => right.published_at.localeCompare(left.published_at))
    .map((entry) => {
      const url = new URL(entry.canonical_path, origin).href;
      return `<item><title>${xml_escape(entry.title)}</title><link>${xml_escape(url)}</link><guid isPermaLink="true">${xml_escape(url)}</guid><description>${xml_escape(entry.description)}</description><pubDate>${xml_escape(new Date(entry.published_at).toUTCString())}</pubDate></item>`;
    })
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Solarisael</title><link>${xml_escape(origin)}</link><description>Recent public writing from Solarisael.</description>${items}</channel></rss>`,
    { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
  );
};

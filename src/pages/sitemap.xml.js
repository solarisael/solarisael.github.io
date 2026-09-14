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
  const urls = entries
    .filter((publication) => publication.section !== "search")
    .map((publication) => {
      const lastmod = publication.published_at
        ? `<lastmod>${xml_escape(publication.published_at)}</lastmod>`
        : "";
      return `<url><loc>${xml_escape(new URL(publication.canonical_path, origin).href)}</loc>${lastmod}</url>`;
    })
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
};

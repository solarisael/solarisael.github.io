import { get_publication_entries } from "../utils/publication_catalog.js";
import { base_path } from "../utils/routes.js";

const by_section = (entries, section) =>
  entries.filter((entry) => entry.section === section).slice(0, 12);

export const GET = async ({ site }) => {
  const entries = await get_publication_entries();
  const origin = site?.origin ?? "https://solarisael.github.io";
  const link = (entry) =>
    `- [${entry.title}](${new URL(entry.canonical_path, origin).href}): ${entry.description}`;
  const sections = [
    ["Site", by_section(entries, "site")],
    ["Nigredo writing", by_section(entries, "nigredo")],
    ["Albedo writing", by_section(entries, "albedo")],
    ["Citrinitas booklets", by_section(entries, "citrinitas")],
    ["Rubedo works", by_section(entries, "rubedo")],
    ["Codex references", by_section(entries, "codex")],
  ];
  const body = sections
    .map(([title, items]) => `## ${title}\n\n${items.map(link).join("\n")}`)
    .join("\n\n");
  const search_url = new URL(`${base_path}/search`, `${origin}/`).href;
  const rss_url = new URL(`${base_path}/rss.xml`, `${origin}/`).href;

  return new Response(
    `# Solarisael\n\nSolarisael is a small public grove for writing, records, experiments, and work.\n\nThis file is a concise navigation guide to the public site. Follow the linked pages for their complete content.\n\n${body}\n\n## Navigation\n\n- [Public search catalogue](${search_url}): Search the public writing and reference catalogue.\n- [RSS feed](${rss_url}): Discover recent public writing.`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
};

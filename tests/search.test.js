import { describe, expect, test } from "bun:test";

import {
  normalize_text,
  score_entry,
  search_entries,
} from "../src/scripts/search.js";

describe("public search ranking", () => {
  test("matches body prose with folded diacritics and whitespace", () => {
    const entry = {
      path: "/writing/cafe",
      title: "An ordinary page",
      description: "",
      text: "A café waits beside the sea.",
    };

    expect(normalize_text("  CAFÉ   waits ")).toBe("cafe waits");
    expect(search_entries([entry], "  CAFE waits ")).toEqual([entry]);
  });

  test("ranks title matches ahead of body-only matches", () => {
    const body_match = {
      path: "/writing/body",
      title: "Quiet page",
      description: "",
      text: "A lantern in the dark.",
    };
    const title_match = {
      path: "/writing/title",
      title: "Lantern guide",
      description: "",
      text: "A quiet index.",
    };

    expect(score_entry(title_match, "lantern")).toBeGreaterThan(
      score_entry(body_match, "lantern"),
    );
    expect(search_entries([body_match, title_match], "lantern")).toEqual([
      title_match,
      body_match,
    ]);
  });

  test("removes duplicate paths before rendering results", () => {
    const duplicate = {
      path: "/rubedo/book/cinza/000",
      title: "Cinza",
      description: "",
      text: "The same public chapter.",
    };

    expect(search_entries([duplicate, { ...duplicate }], "chapter")).toEqual([
      duplicate,
    ]);
    expect(
      search_entries([duplicate, { ...duplicate }], "same public"),
    ).toEqual([duplicate]);
  });
});

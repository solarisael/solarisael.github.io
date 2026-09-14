import { afterAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const FIXTURE_URL = "https://solarisael.local/current/";
const previous_url = globalThis.window?.location?.href ?? null;
if (!globalThis.window) {
  GlobalRegistrator.register({ url: FIXTURE_URL });
} else {
  globalThis.window.happyDOM.setURL(FIXTURE_URL);
}

afterAll(() => {
  if (previous_url && globalThis.window?.happyDOM) {
    globalThis.window.happyDOM.setURL(previous_url);
  }
});

const {
  derive_request_pathname,
  is_preload_request,
  is_route_swap_target,
  is_section_path_active,
  normalize_pathname,
} = await import("../public/js/modules/htmx_route_lifecycle.js");
const { announce_and_focus_route } =
  await import("../public/js/modules/route_accessibility.js");

const htmx_event = (detail) =>
  new CustomEvent("htmx:beforeRequest", { detail });

describe("htmx route lifecycle path helpers", () => {
  test("normalizes route pathnames by removing only trailing slashes", () => {
    expect(normalize_pathname("/rubedo/")).toBe("/rubedo");
    expect(normalize_pathname("/codex///")).toBe("/codex");
    expect(normalize_pathname("/rubedo/chapter-001")).toBe(
      "/rubedo/chapter-001",
    );
    expect(normalize_pathname("/")).toBe("/");
    expect(normalize_pathname("")).toBe("/");
  });

  test("treats a section as active for its own route and descendants only", () => {
    expect(is_section_path_active("/rubedo", "/rubedo")).toBe(true);
    expect(is_section_path_active("/rubedo/chapter-001", "/rubedo")).toBe(true);
    expect(is_section_path_active("/rubedo-archive", "/rubedo")).toBe(false);
    expect(is_section_path_active("/codex", "/rubedo")).toBe(false);
    expect(is_section_path_active("/rubedo", "/")).toBe(false);
    expect(is_section_path_active("/", "/")).toBe(true);
  });
});

describe("htmx route lifecycle swap target detection", () => {
  test("accepts only the page shell as a whole-page route swap target", () => {
    const shell_container = document.createElement("container");
    const page_shell = document.createElement("main");
    page_shell.id = "sol_page_shell";
    const content_target = document.createElement("section");
    content_target.id = "sol_content";

    expect(is_route_swap_target(shell_container)).toBe(false);
    expect(is_route_swap_target(page_shell)).toBe(true);
    expect(is_route_swap_target(content_target)).toBe(false);
  });

  test("rejects unrelated elements and non-element nodes", () => {
    const unrelated_target = document.createElement("main");
    unrelated_target.id = "other_main";
    const nested_fragment = document.createElement("article");
    nested_fragment.id = "sol_content_inner";

    expect(is_route_swap_target(unrelated_target)).toBe(false);
    expect(is_route_swap_target(nested_fragment)).toBe(false);
    expect(
      is_route_swap_target(document.createTextNode("not an element")),
    ).toBe(false);
  });
});

describe("htmx route lifecycle request path derivation", () => {
  test("uses htmx finalRequestPath before lower-fidelity request paths", () => {
    const event = htmx_event({
      pathInfo: { finalRequestPath: "/resolved-route/" },
      requestConfig: { path: "/configured-route/" },
      path: "/legacy-route/",
    });

    expect(derive_request_pathname(event)).toBe("/resolved-route");
  });

  test("derives normalized pathnames from each htmx request path source", () => {
    const cases = [
      {
        name: "pathInfo.finalRequestPath absolute URL",
        detail: {
          pathInfo: {
            finalRequestPath:
              "https://solarisael.local/rubedo/chapter-001/?from=nav",
          },
        },
        expected: "/rubedo/chapter-001",
      },
      {
        name: "requestConfig.path absolute path",
        detail: { requestConfig: { path: "/codex///?panel=open" } },
        expected: "/codex",
      },
      {
        name: "detail.path relative path",
        detail: { path: "nigredo/feed///?page=2" },
        expected: "/nigredo/feed",
      },
    ];

    for (const { detail, expected, name } of cases) {
      expect(derive_request_pathname(htmx_event(detail)), name).toBe(expected);
    }
  });

  test("falls back to the triggering anchor href when htmx omits path fields", () => {
    const anchor = document.createElement("a");
    anchor.href = "https://solarisael.local/rubedo/chapter-002/?from=preload";

    expect(derive_request_pathname(htmx_event({ elt: anchor }))).toBe(
      "/rubedo/chapter-002",
    );
  });

  test("returns null when the event contains no request path or anchor trigger", () => {
    expect(
      derive_request_pathname(
        htmx_event({ elt: document.createElement("button") }),
      ),
    ).toBeNull();
    expect(derive_request_pathname(htmx_event({}))).toBeNull();
  });
});

describe("htmx route lifecycle preload detection", () => {
  test("detects htmx preload cache warmups by HX-Preloaded header", () => {
    expect(
      is_preload_request(
        htmx_event({ requestConfig: { headers: { "HX-Preloaded": "true" } } }),
      ),
    ).toBe(true);
  });

  test("does not mark ordinary htmx requests as preload warmups", () => {
    expect(
      is_preload_request(
        htmx_event({ requestConfig: { headers: { "HX-Preloaded": "false" } } }),
      ),
    ).toBe(false);
    expect(
      is_preload_request(htmx_event({ requestConfig: { headers: {} } })),
    ).toBe(false);
    expect(is_preload_request(htmx_event({}))).toBe(false);
  });
});

describe("route accessibility handoff", () => {
  test("announces and focuses the swapped page heading", () => {
    document.body.innerHTML = `
      <p id="sol_route_status" role="status"></p>
      <main id="sol_page_shell"><h1>New chapter</h1></main>
    `;

    announce_and_focus_route();

    const heading = document.querySelector("h1");
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute("tabindex")).toBe("-1");
    expect(document.querySelector("#sol_route_status")?.textContent).toBe(
      "Loaded New chapter.",
    );
  });
});

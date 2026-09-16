(() => {
  const STORAGE_KEY = "site_scheme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const meta = document.querySelector('meta[name="color-scheme"]');
  let manual = null;
  let current = null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") manual = stored;
  } catch {
    manual = null;
  }

  const resolve = () => manual || (media.matches ? "dark" : "light");
  const update_controls = () => {
    const next = resolve() === "dark" ? "light" : "dark";
    const label = `Use ${next} colour scheme`;
    document
      .querySelectorAll("[data-site-scheme-toggle]")
      .forEach((control) => {
        control.setAttribute("aria-label", label);
        control.setAttribute("title", label);
        const caption = control.querySelector(".sol__side_menu_icon_label");
        if (caption) caption.textContent = label;
      });
  };
  const update = (dispatch = true) => {
    const scheme = resolve();
    if (current === scheme) return;
    current = scheme;
    document.documentElement.dataset.siteScheme = scheme;
    if (meta) meta.content = scheme;
    if (dispatch)
      document.dispatchEvent(
        new CustomEvent("sol:scheme-change", { detail: { scheme } }),
      );
    update_controls();
  };

  update(false);
  document.addEventListener("DOMContentLoaded", update_controls, {
    once: true,
  });
  document.addEventListener("htmx:afterSwap", update_controls);

  media.addEventListener("change", () => {
    if (!manual) update();
  });

  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-site-scheme-toggle]");
    if (!control) return;
    manual = resolve() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, manual);
    } catch {
      // Private browsing and disabled storage still allow the toggle for this page.
    }
    update();
  });
})();

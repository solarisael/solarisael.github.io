// wikilink_popup — hover/focus card for `[[]]` anchors.
//
// Reads data attributes on .sol__wikilink anchors (built by
// scripts/remark_wikilinks.js) and renders a singleton popup card pinned
// to the viewport. No fetch, no roundtrip — title + excerpt + phase
// already in the DOM.
//
// Lifecycle:
//   - one singleton popup element appended to <body> on first hover
//   - re-positions on every hover/focus (clamps to viewport)
//   - fades in on hover/focus, fades out on leave/blur
//   - re-binds delegated listeners once (event delegation survives
//     htmx swaps without rebinding per page)
//
// Broken links (.sol__wikilink--broken) are skipped — they have no
// resolved target so the popup would be empty.

const POPUP_OFFSET_PX = 12;
const POPUP_FADE_LEAVE_DELAY_MS = 80;

const ensure_popup_element = () => {
  let popup = document.querySelector(".sol__wikilink_popup");
  if (popup) return popup;
  popup = document.createElement("aside");
  popup.className = "sol__wikilink_popup";
  popup.setAttribute("data-state", "hidden");
  popup.setAttribute("role", "tooltip");
  popup.innerHTML = `
    <span class="sol__wikilink_popup_kicker"></span>
    <span class="sol__wikilink_popup_title"></span>
    <span class="sol__wikilink_popup_excerpt"></span>
  `;
  document.body.appendChild(popup);
  return popup;
};

const position_popup = (popup, anchor_rect) => {
  const popup_rect = popup.getBoundingClientRect();
  const viewport_width = window.innerWidth;
  const viewport_height = window.innerHeight;

  // Default: above the anchor, left-aligned.
  let top = anchor_rect.top - popup_rect.height - POPUP_OFFSET_PX;
  let left = anchor_rect.left;

  // If above would overflow, place below.
  if (top < 8) {
    top = anchor_rect.bottom + POPUP_OFFSET_PX;
  }

  // Clamp horizontally.
  if (left + popup_rect.width > viewport_width - 8) {
    left = viewport_width - popup_rect.width - 8;
  }
  if (left < 8) {
    left = 8;
  }

  // Clamp vertically — if it would overflow the bottom too, pin to top.
  if (top + popup_rect.height > viewport_height - 8) {
    top = Math.max(8, viewport_height - popup_rect.height - 8);
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
};

const populate_popup_for_anchor = (popup, anchor) => {
  const title = anchor.getAttribute("data-popup-title") || "";
  const excerpt = anchor.getAttribute("data-popup-excerpt") || "";
  const phase = anchor.getAttribute("data-popup-phase") || "";
  popup.querySelector(".sol__wikilink_popup_title").textContent = title;
  popup.querySelector(".sol__wikilink_popup_excerpt").textContent = excerpt;
  const kicker = popup.querySelector(".sol__wikilink_popup_kicker");
  kicker.textContent = phase ? `~/ ${phase}` : "";
};

let active_hover_anchor = null;
let leave_timer = null;

const show_popup_for = (anchor) => {
  if (!(anchor instanceof HTMLElement)) return;
  if (anchor.classList.contains("sol__wikilink--broken")) return;
  if (!anchor.hasAttribute("data-popup-title")) return;
  const popup = ensure_popup_element();
  populate_popup_for_anchor(popup, anchor);
  popup.setAttribute("data-state", "visible");
  // Defer to next frame so the popup has measured dimensions before we
  // clamp it against the viewport — first hover otherwise positions
  // with stale rect.
  requestAnimationFrame(() => {
    position_popup(popup, anchor.getBoundingClientRect());
  });
  active_hover_anchor = anchor;
};

const hide_popup = () => {
  const popup = document.querySelector(".sol__wikilink_popup");
  if (!popup) return;
  popup.setAttribute("data-state", "hidden");
  active_hover_anchor = null;
};

const schedule_hide = () => {
  if (leave_timer) clearTimeout(leave_timer);
  leave_timer = setTimeout(() => {
    hide_popup();
    leave_timer = null;
  }, POPUP_FADE_LEAVE_DELAY_MS);
};

const cancel_hide = () => {
  if (leave_timer) {
    clearTimeout(leave_timer);
    leave_timer = null;
  }
};

const handle_pointerover = (event) => {
  const anchor = event.target.closest?.(".sol__wikilink");
  if (!anchor) return;
  cancel_hide();
  if (anchor !== active_hover_anchor) {
    show_popup_for(anchor);
  }
};

const handle_pointerout = (event) => {
  const anchor = event.target.closest?.(".sol__wikilink");
  if (!anchor) return;
  // Only schedule hide when leaving the anchor itself, not internal nodes.
  const related = event.relatedTarget;
  if (related && anchor.contains(related)) return;
  schedule_hide();
};

const handle_focusin = (event) => {
  const anchor = event.target.closest?.(".sol__wikilink");
  if (!anchor) return;
  cancel_hide();
  show_popup_for(anchor);
};

const handle_focusout = (event) => {
  const anchor = event.target.closest?.(".sol__wikilink");
  if (!anchor) return;
  schedule_hide();
};

const handle_scroll_or_resize = () => {
  // Hide on scroll/resize — the popup's absolute position becomes stale
  // and re-positioning mid-scroll feels jittery. Re-hover to reopen.
  if (active_hover_anchor) {
    hide_popup();
  }
};

// Delegated listeners on body — survives htmx swaps because the body
// itself doesn't get morphed.
if (typeof document !== "undefined") {
  document.body.addEventListener("pointerover", handle_pointerover);
  document.body.addEventListener("pointerout", handle_pointerout);
  document.body.addEventListener("focusin", handle_focusin);
  document.body.addEventListener("focusout", handle_focusout);
  window.addEventListener("scroll", handle_scroll_or_resize, { passive: true });
  window.addEventListener("resize", handle_scroll_or_resize);
}

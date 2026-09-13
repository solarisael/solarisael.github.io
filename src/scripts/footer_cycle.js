import { resolve_footer_sentences } from "../data/footer_sentences.js";
import {
  layout_pretext_root,
  reset_pretext_source,
} from "scripts-of-folly/pretext";

const transition_plain_content = (root, next_html, on_swap) => {
  if (!root || root.nodeType !== 1) {
    return false;
  }

  root.innerHTML = String(next_html ?? "");
  reset_pretext_source(root, { restore: false });
  on_swap?.(root);
  layout_pretext_root(root);
  return true;
};

const DEFAULT_DURATION_MS = 12000;
const visibility_cycles = new Set();
const active_cycles = new WeakMap();

export const next_footer_index = (index, row_count) =>
  row_count > 0 ? (Number(index) + 1) % row_count : 0;

export const previous_footer_index = (index, row_count) =>
  row_count > 0 ? (Number(index) - 1 + row_count) % row_count : 0;

const clear_timer = (cycle) => {
  if (cycle.timer !== null) {
    clearTimeout(cycle.timer);
    cycle.timer = null;
  }
};

const schedule_cycle = (cycle) => {
  clear_timer(cycle);
  if (!cycle.root.isConnected) {
    cycle.observer?.disconnect();
    visibility_cycles.delete(cycle);
    return;
  }
  if (!cycle.visible || document.hidden || cycle.rows.length <= 1) {
    return;
  }

  const row = cycle.rows[cycle.index];
  const duration_ms =
    Number(row.duration_ms) > 0 ? Number(row.duration_ms) : DEFAULT_DURATION_MS;
  cycle.timer = setTimeout(() => {
    cycle.timer = null;
    if (!cycle.root.isConnected || !cycle.visible || document.hidden) {
      schedule_cycle(cycle);
      return;
    }

    step_cycle(cycle, "next");
  }, duration_ms);
};

// Shared by the timer and the manual arrows. Manual steps deliberately skip
// the visible/hidden gates — a click IS the visibility proof.
const step_cycle = (cycle, direction) => {
  if (!cycle.root.isConnected || cycle.rows.length <= 1) {
    schedule_cycle(cycle);
    return;
  }

  clear_timer(cycle);
  cycle.index =
    direction === "prev"
      ? previous_footer_index(cycle.index, cycle.rows.length)
      : next_footer_index(cycle.index, cycle.rows.length);
  const next_row = cycle.rows[cycle.index];
  transition_plain_content(cycle.root, next_row.html, () => {
    cycle.root.dataset.cycleAlign = next_row.align;
  });
  schedule_cycle(cycle);
};

const retire_cycle = (cycle) => {
  clear_timer(cycle);
  cycle.observer?.disconnect();
  visibility_cycles.delete(cycle);
};

const hydrate_footer_cycle = (root) => {
  if (!root) {
    return;
  }

  const footer = root.closest("#sol_footer");
  const phase = footer?.dataset.phase ?? "";
  const existing = active_cycles.get(root);

  // idiomorph can preserve this node across page swaps; a surviving cycle
  // from another phase is reading the wrong row table and must be rebuilt.
  if (existing) {
    if (existing.phase === phase) {
      return;
    }
    retire_cycle(existing);
  }

  const rows = resolve_footer_sentences(phase);
  if (rows.length <= 1) {
    active_cycles.delete(root);
    return;
  }

  const cycle = {
    root,
    rows,
    phase,
    index: 0,
    timer: null,
    visible: true,
    observer: null,
  };
  active_cycles.set(root, cycle);
  visibility_cycles.add(cycle);

  if (typeof IntersectionObserver === "function") {
    cycle.visible = false;
    cycle.observer = new IntersectionObserver(([entry]) => {
      cycle.visible = Boolean(entry?.isIntersecting);
      schedule_cycle(cycle);
    });
    cycle.observer.observe(footer || root);
  }
  schedule_cycle(cycle);
};

const boot = () => {
  document
    .querySelectorAll("[data-footer-cycle]")
    .forEach(hydrate_footer_cycle);
};

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
  document.addEventListener("htmx:afterSettle", boot);
  document.addEventListener("visibilitychange", () => {
    visibility_cycles.forEach(schedule_cycle);
  });
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-footer-cycle-step]");
    if (!button) {
      return;
    }

    const root = button
      .closest("#sol_footer")
      ?.querySelector("[data-footer-cycle]");
    const cycle = root ? active_cycles.get(root) : null;
    if (cycle) {
      step_cycle(cycle, button.dataset.footerCycleStep);
    }
  });
}

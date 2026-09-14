import { transition_pretext_content } from "scripts-of-folly/transitions";

const LAB_SELECTOR = "[data-sol-transition-lab]";
const TEXT_SELECTOR = "[data-sol-transition-lab-text]";
const SENTENCE_SELECTOR = "template[data-sol-transition-lab-sentence]";

// Lab state survives htmx morphs exactly as long as the lab node does;
// a replaced node starts back at sentence zero, which is fine for a sandbox.
const lab_state = new WeakMap();

const step_lab = async (lab, effect) => {
  const text_root = lab.querySelector(TEXT_SELECTOR);
  const sentences = Array.from(lab.querySelectorAll(SENTENCE_SELECTOR)).map(
    (template) => template.innerHTML.trim(),
  );

  if (!text_root || sentences.length === 0) {
    return;
  }

  const state = lab_state.get(lab) ?? { index: 0 };
  state.index = (state.index + 1) % sentences.length;
  lab_state.set(lab, state);

  await transition_pretext_content(text_root, sentences[state.index], {
    effect,
  });
};

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-sol-transition-lab-step]");

    if (!button) {
      return;
    }

    const lab = button.closest(LAB_SELECTOR);

    if (lab) {
      step_lab(lab, button.dataset.solTransitionLabStep);
    }
  });
}

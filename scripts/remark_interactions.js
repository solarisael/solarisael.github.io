import { transform_ix_markers_in_tree } from "scripts-of-folly/interaction-markdown";

const remark_interactions = () => {
  return (tree, file) => {
    const warning_cache = new Set();
    const warn =
      typeof file?.message === "function"
        ? (warning_message) => {
            file.message(warning_message);
          }
        : null;

    transform_ix_markers_in_tree(tree, {
      warn,
      warning_cache,
    });
  };
};

export { remark_interactions };

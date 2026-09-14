import {
  normalize_identity_token,
  parse_tag_identity,
  validate_scene_identity_consistency,
} from "../scene_identity.js";
const resolve_identity_value = ({
  field_label,
  field_value,
  tag_key,
  parsed_tag_identity,
}) => {
  const normalized_field_value = normalize_identity_token(field_value);
  const normalized_tag_value = normalize_identity_token(
    parsed_tag_identity[tag_key],
  );

  if (normalized_field_value && normalized_tag_value) {
    return normalized_field_value;
  }

  return normalized_field_value || normalized_tag_value;
};

const resolve_timeline_position = ({
  raw_position,
  chapter_id,
  scene_file,
}) => {
  const numeric_position = Number(raw_position);

  if (Number.isFinite(numeric_position)) {
    return numeric_position;
  }

  console.warn(
    `[rubedo-scenes] Missing timeline_position for ${chapter_id} in ${scene_file}. Using 0.`,
  );

  return 0;
};

const get_scene_component = (scene_module) => {
  if (typeof scene_module?.Content === "function") {
    return scene_module.Content;
  }

  if (typeof scene_module?.default === "function") {
    return scene_module.default;
  }

  return null;
};
const get_scene_raw_content = (scene_module) => {
  if (typeof scene_module?.rawContent === "function") {
    return scene_module.rawContent();
  }
  if (typeof scene_module?.rawContent === "string") {
    return scene_module.rawContent;
  }
  if (typeof scene_module?.body === "string") return scene_module.body;
  return "";
};
const warn_identity_errors = (scene_file, identity_validation) => {
  if (!identity_validation.has_phase_tag) {
    console.warn(
      `[rubedo-scenes] Skipping ${scene_file}. Missing tag phase:rubedo.`,
    );
  }

  if (identity_validation.missing_pairs.length > 0) {
    const missing_labels = identity_validation.missing_pairs
      .map((identity_pair) => {
        return `${identity_pair.field_label}<->${identity_pair.tag_key}`;
      })
      .join(", ");

    console.warn(
      `[rubedo-scenes] Skipping ${scene_file}. Missing duplicated identity fields/tags for: ${missing_labels}.`,
    );
  }

  if (identity_validation.mismatched_pairs.length > 0) {
    const mismatched_labels = identity_validation.mismatched_pairs
      .map((identity_pair) => {
        return `${identity_pair.field_label}<->${identity_pair.tag_key}`;
      })
      .join(", ");

    console.warn(
      `[rubedo-scenes] Skipping ${scene_file}. Identity mismatch for: ${mismatched_labels}.`,
    );
  }
};
const resolve_scene_identity = (frontmatter, parsed_tag_identity) => {
  const book_slug = resolve_identity_value({
    field_label: "book_slug",
    field_value: frontmatter.book_slug,
    tag_key: "book",
    parsed_tag_identity,
  });
  const chapter_id = resolve_identity_value({
    field_label: "chapter_id",
    field_value: frontmatter.chapter_id,
    tag_key: "chapter",
    parsed_tag_identity,
  });
  const thread_key = resolve_identity_value({
    field_label: "thread_key",
    field_value: frontmatter.thread_key,
    tag_key: "thread",
    parsed_tag_identity,
  });
  const thread_modifier = resolve_identity_value({
    field_label: "thread_modifier",
    field_value: frontmatter.thread_modifier,
    tag_key: "modifier",
    parsed_tag_identity,
  });
  return { book_slug, chapter_id, thread_key, thread_modifier };
};
const has_complete_identity = ({
  book_slug,
  chapter_id,
  thread_key,
  thread_modifier,
}) => {
  return book_slug && chapter_id && thread_key && thread_modifier;
};
const read_scene_record = (scene_file, scene_module) => {
  const frontmatter = scene_module?.frontmatter ?? {};
  const parsed_tag_identity = parse_tag_identity(frontmatter.tags ?? []);
  const identity_validation = validate_scene_identity_consistency({
    frontmatter,
    parsed_tag_identity,
  });
  if (!identity_validation.is_valid) {
    warn_identity_errors(scene_file, identity_validation);
    return null;
  }
  const identity = resolve_scene_identity(frontmatter, parsed_tag_identity);
  if (!has_complete_identity(identity)) {
    console.warn(
      `[rubedo-scenes] Skipping ${scene_file}. Missing identity fields/tags.`,
    );
    return null;
  }
  const timeline_position = resolve_timeline_position({
    raw_position: frontmatter.timeline_position,
    chapter_id: identity.chapter_id,
    scene_file,
  });
  return { ...identity, frontmatter, timeline_position, scene_module };
};
const build_scene = ({
  frontmatter,
  scene_module,
  chapter_id,
  thread_key,
  thread_modifier,
}) => ({
  thread_key,
  thread_modifier,
  scene_title: frontmatter.scene_title ?? `${chapter_id} ${thread_key}`,
  scene_excerpt: frontmatter.scene_excerpt ?? null,
  chapter_title_override: frontmatter.chapter_title_override ?? null,
  chapter_description_override:
    frontmatter.chapter_description_override ?? null,
  chapter_snippet_override: frontmatter.chapter_snippet_override ?? null,
  scene_component: get_scene_component(scene_module),
  // Keep source prose available to the publication catalog while timeline
  // serialization continues to omit it.
  scene_body: get_scene_raw_content(scene_module),
  scene_lines: [],
});
export { read_scene_record, build_scene };

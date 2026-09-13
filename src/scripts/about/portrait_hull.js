let alpha_rows = [];
let alpha_width = 0;
let alpha_height = 0;
let alpha_image = null;

export const read_alpha_hull = (image) => {
  if (alpha_image === image && alpha_rows.length > 0) return;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  alpha_image = image;
  alpha_width = canvas.width;
  alpha_height = canvas.height;
  alpha_rows = Array.from({ length: alpha_height }, (_, y) => {
    let left = alpha_width;
    let right = -1;
    for (let x = 0; x < alpha_width; x += 1) {
      if (pixels[(y * alpha_width + x) * 4 + 3] <= 12) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    return right >= left ? [left, right] : null;
  });
};

export const has_alpha_hull = () => alpha_rows.length > 0;

const blocked_interval = (root_rect, image_rect, line_top, line_height) => {
  const absolute_top = root_rect.top + line_top;
  const absolute_bottom = absolute_top + line_height;
  if (absolute_bottom <= image_rect.top || absolute_top >= image_rect.bottom) {
    return null;
  }

  const first_row = Math.max(
    0,
    Math.floor(
      ((absolute_top - image_rect.top) / image_rect.height) * alpha_height,
    ),
  );
  const last_row = Math.min(
    alpha_height - 1,
    Math.ceil(
      ((absolute_bottom - image_rect.top) / image_rect.height) * alpha_height,
    ),
  );
  let left = alpha_width;
  let right = -1;
  for (let row = first_row; row <= last_row; row += 1) {
    const interval = alpha_rows[row];
    if (!interval) continue;
    left = Math.min(left, interval[0]);
    right = Math.max(right, interval[1]);
  }
  if (right < left) return null;

  const image_left = image_rect.left - root_rect.left;
  return [
    image_left + (left / alpha_width) * image_rect.width - 12,
    image_left + ((right + 1) / alpha_width) * image_rect.width + 12,
  ];
};

export const slot_for_line = (side, root_rect, image_rect, y, line_height) => {
  const page_inset = 12;
  const blocked = blocked_interval(root_rect, image_rect, y, line_height);
  if (!blocked) {
    const center_gap = 24;
    const center = root_rect.width / 2;
    const left_edge = Math.max(page_inset, center - center_gap / 2);
    const right_edge = Math.min(
      root_rect.width - page_inset,
      center + center_gap / 2,
    );

    return side === "left"
      ? { left: page_inset, right: left_edge }
      : { left: right_edge, right: root_rect.width - page_inset };
  }

  return side === "left"
    ? {
        left: page_inset,
        right: Math.min(root_rect.width - page_inset, blocked[0]),
      }
    : {
        left: Math.max(page_inset, blocked[1]),
        right: root_rect.width - page_inset,
      };
};

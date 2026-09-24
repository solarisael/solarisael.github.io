const ATLAS_WIDTH = 512;
const MAX_ATLAS_HEIGHT = 4096;
const MAX_ORNAMENT_SIDE = 192;
const PADDING = 2;

const load_image = async (source) => {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(`Mantle ornament has no intrinsic size: ${source}`);
  }

  return image;
};

const measure_image = (image, source) => {
  const scale = Math.min(
    1,
    MAX_ORNAMENT_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
  );

  return {
    source,
    image,
    natural_width: image.naturalWidth,
    natural_height: image.naturalHeight,
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
    x: 0,
    y: 0,
  };
};

const place_images = (images) => {
  let x = PADDING;
  let y = PADDING;
  let row_height = 0;

  for (const image of images) {
    if (x + image.width + PADDING > ATLAS_WIDTH) {
      x = PADDING;
      y += row_height + PADDING * 2;
      row_height = 0;
    }

    image.x = x;
    image.y = y;
    x += image.width + PADDING * 2;
    row_height = Math.max(row_height, image.height);
  }

  const height = y + row_height + PADDING;
  if (height > MAX_ATLAS_HEIGHT) {
    throw new Error(
      `Mantle ornament atlas exceeds ${ATLAS_WIDTH} × ${MAX_ATLAS_HEIGHT}.`,
    );
  }

  return Math.max(1, height);
};

export const build_mantle_glow_atlas = async (sources) => {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("Mantle glow requires native OffscreenCanvas support.");
  }

  const unique_sources = Array.from(new Set(sources));
  const loaded = await Promise.all(unique_sources.map(load_image));
  const images = loaded.map((image, index) =>
    measure_image(image, unique_sources[index]),
  );
  const height = place_images(images);
  const canvas = new OffscreenCanvas(ATLAS_WIDTH, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Mantle glow could not create its atlas context.");
  }

  const entries = new Map();
  for (const image of images) {
    context.drawImage(image.image, image.x, image.y, image.width, image.height);
    entries.set(image.source, {
      uv: [
        image.x / ATLAS_WIDTH,
        image.y / height,
        (image.x + image.width) / ATLAS_WIDTH,
        (image.y + image.height) / height,
      ],
      width: image.natural_width,
      height: image.natural_height,
    });
  }

  return {
    width: ATLAS_WIDTH,
    height,
    pixels: context.getImageData(0, 0, ATLAS_WIDTH, height).data,
    entries,
  };
};

import mask_source from "../shaders/mantle_glow.wgsl";
import blur_source from "../shaders/mantle_glow_blur.wgsl";
import { resize_effect_surface } from "./gpu/render_size.js";
import { build_mantle_glow_atlas } from "./mantle_glow_atlas.js";
import { ACTOR_FLOATS, MAX_GLOWS } from "./mantle_glow_model.js";

const ACTOR_BUFFER_BYTES =
  MAX_GLOWS * ACTOR_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const PIXEL_BUDGET = 1048576;
const BLUR_RADIUS = 0.85;

export const create_mantle_glow_gpu = async (
  canvas,
  { sources, on_error, on_state },
) => {
  const [api, { StorageBuffer }, atlas] = await Promise.all([
    import("vgpu"),
    import("vgpu/core"),
    build_mantle_glow_atlas(sources),
  ]);
  let gpu = null;
  let surface = null;
  let mask_field = null;
  let horizontal_field = null;
  let mask_effect = null;
  let horizontal_effect = null;
  let vertical_effect = null;
  let actors = null;
  let ornament_texture = null;
  let remove_error = null;
  let disposed = false;
  let failure = null;

  const dispose = () => {
    if (disposed) return;

    disposed = true;
    remove_error?.();
    remove_error = null;
    actors?.dispose();
    actors = null;
    ornament_texture?.dispose();
    ornament_texture = null;
    mask_field?.dispose();
    mask_field = null;
    horizontal_field?.dispose();
    horizontal_field = null;
    surface?.dispose();
    surface = null;
    gpu?.dispose();
    gpu = null;
    mask_effect = null;
    horizontal_effect = null;
    vertical_effect = null;
  };

  const fail = (error) => {
    if (disposed || failure) return;

    failure = error;
    dispose();
    on_error(error);
  };

  try {
    on_state("initializing");
    gpu = await api.init();
    on_state("context");
    remove_error = gpu.onError(fail);
    gpu.gpu.lost.then(fail);
    surface = api.surface(gpu, canvas, {
      autoResize: false,
      size: [1, 1],
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
    });
    mask_field = api.target(gpu, {
      size: [1, 1],
      format: "rgba8unorm",
      label: "mantle-glow-mask",
    });
    horizontal_field = api.target(gpu, {
      size: [1, 1],
      format: "rgba8unorm",
      label: "mantle-glow-horizontal",
    });
    actors = new StorageBuffer(gpu.device, {
      size: ACTOR_BUFFER_BYTES,
      label: "mantle-glow-actors",
      visibility: GPUShaderStage.FRAGMENT,
    });
    actors.write(new Float32Array(MAX_GLOWS * ACTOR_FLOATS));
    ornament_texture = gpu.device.createTexture({
      size: [atlas.width, atlas.height],
      format: "rgba8unorm",
      usage: ["texture_binding", "copy_dst"],
      label: "mantle-glow-atlas",
    });
    gpu.gpu.queue.writeTexture(
      { texture: ornament_texture.gpu },
      atlas.pixels,
      { bytesPerRow: atlas.width * 4, rowsPerImage: atlas.height },
      { width: atlas.width, height: atlas.height },
    );

    const source_sampler = api.sampler(gpu, {
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    mask_effect = api.effect(gpu, mask_source, {
      label: "mantle-glow-mask",
      set: {
        frame: {
          resolution: [1, 1],
          count: 0,
          intensity: 1,
        },
        actors,
        ornament_atlas: ornament_texture,
        ornament_sampler: source_sampler,
      },
    });
    horizontal_effect = api.effect(gpu, blur_source, {
      label: "mantle-glow-horizontal",
      set: {
        blur: {
          direction: [1, 0],
          radius: BLUR_RADIUS,
          intensity: 1,
          colorize: 0,
        },
        source_texture: mask_field.color,
        source_sampler,
      },
    });
    vertical_effect = api.effect(gpu, blur_source, {
      label: "mantle-glow-vertical",
      set: {
        blur: {
          direction: [0, 1],
          radius: BLUR_RADIUS,
          intensity: 1,
          colorize: 1,
        },
        source_texture: horizontal_field.color,
        source_sampler,
      },
    });
    on_state("compiling");
    await Promise.all([
      mask_effect.compile(mask_field),
      horizontal_effect.compile(horizontal_field),
      vertical_effect.compile({
        colors: [navigator.gpu.getPreferredCanvasFormat()],
      }),
    ]);
    await gpu.settled();
    on_state("ready");

    if (failure) throw failure;

    return {
      atlas_entries: atlas.entries,
      render(frame, actor_data) {
        if (disposed) throw new Error("Mantle glow renderer is disposed.");

        const area = Math.max(frame.resolution[0] * frame.resolution[1], 1);
        const pixel_budget = Math.min(area, PIXEL_BUDGET);
        resize_effect_surface(surface, frame.resolution, pixel_budget);
        resize_effect_surface(mask_field, frame.resolution, pixel_budget);
        resize_effect_surface(horizontal_field, frame.resolution, pixel_budget);
        actors.write(actor_data);
        mask_effect.set({ frame });
        horizontal_effect.set({ source_texture: mask_field.color });
        vertical_effect.set({
          blur: {
            direction: [0, 1],
            radius: BLUR_RADIUS,
            intensity: frame.intensity,
            colorize: 1,
          },
          source_texture: horizontal_field.color,
        });
        api.frame(gpu, (current_frame) => {
          current_frame.pass(mask_field, mask_effect);
          current_frame.pass(horizontal_field, horizontal_effect);
          current_frame.pass(surface, vertical_effect);
        });
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
};

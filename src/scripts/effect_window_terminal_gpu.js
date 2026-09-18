import terminal_source from "../shaders/effect_window_terminal.wgsl";
import {
  RUNIC_GLYPHS,
  SYMBOL_GLYPHS,
  load_enchantment_fonts,
} from "./enchantment_glyphs.js";
import {
  effect_pixel_budget,
  resize_effect_surface,
} from "./gpu/render_size.js";
import { build_glyph_atlas } from "./lettering/atlas.js";

const terminal_glyph_requests = () => [
  ...RUNIC_GLYPHS.map((text, index) => ({
    key: `terminal-rune-${index}`,
    text,
    font: '18px "Solarisael Runic"',
    glowSmall: 1,
    glowWide: 3,
    outline: 0.5,
  })),
  ...SYMBOL_GLYPHS.map((text, index) => ({
    key: `terminal-symbol-${index}`,
    text,
    font: '18px "Solarisael Symbols"',
    glowSmall: 1,
    glowWide: 3,
    outline: 0.5,
  })),
];

export const create_terminal_window_gpu = async (
  canvas,
  { on_error, on_state },
) => {
  const [api, { StorageBuffer }] = await Promise.all([
    import("vgpu"),
    import("vgpu/core"),
    load_enchantment_fonts(),
  ]);
  const atlas = build_glyph_atlas(terminal_glyph_requests());
  let gpu = null;
  let surface = null;
  let shader = null;
  let entries = null;
  let glyph_texture = null;
  let remove_error = null;
  let disposed = false;
  let failure = null;

  const dispose = () => {
    if (disposed) return;

    disposed = true;
    remove_error?.();
    remove_error = null;
    entries?.dispose();
    entries = null;
    glyph_texture?.dispose();
    glyph_texture = null;
    surface?.dispose();
    surface = null;
    gpu?.dispose();
    gpu = null;
    shader = null;
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
    entries = new StorageBuffer(gpu.device, {
      size: atlas.data.byteLength,
      label: "terminal-rune-metrics",
      visibility: GPUShaderStage.FRAGMENT,
    });
    entries.write(atlas.data);
    glyph_texture = gpu.device.createTexture({
      size: [atlas.width, atlas.height],
      format: "rgba8unorm",
      usage: ["texture_binding", "copy_dst"],
      label: "terminal-rune-atlas",
    });
    gpu.gpu.queue.writeTexture(
      { texture: glyph_texture.gpu },
      atlas.pixels,
      { bytesPerRow: atlas.width * 4, rowsPerImage: atlas.height },
      { width: atlas.width, height: atlas.height },
    );
    on_state("surface");
    shader = api.effect(gpu, terminal_source, {
      label: "effect-window-terminal",
      set: {
        window: {
          resolution: [1, 1],
          time: 0,
          intensity: 1,
          motion: 1,
          scheme: 0,
          seed: 0,
          rune_count: atlas.entries.size,
          frame_inset: [16, 16],
          halo_radius: 12,
          frame_radius: 6,
        },
        entries,
        glyph_texture,
        glyph_sampler: api.sampler(gpu, {
          minFilter: "linear",
          magFilter: "linear",
        }),
      },
    });
    on_state("compiling");
    await shader.compile({
      colors: [navigator.gpu.getPreferredCanvasFormat()],
    });
    on_state("ready");

    if (failure) throw failure;

    return {
      rune_count: atlas.entries.size,
      render(values) {
        if (disposed) throw new Error("Terminal effect window is disposed.");

        resize_effect_surface(
          surface,
          values.resolution,
          effect_pixel_budget("ink", values.resolution),
        );
        shader.set({ window: values });
        api.frame(gpu, (frame) => frame.pass(surface, shader));
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
};

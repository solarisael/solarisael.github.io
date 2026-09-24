import lettering_source from "../../shaders/portal_lettering.wgsl";
import moth_source from "../../shaders/portal_moths.wgsl";
import { WATER_OPTICS } from "../water_optics.js";

const SURFACE = {
  dpr: [1, 1.25],
  alphaMode: "premultiplied",
  clearColor: [0, 0, 0, 0],
};

const make_resources = (api, StorageBuffer, gpu, sampler, scene, frames) => {
  const { text, flock } = scene;
  const resources = [];
  const buffer = (data, label) => {
    const value = new StorageBuffer(gpu.device, {
      size: data.byteLength,
      label,
      visibility: GPUShaderStage.VERTEX,
    });
    resources.push(value);
    value.write(data);
    return value;
  };
  const dispose = () => {
    for (const resource of resources) resource.dispose();
  };
  try {
    const actors = buffer(text.actor_data, "lettering-actors");
    const entries = buffer(text.atlas.data, "lettering-glyph-metrics");
    const words = buffer(text.word_data, "lettering-word-states");
    const moths = buffer(flock.data, "portal-moths");
    const { width, height, pixels } = text.atlas;
    const texture = gpu.device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: ["texture_binding", "copy_dst"],
      label: "lettering-glyph-atlas",
    });
    resources.push(texture);
    gpu.gpu.queue.writeTexture(
      { texture: texture.gpu },
      pixels,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height },
    );
    const letters = api.draw(gpu, {
      shader: lettering_source,
      label: "portal-lettering",
      vertices: 6,
      instances: text.count,
      blend: "premultiplied",
      depth: false,
      set: {
        frame: frames.frame,
        actors,
        entries,
        words,
        glyph_texture: texture,
        glyph_sampler: sampler,
      },
    });
    const flock_bindings = {
      scene: frames.scene,
      water: WATER_OPTICS,
      moths,
      entries,
      glyph_texture: texture,
      glyph_sampler: sampler,
    };
    const swarm = api.draw(gpu, {
      shader: moth_source,
      label: "portal-moths",
      vertices: 6,
      instances: flock.moth_count,
      blend: "premultiplied",
      depth: false,
      set: flock_bindings,
    });
    const rim = api.draw(gpu, {
      shader: moth_source,
      label: "portal-rim-motes",
      vertices: 6,
      firstInstance: flock.moth_count,
      instances: flock.mote_count,
      blend: "premultiplied",
      depth: false,
      set: flock_bindings,
    });
    return { letters, swarm, rim, dispose, actors, words };
  } catch (error) {
    dispose();
    throw error;
  }
};

// One device draws both canvases: moths beneath the menu text, rim motes and
// lettering above it. Every draw reads the same glyph atlas.
export const create_lettering_gpu = async (canvases, on_error) => {
  const [api, { StorageBuffer }] = await Promise.all([
    import("vgpu"),
    import("vgpu/core"),
  ]);
  const gpu = await api.init();
  let lettering_surface,
    moth_surface,
    sampler,
    current,
    disposed = false,
    failure = null;
  const fail = (error) => {
    if (disposed) return;
    failure = error;
    on_error(error);
  };
  const remove_error = gpu.onError(fail);
  gpu.gpu.lost.then(fail);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    remove_error();
    current?.dispose();
    lettering_surface?.dispose();
    moth_surface?.dispose();
    gpu.dispose();
  };
  try {
    lettering_surface = api.surface(gpu, canvases.lettering, SURFACE);
    moth_surface = api.surface(gpu, canvases.moths, SURFACE);
    sampler = api.sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  } catch (error) {
    dispose();
    throw error;
  }
  const uniforms = { frame: null };
  const scene_uniforms = { scene: null };
  const submit = (frame) => {
    frame.pass(moth_surface, current.swarm);
    frame.pass(lettering_surface, (pass) => {
      pass.draw(current.rim);
      pass.draw(current.letters);
    });
  };
  return {
    async prepare(scene, frames) {
      const next = make_resources(
        api,
        StorageBuffer,
        gpu,
        sampler,
        scene,
        frames,
      );
      try {
        const target = { colors: [navigator.gpu.getPreferredCanvasFormat()] };
        await Promise.all([
          next.letters.compile(target),
          next.swarm.compile(target),
          next.rim.compile(target),
        ]);
        await gpu.settled();
        if (failure) throw failure;
        if (disposed)
          throw new Error("Lettering GPU was disposed during preparation.");
      } catch (error) {
        next.dispose();
        throw error;
      }
      current?.dispose();
      current = next;
    },
    update_layout(model) {
      current.actors.write(model.actor_data);
    },
    update_words(model) {
      current.words.write(model.word_data);
    },
    render(frame, scene) {
      if (disposed || failure)
        throw new Error("The lettering GPU is unavailable.");
      uniforms.frame = frame;
      scene_uniforms.scene = scene;
      current.letters.set(uniforms);
      current.swarm.set(scene_uniforms);
      current.rim.set(scene_uniforms);
      api.frame(gpu, submit);
    },
    dispose,
  };
};

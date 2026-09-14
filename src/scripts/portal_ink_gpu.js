import ink_source from "../shaders/portal_ink.wgsl";
import ink_field_source from "../shaders/portal_ink_field.wgsl";
import {
  effect_pixel_budget,
  resize_effect_surface,
} from "./gpu/render_size.js";

export const create_ink_gpu = (canvas, values, lifecycle) => {
  let gpu = null,
    surface = null,
    field = null,
    field_shader = null,
    shader = null;
  let submit_frame = null;
  let pending = false;
  let remove_error_listener = null;

  const release = () => {
    remove_error_listener?.();
    remove_error_listener = null;
    surface?.dispose();
    surface = null;
    gpu?.dispose();
    gpu = null;
    shader = null;
    field = null;
    field_shader = null;
  };
  const device_lost = (info) => {
    if (!lifecycle.disposed() && !lifecycle.failed()) lifecycle.fail(info);
  };
  const setup = (api, context) => {
    gpu = context;
    remove_error_listener = gpu.onError(lifecycle.fail);
    gpu.gpu.lost.then(device_lost);
    surface = api.surface(gpu, canvas, {
      autoResize: true,
      dpr: 1,
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
    });

    field = api.target(gpu, {
      size: [1, 1],
      format: "rgba16float",
      label: "portal-ink-field",
    });

    field_shader = api.effect(gpu, ink_field_source, {
      label: "portal-ink-field",
      set: { ink: values },
    });

    shader = api.effect(gpu, ink_source, {
      label: "portal-ink",
      set: {
        ink: values,
        ink_field: field.color,
        field_sampler: api.sampler(gpu, {
          minFilter: "linear",
          magFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
        }),
      },
    });
  };
  const initialize = async () => {
    if (pending || gpu || lifecycle.failed() || lifecycle.disposed()) return;
    pending = true;
    lifecycle.loading();
    try {
      const api = await import("vgpu");
      if (lifecycle.disposed()) return;
      const context = await api.init();
      if (lifecycle.disposed()) {
        context.dispose();
        return;
      }
      setup(api, context);
      await Promise.all([
        field_shader.compile(field),
        shader.compile({
          colors: [navigator.gpu.getPreferredCanvasFormat()],
        }),
      ]);
      submit_frame = () =>
        api.frame(gpu, (current) => {
          current.pass(field, field_shader);
          current.pass(surface, shader);
        });
      if (lifecycle.disposed() || lifecycle.failed()) return;
      lifecycle.ready();
    } catch (error) {
      lifecycle.fail(error);
    } finally {
      pending = false;
    }
  };
  return {
    initialize,
    release,
    ready: () => Boolean(shader),
    submit() {
      resize_effect_surface(
        field,
        values.resolution,
        effect_pixel_budget("ink", values.resolution),
      );

      field_shader.set({ ink: values });
      shader.set({ ink: values, ink_field: field.color });
      submit_frame();
    },
  };
};

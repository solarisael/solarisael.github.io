import { WATER_OPTICS } from "./water_optics.js";
import {
  effect_pixel_budget,
  resize_effect_surface,
} from "./gpu/render_size.js";

export const create_obsidian_material = async (
  api,
  gpu,
  sources,
  format,
  ink,
) => {
  const field = api.target(gpu, {
    size: [1536, 1536],
    format: "rgba16float",
    label: "obsidian-fracture-field",
  });
  const fog = api.target(gpu, {
    size: [256, 256],
    format: "rgba16float",
    label: "obsidian-fog-density",
  });
  const fog_pass = api.effect(gpu, sources.fog, { label: "obsidian-fog-bake" });
  const sampler = api.sampler(gpu, {
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "linear",
  });
  const field_pass = api.effect(gpu, sources.field, {
    label: "obsidian-field-bake",
  });
  const make_diffusion = (size, spacing, label) => {
    const horizontal = api.target(gpu, {
      size: [size, size],
      format: "rgba16float",
      label: `${label}-x`,
    });
    const vertical = api.target(gpu, {
      size: [size, size],
      format: "rgba16float",
      label: `${label}-y`,
    });
    const horizontal_pass = api.effect(gpu, sources.diffusion, {
      label: `${label}-x`,
      set: {
        source_field: field.color,
        field_sampler: sampler,
        diffusion: { step: [spacing, 0] },
      },
    });
    const vertical_pass = api.effect(gpu, sources.diffusion, {
      label: `${label}-y`,
      set: {
        source_field: horizontal.color,
        field_sampler: sampler,
        diffusion: { step: [0, spacing] },
      },
    });
    return {
      texture: vertical.color,
      passes: [
        [horizontal, horizontal_pass],
        [vertical, vertical_pass],
      ],
    };
  };
  const diffuse = make_diffusion(384, 1 / 384, "obsidian-diffusion");
  const emission = make_diffusion(768, 1 / 1536, "obsidian-edge-emission");
  const plume = api.target(gpu, {
    size: [1, 1],
    format: "rgba16float",
    label: "obsidian-plume-boundary",
  });
  const plume_pass = api.effect(gpu, sources.ink, {
    label: "obsidian-plume-boundary",
    set: { ink },
  });
  const plume_sampler = api.sampler(gpu, {
    minFilter: "linear",
    magFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
  const material = api.effect(gpu, sources.glass, {
    label: "obsidian-glass-and-halo",
    set: {
      fracture_field: field.color,
      diffuse_field: diffuse.texture,
      emission_field: emission.texture,
      fog_field: fog.color,
      field_sampler: sampler,
      water: WATER_OPTICS,
      ink,
      plume_field: plume.color,
      plume_sampler,
      glass: {
        resolution: [1, 1],
        tablet_size: [1, 1],
        tablet_origin: [0, 0],
        field_offset: [0, 0],
        halo: 64,
        rim: 12,
        time: 0,
        depth_regions: Array.from({ length: 16 }, () => [0, 0, 0, 0]),
        depth_params: Array.from({ length: 16 }, () => [0, 0, 0, 0]),
        depth_count: 0,
        sdr: 1,
        scheme: 0,
        button_regions: Array.from({ length: 16 }, () => [0, 0, 0, 0]),
        button_bounds: [0, 0, 0, 0],
        button_count: 0,
      },
    },
  });
  const passes = [
    [field, field_pass],
    [fog, fog_pass],
    ...diffuse.passes,
    ...emission.passes,
  ];
  await Promise.all([
    ...passes.map(([target, pass]) => pass.compile(target)),
    plume_pass.compile(plume),
    material.compile({ colors: [format] }),
  ]);
  api.frame(gpu, (frame) => {
    for (const [target, pass] of passes) frame.pass(target, pass);
  });
  const uniforms = { glass: null, ink, plume_field: plume.color };
  const plume_uniforms = { ink };
  let destination;
  const submit = (frame) => {
    frame.pass(plume, plume_pass);
    frame.pass(destination, material);
  };
  return {
    render(target, values) {
      resize_effect_surface(
        plume,
        ink.resolution,
        effect_pixel_budget("ink", ink.resolution),
      );
      plume_pass.set(plume_uniforms);
      uniforms.plume_field = plume.color;
      destination = target;
      uniforms.glass = values;
      material.set(uniforms);
      api.frame(gpu, submit);
    },
  };
};

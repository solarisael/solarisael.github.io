import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { create_obsidian_runtime } from "../src/scripts/obsidian_runtime.js";

if (!globalThis.window)
  GlobalRegistrator.register({ url: "https://solarisael.local/" });

let menu, owner, canvas, controller, frames, next_id, motion, spies;
let attributes, resize, originals, hidden_descriptor, surface_size, tablet_size;
let backend, renders, references, load_gpu, deferred, on_error;

const advance = (time) => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(time));
};
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const change_menu = (open, phase = "artifact") => {
  menu.dataset.sideMenuOpen = String(open);
  menu.dataset.portalPhase = phase;
  attributes.callback([
    { type: "attributes", target: menu, attributeName: "data-side-menu-open" },
    { type: "attributes", target: menu, attributeName: "data-portal-phase" },
  ]);
};
const visibility = (hidden) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};
const reduced_motion = (matches) => {
  motion.matches = matches;
  motion.dispatchEvent(new Event("change"));
};
const start = () => {
  controller = create_obsidian_runtime({ owner, menu, canvas, load_gpu });
};
const open_ready = async () => {
  change_menu(true);
  deferred.resolve(backend);
  await settle();
};

beforeEach(() => {
  frames = new Map();
  next_id = 0;
  renders = [];
  references = [];
  spies = [];
  controller = null;
  on_error = null;
  attributes = null;
  resize = null;
  hidden_descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  originals = new Map(
    ["MutationObserver", "ResizeObserver"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.disconnect = mock(() => {});
      this.observe = mock(() => {});
      attributes = this;
    }
  };
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.disconnect = mock(() => {});
      this.observe = mock(() => {});
      resize = this;
    }
  };
  motion = new EventTarget();
  motion.matches = false;
  spies.push(
    spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        frames.set(++next_id, callback);
        return next_id;
      },
    ),
    spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) =>
      frames.delete(id),
    ),
    spyOn(globalThis, "matchMedia").mockReturnValue(motion),
  );
  menu = document.createElement("div");
  owner = document.createElement("div");
  canvas = document.createElement("canvas");
  owner.style.setProperty("--obsidian-rim-width", "3.5px");
  owner.style.setProperty("--obsidian-halo", "20px");
  menu.dataset.sideMenuOpen = "false";
  menu.dataset.portalPhase = "closed";
  menu.append(canvas, owner);
  document.body.append(menu);
  surface_size = { left: 0, top: 0, width: 340, height: 240 };
  tablet_size = { left: 20, top: 20, width: 300, height: 200 };
  spies.push(
    spyOn(canvas, "getBoundingClientRect").mockImplementation(
      () => surface_size,
    ),
    spyOn(owner, "getBoundingClientRect").mockImplementation(() => tablet_size),
  );
  backend = {
    render: mock((values) => {
      references.push({
        resolution: values.resolution,
        tablet_size: values.tablet_size,
        tablet_origin: values.tablet_origin,
        field_offset: values.field_offset,
      });
      renders.push({
        ...values,
        resolution: [...values.resolution],
        tablet_size: [...values.tablet_size],
        tablet_origin: [...values.tablet_origin],
        field_offset: [...values.field_offset],
      });
    }),
    dispose: mock(() => {}),
  };
  deferred = Promise.withResolvers();
  load_gpu = mock((_canvas, options) => {
    on_error = options.on_error;
    return deferred.promise;
  });
});

afterEach(() => {
  controller?.dispose();
  menu.remove();
  spies.forEach((spy) => spy.mockRestore());
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  if (hidden_descriptor)
    Object.defineProperty(document, "hidden", hidden_descriptor);
  else delete document.hidden;
});

test("GPU initialization waits for a connected, visible, open artifact", async () => {
  start();
  advance(0);
  expect(load_gpu).not.toHaveBeenCalled();
  change_menu(true, "ink");
  expect(load_gpu).not.toHaveBeenCalled();
  visibility(true);
  change_menu(true);
  expect(load_gpu).not.toHaveBeenCalled();
  owner.remove();
  visibility(false);
  expect(load_gpu).not.toHaveBeenCalled();
  menu.append(owner);
  change_menu(true);
  expect(load_gpu).toHaveBeenCalledTimes(1);
  expect(load_gpu.mock.calls[0][0]).toBe(canvas);
  expect(typeof load_gpu.mock.calls[0][1].on_error).toBe("function");
  expect(owner.dataset.obsidianRenderer).toBe("loading");
  deferred.resolve(backend);
  await settle();
  expect(renders).toEqual([]);
  expect(owner.dataset.obsidianRenderer).toBe("loading");
  advance(0);
  expect(renders).toEqual([
    {
      resolution: [340, 240],
      tablet_size: [300, 200],
      tablet_origin: [20, 20],
      field_offset: [expect.any(Number), expect.any(Number)],
      halo: 20,
      rim: 3.5,
      time: 0,
    },
  ]);
  expect(owner.dataset.obsidianRenderer).toBe("webgpu");
});

test("closed, non-artifact and hidden states cancel work and resume without elapsed jumps", async () => {
  start();
  await open_ready();
  advance(0);
  advance(40);
  expect(renders.at(-1).time).toBe(0.04);
  change_menu(false);
  expect(frames.size).toBe(0);
  advance(10000);
  expect(renders).toHaveLength(2);
  change_menu(true);
  advance(10000);
  expect(renders.at(-1).time).toBe(0.04);
  visibility(true);
  expect(frames.size).toBe(0);
  advance(20000);
  expect(renders).toHaveLength(3);
  visibility(false);
  advance(20000);
  expect(renders.at(-1).time).toBe(0.04);
  advance(20040);
  expect(renders.at(-1).time).toBe(0.08);
  change_menu(true, "closing");
  expect(frames.size).toBe(0);
  advance(30000);
  expect(renders).toHaveLength(5);
  expect(load_gpu).toHaveBeenCalledTimes(1);
});

test("each opening chooses a fresh patch without reshuffling on close, resize or visibility", async () => {
  const random = spyOn(Math, "random")
    .mockReturnValueOnce(0.13)
    .mockReturnValueOnce(0.71)
    .mockReturnValueOnce(0.82)
    .mockReturnValueOnce(0.29);
  spies.push(random);
  start();
  expect(random).not.toHaveBeenCalled();
  change_menu(true, "ink");
  expect(random).toHaveBeenCalledTimes(2);
  await open_ready();
  advance(0);
  expect(renders.at(-1).field_offset).toEqual([0.13, 0.71]);
  resize.callback([]);
  advance(40);
  visibility(true);
  visibility(false);
  advance(80);
  change_menu(true);
  advance(120);
  expect(random).toHaveBeenCalledTimes(2);
  expect(
    renders.every(
      ({ field_offset }) =>
        field_offset[0] === 0.13 && field_offset[1] === 0.71,
    ),
  ).toBe(true);
  change_menu(false, "closing");
  expect(random).toHaveBeenCalledTimes(2);
  change_menu(true);
  advance(160);
  expect(random).toHaveBeenCalledTimes(4);
  expect(renders.at(-1).field_offset).toEqual([0.82, 0.29]);
  expect(load_gpu).toHaveBeenCalledTimes(1);
});

test("reduced motion keeps one static patch per opening", async () => {
  const random = spyOn(Math, "random")
    .mockReturnValueOnce(0.2)
    .mockReturnValueOnce(0.4)
    .mockReturnValueOnce(0.6)
    .mockReturnValueOnce(0.8);
  spies.push(random);
  motion.matches = true;
  start();
  await open_ready();
  advance(0);
  resize.callback([]);
  advance(50);
  expect(renders.at(-1).field_offset).toEqual([0.2, 0.4]);
  expect(frames.size).toBe(0);
  change_menu(false);
  change_menu(true);
  advance(100);
  expect(renders.at(-1).field_offset).toEqual([0.6, 0.8]);
  expect(renders.every(({ time }) => time === 0)).toBe(true);
  expect(frames.size).toBe(0);
});

test("reduced motion draws one zero-time frame, then sleeps until resize or media change", async () => {
  motion.matches = true;
  start();
  await open_ready();
  advance(500);
  expect(renders.map(({ time }) => time)).toEqual([0]);
  expect(frames.size).toBe(0);
  advance(2000);
  expect(renders).toHaveLength(1);
  surface_size = { left: 0, top: 0, width: 440, height: 340 };
  tablet_size = { left: 15, top: 35, width: 380, height: 280 };
  owner.style.setProperty("--obsidian-rim-width", "5px");
  resize.callback([{ target: owner }, { target: canvas }]);
  advance(2000);
  expect(renders.at(-1)).toEqual({
    resolution: [440, 340],
    tablet_size: [380, 280],
    tablet_origin: [15, 35],
    field_offset: renders[0].field_offset,
    halo: 20,
    rim: 5,
    time: 0,
  });
  expect(frames.size).toBe(0);
  expect(references[1].resolution).toBe(references[0].resolution);
  reduced_motion(false);
  advance(3000);
  advance(3040);
  expect(renders.at(-1).time).toBe(0.04);
  reduced_motion(true);
  advance(3050);
  expect(renders.at(-1).time).toBe(0);
  expect(frames.size).toBe(0);
});

test("resize invalidates geometry once and activation refreshes closed layout changes", async () => {
  start();
  await open_ready();
  advance(0);
  surface_size = { left: 0, top: 0, width: 540, height: 340 };
  tablet_size = { left: 10, top: 30, width: 500, height: 300 };
  advance(40);
  expect(renders.at(-1).resolution).toEqual([340, 240]);
  resize.callback([{ target: canvas }]);
  advance(80);
  advance(120);
  expect(renders.at(-1).resolution).toEqual([540, 340]);
  expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(2);
  change_menu(false);
  surface_size = { left: 0, top: 0, width: 640, height: 440 };
  change_menu(true);
  advance(4000);
  expect(renders.at(-1).resolution).toEqual([640, 440]);
  expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(3);
});

test("initialization settling after close retains the backend without rendering until reopen", async () => {
  start();
  change_menu(true);
  change_menu(false);
  deferred.resolve(backend);
  await settle();
  advance(1000);
  expect(renders).toEqual([]);
  expect(frames.size).toBe(0);
  expect(backend.dispose).not.toHaveBeenCalled();
  expect(owner.dataset.obsidianRenderer).toBe("loading");
  change_menu(true);
  advance(2000);
  expect(renders).toHaveLength(1);
  expect(renders[0].time).toBe(0);
  expect(load_gpu).toHaveBeenCalledTimes(1);
});

test("disposal during initialization releases the late backend exactly once", async () => {
  start();
  change_menu(true);
  controller.dispose();
  controller.dispose();
  deferred.resolve(backend);
  await settle();
  on_error(new Error("late loss"));
  advance(1000);
  expect(backend.dispose).toHaveBeenCalledTimes(1);
  expect(renders).toEqual([]);
  expect(frames.size).toBe(0);
  expect(owner.dataset.obsidianRenderer).toBe("static");
});

test("stale cancelled callbacks cannot render after reopen or disposal", async () => {
  start();
  await open_ready();
  const stale_open = [...frames.values()][0];
  change_menu(false);
  change_menu(true);
  stale_open(0);
  expect(renders).toEqual([]);
  advance(1000);
  expect(renders).toHaveLength(1);
  const stale_disposed = [...frames.values()][0];
  controller.dispose();
  stale_disposed(2000);
  attributes.callback([]);
  resize.callback([{ target: canvas }]);
  reduced_motion(true);
  visibility(false);
  expect(renders).toHaveLength(1);
  expect(frames.size).toBe(0);
  expect(backend.dispose).toHaveBeenCalledTimes(1);
});

test("render failure switches to static, releases resources and never retries", async () => {
  backend.render.mockImplementation(() => {
    throw new Error("submission failed");
  });
  start();
  await open_ready();
  advance(0);
  expect(owner.dataset.obsidianRenderer).toBe("static");
  expect(backend.dispose).toHaveBeenCalledTimes(1);
  change_menu(false);
  change_menu(true);
  resize.callback([{ target: owner }]);
  reduced_motion(true);
  visibility(false);
  advance(1000);
  expect(load_gpu).toHaveBeenCalledTimes(1);
  expect(backend.render).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  controller.dispose();
  expect(backend.dispose).toHaveBeenCalledTimes(1);
});

test("initialization rejection stays static across later activations", async () => {
  start();
  change_menu(true);
  deferred.reject(new Error("adapter unavailable"));
  await settle();
  change_menu(false);
  change_menu(true);
  advance(1000);
  expect(owner.dataset.obsidianRenderer).toBe("static");
  expect(load_gpu).toHaveBeenCalledTimes(1);
  expect(renders).toEqual([]);
  expect(frames.size).toBe(0);
});

test("device failure during loading disposes its eventual backend without rendering", async () => {
  start();
  change_menu(true);
  on_error(new Error("device lost"));
  deferred.resolve(backend);
  await settle();
  change_menu(false);
  change_menu(true);
  advance(1000);
  expect(owner.dataset.obsidianRenderer).toBe("static");
  expect(backend.dispose).toHaveBeenCalledTimes(1);
  expect(load_gpu).toHaveBeenCalledTimes(1);
  expect(renders).toEqual([]);
});

test("device callback failure cannot be overwritten by an in-progress successful render", async () => {
  backend.render.mockImplementation(() => on_error(new Error("device lost")));
  start();
  await open_ready();
  advance(0);
  expect(owner.dataset.obsidianRenderer).toBe("static");
  expect(backend.dispose).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  controller.dispose();
  expect(backend.dispose).toHaveBeenCalledTimes(1);
});

test("idempotent disposal disconnects observers and removes registered listeners", async () => {
  start();
  await open_ready();
  advance(0);
  const remove_motion = spyOn(motion, "removeEventListener");
  const remove_visibility = spyOn(document, "removeEventListener");
  spies.push(remove_motion, remove_visibility);
  controller.dispose();
  controller.dispose();
  expect(attributes.disconnect).toHaveBeenCalledTimes(1);
  expect(resize.disconnect).toHaveBeenCalledTimes(1);
  expect(remove_motion.mock.calls.some(([name]) => name === "change")).toBe(
    true,
  );
  expect(
    remove_visibility.mock.calls.some(([name]) => name === "visibilitychange"),
  ).toBe(true);
  expect(backend.dispose).toHaveBeenCalledTimes(1);
  expect(owner.dataset.obsidianRenderer).toBe("static");
  reduced_motion(true);
  visibility(false);
  change_menu(true);
  advance(1000);
  expect(renders).toHaveLength(1);
  expect(frames.size).toBe(0);
});

test("full canvas coverage preserves local reach and tracks an off-center tablet", async () => {
  const previous_font = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = "20px";
  owner.style.setProperty("--obsidian-halo", "4rem");
  surface_size = { left: 5, top: 10, width: 1280, height: 720 };
  tablet_size = { left: 185, top: 110, width: 800, height: 500 };
  try {
    start();
    await open_ready();
    advance(0);
    expect(renders.at(-1).resolution).toEqual([1280, 720]);
    expect(renders.at(-1).tablet_origin).toEqual([180, 100]);
    expect(renders.at(-1).halo).toBe(80);
    surface_size = { ...surface_size, width: 1920, height: 1080 };
    tablet_size = { ...tablet_size, left: 205, top: 130 };
    resize.callback([{ target: canvas }]);
    advance(40);
    expect(renders.at(-1).resolution).toEqual([1920, 1080]);
    expect(renders.at(-1).tablet_origin).toEqual([200, 120]);
    expect(renders.at(-1).halo).toBe(80);
  } finally {
    document.documentElement.style.fontSize = previous_font;
  }
});

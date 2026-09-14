import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const PORT = 4322;
const HOST = "127.0.0.1";
const BASE_PATH = "/";
const TMP_ROOT =
  process.env.OPENCODE_TMP ?? "C:/Users/ADMINI~1/AppData/Local/Temp/opencode";
const STATE_DIR = path.join(TMP_ROOT, "solarisael-dev-server");
const PID_FILE = path.join(STATE_DIR, "server.pid");
const OUT_LOG = path.join(STATE_DIR, "server.out.log");
const ERR_LOG = path.join(STATE_DIR, "server.err.log");
const LAUNCHER = path.join(STATE_DIR, "launch.cmd");
const TASK_NAME = "SolarisaelDevServer";
const URL = `http://${HOST}:${PORT}${BASE_PATH}`;
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

const action = process.argv[2] ?? "status";

if (action === "start") start();
else if (action === "wait") await wait();
else if (action === "stop") stop();
else if (action === "status") await status();
else if (action === "check") await check();
else fail("usage: bun scripts/dev_server.js start|wait|stop|status|check");

function start() {
  mkdirSync(STATE_DIR, { recursive: true });

  const pid = port_owner_pid();
  if (pid) {
    console.log(`already running pid=${pid}`);
    console.log(`url=${URL}`);
    return;
  }

  rm_file(PID_FILE);
  writeFileSync(
    LAUNCHER,
    [
      "@echo off",
      `cd /d "${PROJECT_ROOT}"`,
      `bun x astro dev --host ${HOST} --port ${PORT} --strictPort >> "${OUT_LOG}" 2>> "${ERR_LOG}"`,
    ].join("\r\n"),
    "utf8",
  );

  delete_task();
  const start_time = new Date(Date.now() + 60_000).toTimeString().slice(0, 5);
  run_checked("schtasks", [
    "/Create",
    "/TN",
    TASK_NAME,
    "/SC",
    "ONCE",
    "/ST",
    start_time,
    "/TR",
    LAUNCHER,
    "/F",
  ]);
  run_checked("schtasks", ["/Run", "/TN", TASK_NAME]);

  console.log(`started task=${TASK_NAME}`);
  console.log(`url=${URL}`);
  console.log(`log=${OUT_LOG}`);
  console.log(`err=${ERR_LOG}`);
  console.log("wait=bun run dev:wait");
  console.log("stop=bun run dev:stop");
}

async function wait() {
  await wait_for_health();
  console.log(`healthy url=${URL}`);
}

function stop() {
  const pid = port_owner_pid() ?? read_pid();
  if (!pid) {
    delete_task();
    console.log("not running");
    return;
  }

  if (is_running(pid)) {
    process.kill(pid);
    console.log(`stopped pid=${pid}`);
  } else {
    console.log(`stale pid=${pid}`);
  }
  rm_file(PID_FILE);
  delete_task();
}

async function status() {
  const pid = port_owner_pid() ?? read_pid();
  const running = Boolean(pid && is_running(pid));
  const healthy = running ? await is_healthy() : false;
  console.log(
    JSON.stringify(
      { running, healthy, pid, url: URL, log: OUT_LOG, err: ERR_LOG },
      null,
      2,
    ),
  );
}

async function check() {
  stop_if_running();
  const started_at = performance.now();
  start();
  const start_ms = Math.round(performance.now() - started_at);
  if (start_ms > 2_000) fail(`dev:start too slow: ${start_ms}ms`);

  await wait_for_health();
  const pid = read_pid();
  const running = Boolean(pid && is_running(pid));
  const healthy = await is_healthy();
  stop();
  await wait_for_port_free();

  console.log(
    JSON.stringify({ start_ms, running, healthy, port_free: true }, null, 2),
  );
}

async function wait_for_health() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await is_healthy()) return;
    await Bun.sleep(250);
  }
  fail(`server did not become healthy: ${URL}`);
}

async function wait_for_port_free() {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!(await is_port_open())) return;
    await Bun.sleep(150);
  }
  fail(`port did not become free: ${PORT}`);
}

async function is_port_open() {
  try {
    const socket = await Bun.connect({ hostname: HOST, port: PORT });
    socket.end();
    return true;
  } catch {
    return false;
  }
}

function stop_if_running() {
  const pid = port_owner_pid() ?? read_pid();
  if (pid && is_running(pid)) stop();
}

function port_owner_pid() {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `$c=Get-NetTCPConnection -LocalAddress ${HOST} -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue; if ($c) { $c.OwningProcess }`,
    ],
    { encoding: "utf8" },
  );
  const pid = Number(result.stdout.trim().split(/\s+/)[0]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function delete_task() {
  spawnSync("schtasks", ["/Delete", "/TN", TASK_NAME, "/F"], {
    encoding: "utf8",
  });
}

function run_checked(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
}

async function is_healthy() {
  try {
    const response = await fetch(URL);
    return response.ok;
  } catch {
    return false;
  }
}

function read_pid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function is_running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function rm_file(file) {
  try {
    rmSync(file);
  } catch {}
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

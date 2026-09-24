// Runs every Bend proof gate under laws/. A law that is open or false fails
// this script, and the Validation Baseline workflow runs it before the build,
// so a broken law blocks the Pages deploy the same way a failing test does.
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const laws_root = "laws";

// enough: Bend ships no Windows binary. On Windows we call the WSL install;
// elsewhere we use PATH or the default ~/.bend/bin. Set BEND to override.
const bend_command = () => {
  if (process.env.BEND) {
    return [process.env.BEND];
  }
  if (process.platform === "win32") {
    return ["wsl", "-e", "sh", "-lc", 'cd "$0" && ~/.bend/bin/bend PROOF.bend'];
  }
  const home_bend = join(homedir(), ".bend", "bin", "bend");
  return [Bun.which("bend") ?? home_bend];
};

const proof_dirs = () =>
  readdirSync(laws_root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(laws_root, entry.name))
    .filter((dir) => existsSync(join(dir, "PROOF.bend")));

const to_wsl_path = (windows_path) =>
  "/mnt/" +
  windows_path[0].toLowerCase() +
  windows_path.slice(2).replaceAll("\\", "/");

const run_gate = async (dir) => {
  const command = bend_command();
  const proc =
    process.platform === "win32" && !process.env.BEND
      ? Bun.spawn([...command, to_wsl_path(join(process.cwd(), dir))], {
          stdout: "pipe",
          stderr: "pipe",
        })
      : Bun.spawn([...command, "PROOF.bend"], {
          cwd: dir,
          stdout: "pipe",
          stderr: "pipe",
        });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exit_code = await proc.exited;
  const passed = exit_code === 0 && stdout.includes("All terms check.");
  console.log(`${passed ? "ok  " : "FAIL"} ${dir}`);
  if (!passed) {
    console.log((stdout + stderr).trim());
  }
  return passed;
};

const dirs = proof_dirs();
if (dirs.length === 0) {
  console.log(`no PROOF.bend under ${laws_root}/; nothing to check`);
  process.exit(0);
}

const results = [];
for (const dir of dirs) {
  results.push(await run_gate(dir));
}
process.exit(results.every(Boolean) ? 0 : 1);

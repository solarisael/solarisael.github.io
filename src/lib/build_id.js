import { execSync } from "node:child_process";

// One id per build. The layout writes it into <head> and onto the route shell,
// and src/scripts/build_guard.js reloads the page when the two disagree.
// Evaluated once per build process, so every page of one build shares it.
const read_git_short_sha = () => {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    console.warn(
      `[build_id] git is unavailable, using a timestamp id: ${error.message}`,
    );
    return "";
  }
};

// enough: the short SHA does not change for uncommitted edits, so two local
// builds of a dirty tree share an id. Deploys build from a clean checkout; add
// a dirty-tree suffix if local builds ever go live.
// enough: Date.now() is unique per build but never matches a rebuild of the
// same commit, so a git-less deploy reloads every open tab once.
const build_id = read_git_short_sha() || String(Date.now());

export { build_id };

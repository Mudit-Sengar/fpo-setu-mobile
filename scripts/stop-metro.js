#!/usr/bin/env node
/**
 * Stops the Metro dev server started by scripts/ensure-metro.js (or `npm start`)
 * and any child processes it spawned (Metro's transform workers show up as
 * separate node.exe processes on Windows).
 *
 * `npm run android` never leaves a foreground terminal attached to Metro — it
 * runs detached in the background (see ensure-metro.js) so there's nothing to
 * Ctrl+C. This is the explicit way to shut it down instead of hunting for
 * node.exe processes in Task Manager.
 */
const { execSync } = require("child_process");

const PORT = 8081;

function findWindowsPids(port) {
  let out;
  try {
    out = execSync(`netstat -ano -p TCP`, { encoding: "utf8" });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
    if (m && Number(m[1]) === port) pids.add(m[2]);
  }
  return [...pids];
}

function findPosixPids(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const isWindows = process.platform === "win32";
  const pids = isWindows ? findWindowsPids(PORT) : findPosixPids(PORT);

  if (pids.length === 0) {
    console.log(`[stop-metro] Nothing is listening on port ${PORT} — already stopped.`);
    return;
  }

  for (const pid of pids) {
    try {
      if (isWindows) {
        // /T also kills the process tree, so Metro's jest-worker children
        // (separate node.exe processes) don't get orphaned.
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: "ignore" });
      } else {
        process.kill(Number(pid), "SIGKILL");
      }
      console.log(`[stop-metro] Stopped process ${pid} (was listening on ${PORT}).`);
    } catch (err) {
      console.error(`[stop-metro] Could not stop process ${pid}: ${err.message}`);
    }
  }
}

main();

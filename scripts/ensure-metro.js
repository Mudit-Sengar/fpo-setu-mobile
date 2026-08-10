#!/usr/bin/env node
/**
 * Ensures the Metro dev server is running and reachable before a debug build
 * gets installed and launched.
 *
 * WHY THIS EXISTS
 * ----------------
 * A debug APK has no embedded JS bundle (see the `react { }` block in
 * android/app/build.gradle) — it loads the bundle from Metro at runtime.
 * Launching one while Metro is down throws, on the very first frame:
 *
 *   java.lang.RuntimeException: Unable to load script.
 *   Make sure you're running Metro or that your bundle 'index.android.bundle'
 *   is packaged correctly for release.
 *
 * `npm run android` (react-native run-android) already starts Metro itself,
 * so that path is safe. Android Studio's own ▶ Run button does NOT start
 * Metro — it just assembles, installs and launches — so the failure above
 * has recurred every time the app was launched that way after Metro had
 * died (terminal closed, machine restarted, etc). This script is wired in
 * as a dependency of the debug variant's preBuild task, so it runs
 * automatically no matter which of those paths triggered the build.
 *
 * FAST PATH
 * ---------
 * If Metro is already up (the normal case once `npm start` is running in a
 * terminal), this is a single HTTP request and returns in well under a
 * second — it does not slow down the everyday inner loop.
 */
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = 8081;
const HOST = "127.0.0.1";
const READY_BODY = "packager-status:running";
const START_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 750;

const repoRoot = path.resolve(__dirname, "..");
const logFile = path.join(repoRoot, ".metro-autostart.log");

function checkStatus() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: HOST, port: PORT, path: "/status", timeout: 2000 },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve(res.statusCode === 200 && body.includes(READY_BODY)));
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

/** Distinguishes "Metro is starting up" from "something else has the port". */
function checkPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port: PORT, timeout: 1500 });
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
  });
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

function startMetro() {
  const out = fs.openSync(logFile, "a");
  fs.writeSync(out, `\n--- ensure-metro.js starting Metro at ${new Date().toISOString()} ---\n`);
  // Spawn `node` directly against react-native's cli.js entry point — not the
  // node_modules/.bin/react-native(.cmd) shim, and not `npm start`. Both of
  // those add a shell/.cmd/npm hop on Windows that was silently swallowing
  // Metro's stdout before it reached this log file. cli.js itself just
  // require()s @react-native-community/cli and calls it in-process (no further
  // spawning), so this is a single real-executable hop with no shell involved
  // — safe with detached:true (that combination throws EINVAL for .cmd/.bat
  // targets specifically, which is why the shim-spawning attempts needed
  // shell:true in the first place).
  const cliEntry = path.join(repoRoot, "node_modules", "react-native", "cli.js");
  const child = spawn(process.execPath, [cliEntry, "start"], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  child.unref();
}

async function main() {
  if (await checkStatus()) {
    process.exit(0); // Already running — the steady-state case.
  }

  if (await checkPortOpen()) {
    console.error(
      `[ensure-metro] Something is listening on ${HOST}:${PORT} but it isn't Metro ` +
      `(no packager-status:running response). Free the port or stop the other ` +
      `process, then rebuild. Check ${logFile} for anything it logged.`,
    );
    process.exit(1);
  }

  console.log("[ensure-metro] Metro isn't running - starting it now ('npm start')...");
  startMetro();

  const ready = await waitFor(checkStatus, START_TIMEOUT_MS);
  if (!ready) {
    console.error(
      `[ensure-metro] Metro did not become ready within ${START_TIMEOUT_MS / 1000}s. ` +
      `Check ${logFile} for what it printed, or start it manually with 'npm start' ` +
      `in its own terminal and rebuild.`,
    );
    process.exit(1);
  }

  console.log("[ensure-metro] Metro is up.");
  process.exit(0);
}

main();

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 */
const config = {
  transformer: {
    // Metro's transform worker pool defaults to child_process.fork() (jest-worker's
    // ChildProcessWorker), and neither jest-worker nor Metro passes windowsHide to
    // that fork() call. On Windows, an un-hidden forked child gets its own console —
    // on a machine with Windows Terminal set as the default terminal app, each of
    // those (one per CPU core, so ~8 on a typical dev machine) surfaces as a new
    // visible terminal window every time Metro starts. worker_threads run inside
    // the existing process instead of forking a new one, so there's no console to
    // create — same transform parallelism, zero windows. See jest-worker's
    // NodeThreadsWorker vs ChildProcessWorker.
    unstable_workerThreads: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

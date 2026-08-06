const { defineConfig } = require('eslint/config');
const reactNativeConfig = require('@react-native/eslint-config/flat');

// The upstream config's Flow-syntax block for plain .js files (eslint-plugin-ft-flow)
// crashes under this ESLint version (context.getAllComments was removed) and this
// project never uses Flow anyway — drop that one entry, keep everything else.
const withoutFlow = reactNativeConfig.filter((cfg) => !cfg.plugins || !('ft-flow' in cfg.plugins));

module.exports = defineConfig([
  ...withoutFlow,
  {
    ignores: ['dist/*', 'android/*'],
  },
]);

// babel-preset-expo wires up the react-native-worklets plugin that
// Reanimated 4 requires. Declared explicitly rather than relying on the
// implicit default, since a missing worklets plugin fails at runtime
// (gestures silently stop animating) rather than at build time.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};

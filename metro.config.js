const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Merge default asset extensions with custom ones (important: keep default image extensions)
    assetExts: [
      ...defaultConfig.resolver.assetExts, // Include all default extensions (png, jpg, jpeg, etc.)
      'tflite', // Add .tflite support for TensorFlow Lite models
      'bin',
      'txt',
      'pb',
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);

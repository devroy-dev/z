// Metro config — supports expo-three/GL asset types + keeps default Expo behavior.
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'obj', 'mtl', 'png', 'jpg'];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];
module.exports = config;

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const currentAssetExt = config.resolver.assetExt || [];
config.resolver.assetExt = Array.from(new Set([...currentAssetExt, "glb", "gltf", "obj", "mtl"]));

module.exports = config;

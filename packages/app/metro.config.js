const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so changes in shared/ are picked up
config.watchFolders = [monorepoRoot];

// Resolve packages from both the app's node_modules and the root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3D asset support
const currentAssetExt = config.resolver.assetExt || [];
config.resolver.assetExt = Array.from(new Set([...currentAssetExt, "glb", "gltf", "obj", "mtl"]));

module.exports = config;

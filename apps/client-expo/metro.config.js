const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedAssets = path.resolve(projectRoot, '../client-rn/src/assets');

const config = getDefaultConfig(projectRoot);

// Ensure Metro watches the shared assets folder
config.watchFolders = config.watchFolders || [];
if (!config.watchFolders.includes(sharedAssets)) {
  config.watchFolders.push(sharedAssets);
}

// Provide a simple alias so modules can import shared assets as `assets/...`
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  assets: sharedAssets,
});

module.exports = config;

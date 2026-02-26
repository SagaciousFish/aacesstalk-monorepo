const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedAssets = path.resolve(projectRoot, '../client-rn/src/assets');
const clientRnSrc = path.resolve(projectRoot, '../client-rn/src');
const libsPath = path.resolve(projectRoot, '../../libs');
const tsCorePath = path.resolve(libsPath, 'ts-core/src');

const config = getDefaultConfig(projectRoot);

// Ensure Metro watches the shared assets folder
config.watchFolders = config.watchFolders || [];
if (!config.watchFolders.includes(sharedAssets)) {
  config.watchFolders.push(sharedAssets);
}
// Also watch client-rn src folder
if (!config.watchFolders.includes(clientRnSrc)) {
  config.watchFolders.push(clientRnSrc);
}
// Watch libs folder
if (!config.watchFolders.includes(libsPath)) {
  config.watchFolders.push(libsPath);
}

// Provide a simple alias so modules can import shared assets as `assets/...`
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  assets: sharedAssets,
  '@aacesstalk/libs/ts-core': tsCorePath,
  'apps/client-rn/src': clientRnSrc,
});

module.exports = config;

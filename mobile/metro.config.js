const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend (wa-sqlite) ships a .wasm binary — Metro needs to know to
// treat it as an asset, not try to parse it as JS. Native builds don't need this at all
// (they use the real native SQLite binding), but the web preview is how this project
// verifies mobile logic in this dev environment (no device/emulator available).
config.resolver.assetExts.push("wasm");

module.exports = config;

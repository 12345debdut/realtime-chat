const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for the yarn workspaces monorepo.
 *
 * Why this file is non-default:
 *   react-native init ships a single-package metro.config.js. In a monorepo
 *   with yarn workspaces + hoisting, dependencies like @babel/runtime are
 *   lifted to the monorepo root's node_modules/. Metro must be told to
 *   (1) WATCH the root so the file watcher notices changes there, and
 *   (2) RESOLVE from both the app-local and root node_modules/.
 */

const projectRoot = __dirname;                        // apps/mobile
const workspaceRoot = path.resolve(projectRoot, '../..'); // monorepo root

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  // Watch both the app and the monorepo root so hot-reload picks up
  // changes in shared packages (e.g. @rtc/contracts).
  watchFolders: [workspaceRoot],

  resolver: {
    // Look in both locations when resolving modules. Order matters:
    // app-local first (wins on conflicts), then root (hoisted deps).
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // Hoisted monorepo deps are found via nodeModulesPaths above, not by
    // walking up the directory tree from each source file. Disabling the
    // walk makes resolution deterministic and avoids duplicate-React bugs.
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);

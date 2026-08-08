const path = require('node:path');

/**
 * Packaging configuration.
 *
 * The output directory is overridable via PROPERTY_FLIPPER_OUT because
 * packaging has to rename a directory it just created, and some locations
 * cannot support that. Folders created directly at a drive root (C:\Server\,
 * C:\Projects\, ...) inherit an ACL granting BUILTIN\Users only
 * ReadAndExecute, and electron-builder fails there with
 * `EPERM: operation not permitted, rename '...win-unpacked.tmp'`.
 *
 * `npm run dist` handles that automatically -- see scripts/dist.mjs.
 */
const outputDir = process.env.PROPERTY_FLIPPER_OUT || path.join(__dirname, 'release');

module.exports = {
  appId: 'com.propertyflipper.game',
  productName: 'Property Flipper',
  copyright: 'MIT Licensed',

  directories: {
    output: outputDir,
    buildResources: 'build',
  },

  // Only built output ships. Source, tests, and the upstream reference clone
  // are all excluded.
  files: ['dist/**/*', 'dist-electron/**/*', 'package.json'],

  // The game has no runtime data files -- all content is compiled into the
  // renderer bundle -- so nothing has to resolve relative to the executable.
  // That is deliberate: path-relative data loading is what breaks a packaged
  // app launched from a Start Menu shortcut, where the cwd is arbitrary.

  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'build/icon.ico',
  },

  // Both Windows targets emit a .exe, so they need distinct artifact names --
  // with a shared template the portable build overwrites the installer.
  nsis: {
    artifactName: '${productName}-${version}-Setup.${ext}',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Property Flipper',
    uninstallDisplayName: 'Property Flipper',
    // Saves live in %APPDATA%, so a reinstall must not touch them.
    deleteAppDataOnUninstall: false,
  },

  portable: {
    artifactName: '${productName}-${version}-Portable.${ext}',
  },

  // macOS and Linux take the PNG: electron-builder converts it to .icns and to
  // an icon set, and that conversion fails outright on the .ico.
  mac: {
    target: ['dmg'],
    category: 'public.app-category.simulation-games',
    icon: 'build/icon.png',
  },

  linux: {
    target: ['AppImage'],
    category: 'Game',
    icon: 'build/icon.png',
  },

  publish: null,
};

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
    // Signing is opt-in and driven entirely by whether the credentials exist.
    // electron-builder reads CSC_LINK and CSC_KEY_PASSWORD itself; naming the
    // timestamp server here is the only part that has to be configured, and
    // without it a signature stops verifying the day the certificate expires
    // rather than the day it was issued.
    signtoolOptions: {
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
    },
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
    // Notarisation requires the hardened runtime, and the hardened runtime
    // breaks Electron unless these two entitlements are granted -- Electron
    // allocates executable memory for the JIT. Set here rather than left to
    // whoever first tries to notarise, because the failure mode is an app that
    // signs cleanly and then refuses to launch.
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // Signed only when a Developer ID identity is actually present. The
    // release workflow sets CSC_IDENTITY_AUTO_DISCOVERY=false when it is not,
    // which makes an unsigned build succeed rather than fail.
    notarize: Boolean(process.env.APPLE_TEAM_ID) && {
      teamId: process.env.APPLE_TEAM_ID,
    },
  },

  linux: {
    target: ['AppImage'],
    category: 'Game',
    icon: 'build/icon.png',
    // Without these the AppImage lands in a desktop environment with no menu
    // entry and a generic icon.
    desktop: {
      entry: {
        Name: 'Property Flipper',
        Comment: 'Buy distressed, underwrite honestly, get out before the carry eats the margin',
        Categories: 'Game;Simulation;',
        Keywords: 'real estate;flipping;simulation;finance;',
      },
    },
  },

  publish: null,
};

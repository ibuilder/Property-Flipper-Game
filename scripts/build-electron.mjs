import { build } from 'esbuild';

/**
 * Bundle the Electron main and preload scripts for a production build.
 *
 * Output is CommonJS with a .js extension, which is what Electron expects for
 * a preload script when the package is not marked "type": "module".
 *
 * The development equivalent — watch plus relaunch — lives in dev-electron.mjs.
 */
await build({
  entryPoints: {
    main: 'electron/main.ts',
    preload: 'electron/preload.ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outdir: 'dist-electron',
  external: ['electron'],
  sourcemap: false,
  minify: true,
  logLevel: 'info',
});

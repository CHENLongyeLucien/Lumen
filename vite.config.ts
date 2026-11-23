import { resolve } from 'node:path';
import { build as esbuild } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';

const projectDir = import.meta.dirname;
const srcDir = resolve(projectDir, 'src');

/**
 * Scripts that must stay classic (non-module) files at a fixed path:
 * - the service worker, referenced by manifest.json;
 * - the theme boot script, loaded synchronously in <head> to avoid a theme flash.
 * They are bundled with esbuild as IIFEs and emitted into the Vite output.
 */
const CLASSIC_ENTRIES: Record<string, string> = {
  background: 'background.ts',
  'shared/theme-boot': 'shared/theme-boot.ts',
};

function classicScripts(isDev: boolean): Plugin {
  let outputs: { fileName: string; source: Uint8Array }[] = [];
  return {
    name: 'lumen-classic-scripts',
    apply: 'build',
    async buildStart() {
      const result = await esbuild({
        entryPoints: Object.fromEntries(
          Object.entries(CLASSIC_ENTRIES).map(([name, file]) => [name, resolve(srcDir, file)]),
        ),
        bundle: true,
        format: 'iife',
        target: 'chrome116',
        minify: !isDev,
        sourcemap: isDev ? 'inline' : false,
        outdir: 'out',
        write: false,
        metafile: true,
        logLevel: 'warning',
      });
      // Rebuild in watch mode when any file these scripts import changes.
      for (const input of Object.keys(result.metafile.inputs)) {
        this.addWatchFile(resolve(projectDir, input));
      }
      outputs = result.outputFiles.map((file) => ({
        fileName: file.path.replace(/\\/g, '/').split('/out/')[1] ?? file.path,
        source: file.contents,
      }));
    },
    generateBundle() {
      for (const output of outputs) {
        this.emitFile({ type: 'asset', fileName: output.fileName, source: output.source });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    root: srcDir,
    publicDir: resolve(projectDir, 'public'),
    base: '/',
    plugins: [classicScripts(isDev)],
    build: {
      outDir: resolve(projectDir, 'dist'),
      emptyOutDir: true,
      target: 'chrome116',
      minify: !isDev,
      sourcemap: isDev,
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          player: resolve(srcDir, 'player/player.html'),
          popup: resolve(srcDir, 'popup/popup.html'),
          welcome: resolve(srcDir, 'welcome/welcome.html'),
        },
      },
    },
  };
});

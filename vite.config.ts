import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { type Plugin, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';

// The following are known larger packages or packages that can be loaded asynchronously.
const individuallyPackages = ['activities', 'github.svg', 'grid.svg'];

// GitHub Pages has no rewrite rules, every unknown path is answered with
// 404.html. The app has to boot from that document, so the built index.html
// is copied over it and the router reads the requested path from the address.
const spaFallback = (): Plugin => {
  let outDir = '';
  return {
    name: 'spa-fallback',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteTsconfigPaths(),
    spaFallback(),
    svgr({
      include: ['**/*.svg'],
      svgrOptions: {
        exportType: 'named',
        namedExport: 'ReactComponent',
        plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
        svgoConfig: {
          floatPrecision: 2,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeTitle: false,
                  removeViewBox: false,
                },
              },
            },
          ],
        },
      },
    }),
  ],
  base: process.env.PATH_PREFIX || '/',
  define: {
    "import.meta.env.VERCEL": JSON.stringify(process.env.VERCEL),
  },
  build: {
    manifest: true,
    outDir: './dist', // for user easy to use, vercel use default dir -> dist
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            return 'vendors';
            // If there will be more and more external packages referenced in the future,
            // the following approach can be considered.
            // const name = id.split('node_modules/')[1].split('/');
            // return name[0] == '.pnpm' ? name[1] : name[0];
          } else {
            for (const item of individuallyPackages) {
              if (id.includes(item)) {
                return item;
              }
            }
          }
        },
      },
    },
  },
});

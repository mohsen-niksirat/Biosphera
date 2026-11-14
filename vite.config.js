import { defineConfig } from 'vite';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync
} from 'node:fs';
import { resolve } from 'node:path';

/**
 * Relative base so the PWA works from a sub-path (GitHub Pages project sites)
 * as well as from the domain root.
 *
 * The service worker lives at the project root (so raw HTTP serving can use it)
 * and the web app manifest must keep a stable URL: Vite hashes assets, which
 * would move manifest.json into /assets and break its relative icon path.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2020'
  },
  plugins: [
    {
      name: 'biosphera-static-files',
      closeBundle() {
        const root = process.cwd();
        const dist = resolve(root, 'dist');
        if (!existsSync(dist)) return;

        for (const file of ['sw.js', 'manifest.json']) {
          const source = resolve(root, file);
          if (existsSync(source)) copyFileSync(source, resolve(dist, file));
        }

        const indexPath = resolve(dist, 'index.html');
        if (existsSync(indexPath)) {
          const html = readFileSync(indexPath, 'utf8')
            .replace(/href="\.\/assets\/manifest-[^"]+\.json"/, 'href="./manifest.json"');
          writeFileSync(indexPath, html);
        }

        // Drop the hashed duplicate Vite emitted for the manifest
        const assetsDir = resolve(dist, 'assets');
        if (existsSync(assetsDir)) {
          for (const entry of readdirSync(assetsDir)) {
            if (entry.startsWith('manifest-') && entry.endsWith('.json')) {
              unlinkSync(resolve(assetsDir, entry));
            }
          }
        }
      }
    }
  ]
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { DISPLAY_DESCRIPTION, DISPLAY_NAME } from './shared/branding';

function syncMetadataFile(rootDir: string): void {
  const metaPath = path.resolve(rootDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) return;
  const current = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
  if (current.name !== DISPLAY_NAME || current.description !== DISPLAY_DESCRIPTION) {
    current.name = DISPLAY_NAME;
    current.description = DISPLAY_DESCRIPTION;
    fs.writeFileSync(metaPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  }
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Injects DISPLAY_NAME and DISPLAY_DESCRIPTION from shared/branding.ts into index.html and metadata.json at build/dev time
      {
        name: 'inject-branding-metadata',
        buildStart(): void {
          syncMetadataFile(__dirname);
        },
        transformIndexHtml(html: string): string {
          return html
            .replace(/<title>[^<]*<\/title>/, `<title>${DISPLAY_NAME}</title>`)
            .replace(
              /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
              `<meta name="description" content="${DISPLAY_DESCRIPTION}" />`,
            )
            .replace(
              /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
              `<meta property="og:title" content="${DISPLAY_NAME}" />`,
            )
            .replace(
              /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
              `<meta property="og:description" content="${DISPLAY_DESCRIPTION}" />`,
            );
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

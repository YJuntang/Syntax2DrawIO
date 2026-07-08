import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const isTauriDesktopBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    !isTauriDesktopBuild
      ? VitePWA({
          registerType: 'prompt',
          includeAssets: ['favicon.svg', 'masked-icon.svg'],
          workbox: {
            maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
            globIgnores: [
              '**/*.map',
              'assets/CodeEditor-*.js',
              'assets/monaco-*.js',
              'assets/*worker*.js',
              'assets/*Diagram*.js',
              'assets/flowchart-*.js',
              'assets/mindmap-*.js',
            ],
            runtimeCaching: [
              {
                urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'worker',
                handler: 'CacheFirst',
                options: {
                  cacheName: 's2d-lazy-code',
                  expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
                },
              },
            ],
          },
          manifest: {
            name: 'Syntax2DrawIO',
            short_name: 'S2D',
            description: 'Convert Mermaid & PlantUML diagrams to editable Draw.io files',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'standalone',
            icons: [
              {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              },
              {
                src: 'masked-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      : null,
    !isTauriDesktopBuild
      ? compression({
          algorithm: 'gzip',
          ext: '.gz',
        })
      : null,
    !isTauriDesktopBuild
      ? compression({
          algorithm: 'brotliCompress',
          ext: '.br',
        })
      : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['@monaco-editor/react'],
          mermaid: ['mermaid'],
          plantuml: ['plantuml-encoder'],
          vendor: ['react', 'react-dom', 'zustand', 'immer'],
        },
      },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  server: {
    port: 3000,
    open: !isTauriDesktopBuild,
  },
});

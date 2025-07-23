import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import * as path from 'path';
import viteCompression from 'vite-plugin-compression';
import legacy from '@vitejs/plugin-legacy';
import { createHtmlPlugin } from 'vite-plugin-html';
import eslint from 'vite-plugin-eslint';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';

  return {
    plugins: [
      react(),
      eslint({ cache: false, include: ['src/**/*.ts', 'src/**/*.tsx'] }),
      createHtmlPlugin({
        inject: {
          data: {
            appTitle: 'PromptPal AI',
          },
        },
      }),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'PromptPal AI',
          short_name: 'PromptPal',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
      viteCompression({ algorithm: 'brotliCompress' }),
      legacy({ targets: ['defaults', 'not IE 11'] }),
      isProd && visualizer({ filename: 'stats.html', open: false }),
    ],

    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
      __API_URL__: JSON.stringify(env.VITE_API_URL),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },
    },

    css: {
      preprocessorOptions: {
        scss: { additionalData: `@import "src/styles/variables.scss";` },
      },
    },

    build: {
      sourcemap: true,
      target: 'es2021',
      outDir: 'dist',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'axios'],
            i18n: ['i18next', 'react-i18next'],
          },
        },
      },
    },

    optimizeDeps: {
      include: ['react', 'react-dom', 'i18next', 'react-i18next'],
    },

    server: {
      port: 3000,
      strictPort: true,
    },

    test: {
      globals: true,
      environment: 'jsdom',
      coverage: {
        provider: 'c8',
        reporter: ['text', 'html'],
        lines: 90,
      },
    },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, '../../dist/webview'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'dashboard/index.html'),
        sidebar: resolve(__dirname, 'sidebar/index.html'),
        onboarding: resolve(__dirname, 'onboarding/index.html'),
      },
      output: {
        entryFileNames: '[name]/[name].js',
        chunkFileNames: 'shared/[name].js',
        assetFileNames: (assetInfo) => {
          // Keep CSS filename stable for webview providers
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/style.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    cssCodeSplit: false, // Bundle all CSS into one file
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
      '@shared': resolve(__dirname, 'shared'),
      '@components': resolve(__dirname, 'shared/components'),
      '@hooks': resolve(__dirname, 'shared/hooks'),
      '@store': resolve(__dirname, 'shared/store'),
      '@lib': resolve(__dirname, 'shared/lib'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});

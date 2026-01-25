import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'global': 'window',
  },
  resolve: {
    alias: {
      '@firebase/firestore': path.resolve(__dirname, 'node_modules/@firebase/firestore/dist/index.esm2017.js'),
      '@firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/esm2017/index.js'),
      '@firebase/storage': path.resolve(__dirname, 'node_modules/@firebase/storage/dist/index.esm2017.js'),
      '@firebase/functions': path.resolve(__dirname, 'node_modules/@firebase/functions/dist/index.esm2017.js'),
    }
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Let Vite handle Firebase automatically - don't force chunking
            if (id.includes('@react-pdf/renderer')) {
              return 'pdf-renderer';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('@heroui/react')) {
              return 'ui-kit';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('framer-motion')) {
              return 'animations';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-core';
            }
          }
        }
      }
    }
  }
})


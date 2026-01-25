import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'global': 'window',
  },
  resolve: {
    mainFields: ['browser', 'module', 'main', 'jsnext:main', 'jsnext'],
    dedupe: ['firebase', '@firebase/app', '@firebase/firestore']
  },
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/functions'
    ]
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    commonjsOptions: {
      include: [/firebase/, /node_modules/]
    },
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

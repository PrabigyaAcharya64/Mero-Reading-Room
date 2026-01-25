import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'global': 'window',
  },
  resolve: {
    dedupe: ['firebase', '@firebase/app', '@firebase/firestore']
  },
  optimizeDeps: {
    exclude: ['firebase']
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


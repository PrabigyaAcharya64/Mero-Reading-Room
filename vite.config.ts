import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@firebase/firestore': path.resolve(__dirname, 'node_modules/@firebase/firestore/dist/index.esm.js'),
      '@firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/esm/index.js'),
      '@firebase/app': path.resolve(__dirname, 'node_modules/@firebase/app/dist/esm/index.esm.js'),
    }
  },
  define: {
    'global': 'window',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    esbuildOptions: {
      supported: {
        bigint: true
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      transformMixedEsModules: true,
      ignoreDynamicRequires: true
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'firebase'
            }
            if (id.includes('@react-pdf/renderer')) {
              return 'pdf-renderer'
            }
            if (id.includes('recharts')) {
              return 'charts'
            }
            if (id.includes('@heroui/react')) {
              return 'ui-kit'
            }
            if (id.includes('lucide-react')) {
              return 'icons'
            }
            if (id.includes('framer-motion')) {
              return 'animations'
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-core'
            }
          }
        }
      }
    }
  }
})
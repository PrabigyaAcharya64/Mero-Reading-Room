import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@firebase/app': path.resolve(__dirname, 'node_modules/@firebase/app/dist/esm/index.esm.js'),
      '@firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/esm/index.js'),
      '@firebase/firestore': path.resolve(__dirname, 'node_modules/@firebase/firestore/dist/index.esm.js'),
      '@firebase/functions': path.resolve(__dirname, 'node_modules/@firebase/functions/dist/esm/index.esm.js'),
      '@firebase/storage': path.resolve(__dirname, 'node_modules/@firebase/storage/dist/index.esm.js'),
      '@firebase/database': path.resolve(__dirname, 'node_modules/@firebase/database/dist/index.esm.js'),
      '@firebase/analytics': path.resolve(__dirname, 'node_modules/@firebase/analytics/dist/esm/index.esm.js'),
      '@firebase/performance': path.resolve(__dirname, 'node_modules/@firebase/performance/dist/esm/index.esm.js'),
      '@firebase/messaging': path.resolve(__dirname, 'node_modules/@firebase/messaging/dist/esm/index.esm.js'),
      '@firebase/installations': path.resolve(__dirname, 'node_modules/@firebase/installations/dist/esm/index.esm.js'),
      '@firebase/remote-config': path.resolve(__dirname, 'node_modules/@firebase/remote-config/dist/esm/index.esm.js'),
      '@firebase/app-check': path.resolve(__dirname, 'node_modules/@firebase/app-check/dist/esm/index.esm.js'),
      '@firebase/auth-compat': path.resolve(__dirname, 'node_modules/@firebase/auth-compat/dist/index.esm.js'),
      '@firebase/database-compat': path.resolve(__dirname, 'node_modules/@firebase/database-compat/dist/index.esm.js'),
      '@firebase/firestore-compat': path.resolve(__dirname, 'node_modules/@firebase/firestore-compat/dist/index.esm.js'),
      '@firebase/functions-compat': path.resolve(__dirname, 'node_modules/@firebase/functions-compat/dist/esm/index.esm.js'),
      '@firebase/installations-compat': path.resolve(__dirname, 'node_modules/@firebase/installations-compat/dist/esm/index.esm.js'),
      '@firebase/messaging-compat': path.resolve(__dirname, 'node_modules/@firebase/messaging-compat/dist/esm/index.esm.js'),
      '@firebase/performance-compat': path.resolve(__dirname, 'node_modules/@firebase/performance-compat/dist/esm/index.esm.js'),
      '@firebase/remote-config-compat': path.resolve(__dirname, 'node_modules/@firebase/remote-config-compat/dist/esm/index.esm.js'),
      '@firebase/storage-compat': path.resolve(__dirname, 'node_modules/@firebase/storage-compat/dist/esm/index.esm.js'),
      '@firebase/analytics-compat': path.resolve(__dirname, 'node_modules/@firebase/analytics-compat/dist/esm/index.esm.js'),
      '@firebase/app-compat': path.resolve(__dirname, 'node_modules/@firebase/app-compat/dist/esm/index.esm.js'),
      '@firebase/app-check-compat': path.resolve(__dirname, 'node_modules/@firebase/app-check-compat/dist/esm/index.esm.js'),
      '@firebase/ai': path.resolve(__dirname, 'node_modules/@firebase/ai/dist/esm/index.esm.js'),
      '@firebase/component': path.resolve(__dirname, 'node_modules/@firebase/component/dist/esm/index.esm.js'),
      '@firebase/data-connect': path.resolve(__dirname, 'node_modules/@firebase/data-connect/dist/index.esm.js'),
      '@firebase/logger': path.resolve(__dirname, 'node_modules/@firebase/logger/dist/esm/index.esm.js'),
      '@firebase/util': path.resolve(__dirname, 'node_modules/@firebase/util/dist/index.esm.js'),
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

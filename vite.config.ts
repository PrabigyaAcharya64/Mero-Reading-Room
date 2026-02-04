import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to redirect @firebase/* imports to firebase/*
function firebaseRedirectPlugin(): Plugin {
  return {
    name: 'firebase-redirect',
    enforce: 'pre', // Run before other plugins
    resolveId(source, importer, options) {
      // Intercept @firebase/* imports
      if (source.startsWith('@firebase/')) {
        const moduleName = source.replace('@firebase/', '');
        // Return the redirected path
        return `firebase/${moduleName}`;
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [
    firebaseRedirectPlugin(),
    react()
  ],
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
  resolve: {
    alias: {
      '@firebase/app': 'firebase/app',
      '@firebase/auth': 'firebase/auth',
      '@firebase/firestore': 'firebase/firestore',
      '@firebase/functions': 'firebase/functions',
      '@firebase/storage': 'firebase/storage',
      '@firebase/analytics': 'firebase/analytics',
      '@firebase/performance': 'firebase/performance',
    }
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      include: [/node_modules/],
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
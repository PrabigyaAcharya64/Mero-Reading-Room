import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to handle @firebase/* imports
function firebaseResolverPlugin(): Plugin {
  const firebaseModules = new Set([
    'app', 'auth', 'firestore', 'functions', 
    'storage', 'analytics', 'performance', 'messaging'
  ]);

  return {
    name: 'firebase-resolver',
    enforce: 'pre',
    resolveId(source, importer) {
      // Only intercept @firebase/* imports that come from node_modules dependencies
      // NOT from firebase's own internal files
      if (source.startsWith('@firebase/') && 
          importer && 
          !importer.includes('node_modules/firebase/')) {
        
        const moduleName = source.replace('@firebase/', '').split('/')[0];
        
        if (firebaseModules.has(moduleName)) {
          return `firebase/${moduleName}`;
        }
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [
    firebaseResolverPlugin(),
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

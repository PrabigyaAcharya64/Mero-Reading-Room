import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url);

function createFirebaseAliases() {
  const mappings = {
    '@firebase/app': 'dist/esm/index.esm.js',
    '@firebase/auth': 'dist/esm/index.js',
    '@firebase/firestore': 'dist/index.esm.js',
    '@firebase/functions': 'dist/esm/index.esm.js',
    '@firebase/storage': 'dist/index.esm.js',
    '@firebase/database': 'dist/index.esm.js',
    '@firebase/analytics': 'dist/esm/index.esm.js',
    '@firebase/performance': 'dist/esm/index.esm.js',
    '@firebase/messaging': 'dist/esm/index.esm.js',
    '@firebase/installations': 'dist/esm/index.esm.js',
    '@firebase/remote-config': 'dist/esm/index.esm.js',
    '@firebase/app-check': 'dist/esm/index.esm.js',
    '@firebase/auth-compat': 'dist/index.esm.js',
    '@firebase/database-compat': 'dist/index.esm.js',
    '@firebase/firestore-compat': 'dist/index.esm.js',
    '@firebase/functions-compat': 'dist/esm/index.esm.js',
    '@firebase/installations-compat': 'dist/esm/index.esm.js',
    '@firebase/messaging-compat': 'dist/esm/index.esm.js',
    '@firebase/performance-compat': 'dist/esm/index.esm.js',
    '@firebase/remote-config-compat': 'dist/esm/index.esm.js',
    '@firebase/storage-compat': 'dist/esm/index.esm.js',
    '@firebase/analytics-compat': 'dist/esm/index.esm.js',
    '@firebase/app-compat': 'dist/esm/index.esm.js',
    '@firebase/app-check-compat': 'dist/esm/index.esm.js',
    '@firebase/ai': 'dist/esm/index.esm.js',
    '@firebase/component': 'dist/esm/index.esm.js',
    '@firebase/data-connect': 'dist/index.esm.js',
    '@firebase/logger': 'dist/esm/index.esm.js',
    '@firebase/util': 'dist/index.esm.js',
  };

  const aliases: Record<string, string> = {};
  for (const [pkg, internalPath] of Object.entries(mappings)) {
    try {
      const pkgJsonPath = require.resolve(`${pkg}/package.json`);
      const pkgRoot = path.dirname(pkgJsonPath);
      aliases[pkg] = path.join(pkgRoot, internalPath);
    } catch (e) {
      // Package not installed, skip
    }
  }
  return aliases;
}

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      ...createFirebaseAliases()
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

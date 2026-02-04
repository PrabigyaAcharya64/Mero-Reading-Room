import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url);

function createFirebaseAliases() {
  const firebasePackages = [
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
    '@firebase/functions',
    '@firebase/storage',
    '@firebase/database',
    '@firebase/analytics',
    '@firebase/performance',
    '@firebase/messaging',
    '@firebase/installations',
    '@firebase/remote-config',
    '@firebase/app-check',
    '@firebase/auth-compat',
    '@firebase/database-compat',
    '@firebase/firestore-compat',
    '@firebase/functions-compat',
    '@firebase/installations-compat',
    '@firebase/messaging-compat',
    '@firebase/performance-compat',
    '@firebase/remote-config-compat',
    '@firebase/storage-compat',
    '@firebase/analytics-compat',
    '@firebase/app-compat',
    '@firebase/app-check-compat',
    '@firebase/ai',
    '@firebase/component',
    '@firebase/data-connect',
    '@firebase/logger',
    '@firebase/util',
  ];

  const aliases: Record<string, string> = {};

  firebasePackages.forEach(pkg => {
    try {
      const pkgJsonPath = require.resolve(`${pkg}/package.json`);
      const pkgRoot = path.dirname(pkgJsonPath);
      const pkgJson = require(pkgJsonPath);

      // Prioritize ESM entry points
      let entry = pkgJson.browser || pkgJson.module || pkgJson['react-native'] || pkgJson.main;

      // Handle 'exports' field if present (more standard in modern pkgs)
      if (!entry && pkgJson.exports) {
        if (typeof pkgJson.exports === 'string') {
          entry = pkgJson.exports;
        } else if (pkgJson.exports['.']) {
          const exp = pkgJson.exports['.'];
          entry = exp.browser || exp.import || exp.default || exp.require;
        }
      }

      // If entry is an object (common in modern firebase), try to find a string path
      if (typeof entry === 'object') {
        entry = entry.browser || entry.import || entry.default || entry.esm;
      }

      if (entry) {
        const absolutePath = path.resolve(pkgRoot, entry);
        if (fs.existsSync(absolutePath)) {
          aliases[pkg] = absolutePath;
          // console.log(`[Firebase Alias] ${pkg} -> ${absolutePath}`); 
        } else {
          console.warn(`[Firebase Alias Warn] Resolved path for ${pkg} does not exist: ${absolutePath}`);
        }
      }
    } catch (e) {
      // console.log(`[Firebase Alias] Could not resolve ${pkg}`);
    }
  });

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

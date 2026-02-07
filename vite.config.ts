import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Robustly resolve Firebase files by finding the package root first
function resolveFirebase(pkgName: string, relativePath: string) {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    return path.resolve(path.dirname(pkgJsonPath), relativePath);
  } catch (e) {
    console.warn(`Could not resolve ${pkgName}/package.json, falling back to node_modules`);
    return path.resolve(process.cwd(), `node_modules/${pkgName}/${relativePath}`);
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser', 'import'],
    alias: {
      '@firebase/app': resolveFirebase('@firebase/app', 'dist/esm/index.esm.js'),
      '@firebase/auth': resolveFirebase('@firebase/auth', 'dist/esm/index.js'),
      '@firebase/firestore': resolveFirebase('@firebase/firestore', 'dist/index.esm.js'),
      '@firebase/functions': resolveFirebase('@firebase/functions', 'dist/esm/index.esm.js'),
      '@firebase/storage': resolveFirebase('@firebase/storage', 'dist/index.esm.js'),
      '@firebase/analytics': resolveFirebase('@firebase/analytics', 'dist/esm/index.esm.js'),
      '@firebase/performance': resolveFirebase('@firebase/performance', 'dist/esm/index.esm.js'),
      '@firebase/remote-config': resolveFirebase('@firebase/remote-config', 'dist/esm/index.esm.js'),
      '@firebase/installations': resolveFirebase('@firebase/installations', 'dist/esm/index.esm.js'),
      '@firebase/messaging': resolveFirebase('@firebase/messaging', 'dist/esm/index.esm.js'),
    }
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          utils: ['html2canvas', 'ldrs']
        }
      }
    }
  }
})
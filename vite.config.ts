import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Helper to get the correct ESM path for each @firebase package
const firebaseAliases = {
  '@firebase/logger': 'node_modules/@firebase/logger/dist/esm/index.esm2017.js',
  '@firebase/util': 'node_modules/@firebase/util/dist/index.esm2017.js',
  '@firebase/component': 'node_modules/@firebase/component/dist/esm/index.esm2017.js',
  '@firebase/app': 'node_modules/@firebase/app/dist/esm/index.esm2017.js',
  '@firebase/auth': 'node_modules/@firebase/auth/dist/esm2017/index.js',
  '@firebase/firestore': 'node_modules/@firebase/firestore/dist/index.esm2017.js',
  '@firebase/functions': 'node_modules/@firebase/functions/dist/index.esm2017.js',
  '@firebase/storage': 'node_modules/@firebase/storage/dist/index.esm2017.js',
}

export default defineConfig({
  plugins: [react()],
  // Polyfill process for browser compatibility (Firebase references this)
  define: {
    'process.env': {},
    'global': 'globalThis'
  },
  resolve: {
    // Static aliases to ESM browser builds - this fixes Vercel build issues
    alias: Object.fromEntries(
      Object.entries(firebaseAliases).map(([pkg, relativePath]) => [
        pkg,
        path.resolve(__dirname, relativePath)
      ])
    ),
    // Dedupe ensures we don't load two copies of Firebase
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore', '@firebase/functions', '@firebase/storage']
  },
  build: {
    chunkSizeWarningLimit: 1600,
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      '@capacitor-firebase/authentication',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/functions',
      'firebase/storage'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Polyfill process for browser compatibility (Firebase references this)
  define: {
    'process.env': {},
    'global': 'globalThis'
  },
  resolve: {
    // Dedupe ensures we don't load two copies of Firebase (one from app, one from plugin)
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore', '@firebase/functions', '@firebase/storage']
  },
  build: {
    // Increases the warning limit so you don't get spam about chunk sizes
    chunkSizeWarningLimit: 1600,
    commonjsOptions: {
      // This tells Vite to treat these specific packages loosely
      transformMixedEsModules: true,
      // Include the @firebase packages in CommonJS transformation
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Groups Firebase code into a single file to prevent resolution errors
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage']
        }
      }
    }
  },
  // Pre-bundle these dependencies with their internal @firebase/* imports
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
      // Define process.env for esbuild during dev
      define: {
        global: 'globalThis'
      }
    }
  }
})
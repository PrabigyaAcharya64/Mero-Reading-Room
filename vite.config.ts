import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Explicitly alias all @firebase/* packages to their entry points using dynamic resolution
    // This fixes the Vercel build error: "Failed to resolve entry for package @firebase/firestore"
    alias: {
      '@firebase/firestore': require.resolve('@firebase/firestore'),
      '@firebase/auth': require.resolve('@firebase/auth'),
      '@firebase/app': require.resolve('@firebase/app'),
      '@firebase/functions': require.resolve('@firebase/functions'),
      '@firebase/storage': require.resolve('@firebase/storage'),
      '@firebase/logger': require.resolve('@firebase/logger'),
      '@firebase/util': require.resolve('@firebase/util'),
      '@firebase/component': require.resolve('@firebase/component'),
    },
    // Dedupe ensures we don't load two copies of Firebase (one from app, one from plugin)
    dedupe: ['firebase', '@firebase']
  },
  build: {
    // Increases the warning limit so you don't get spam about chunk sizes
    chunkSizeWarningLimit: 1600,
    commonjsOptions: {
      // This is the key fix: It tells Vite to treat these specific packages loosely
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Groups Firebase code into a single file to prevent resolution errors
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
  // Tells Vite that this specific plugin contains code that needs to be processed
  optimizeDeps: {
    include: ['@capacitor-firebase/authentication']
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Explicitly alias @firebase/logger to its ESM entry point to bypass Vercel's resolution errors
    alias: {
      '@firebase/logger': path.resolve(process.cwd(), 'node_modules/@firebase/logger/dist/esm/index.esm2017.js'),
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
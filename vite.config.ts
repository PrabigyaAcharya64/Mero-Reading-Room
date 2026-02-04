import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Force all internal firebase calls to use the main ESM entry point
      // '@firebase/app': 'firebase/app',
      // '@firebase/auth': 'firebase/auth',
      // '@firebase/firestore': 'firebase/firestore',
      // '@firebase/functions': 'firebase/functions',
      // '@firebase/storage': 'firebase/storage',
    },
    dedupe: ['firebase']
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      // This tells the CJS plugin: "Do not touch these files"
      exclude: [/node_modules\/@firebase/, /node_modules\/firebase/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
  // Ensure Capacitor plugins are treated as source code to be bundled
  ssr: {
    noExternal: ['@capacitor-firebase/authentication']
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    // Polyfill Node.js globals for browser compatibility (Firebase references process.versions.node)
    nodePolyfills({
      // Only include the globals we need
      globals: {
        process: true,
        global: true,
        Buffer: false,
      },
      // Don't polyfill full modules, just the globals
      protocolImports: false,
    }),
  ],
  resolve: {
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
    ]
  }
})
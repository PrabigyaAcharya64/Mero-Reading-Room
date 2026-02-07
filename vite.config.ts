import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    // Polyfill Node.js globals for browser compatibility
    nodePolyfills({
      globals: {
        process: true,
        global: true,
        Buffer: false,
      },
      protocolImports: false,
    }),
  ],
  resolve: {
    // Force browser-first resolution for Firebase packages
    conditions: ['browser', 'module', 'import', 'default'],
    // Dedupe ensures we don't load two copies of Firebase
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore', '@firebase/functions', '@firebase/storage', '@firebase/logger', '@firebase/util', '@firebase/component']
  },
  // SSR configuration - force all @firebase packages to be bundled, not externalized
  ssr: {
    noExternal: [/@firebase\//]
  },
  build: {
    target: 'esnext',
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
      target: 'esnext'
    }
  }
})
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
  build: {
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/functions',
      'firebase/storage'
    ]
  }
})
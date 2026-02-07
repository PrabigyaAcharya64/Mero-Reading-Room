import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prioritize browser-compatible builds over Node.js builds
    mainFields: ['browser', 'module', 'main'],
    // Use browser/import conditions when resolving package exports
    conditions: ['browser', 'import', 'module', 'default'],
  },
  optimizeDeps: {
    // Pre-bundle Firebase packages during dev to avoid resolution issues
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/functions',
    ],
    esbuildOptions: {
      // Target modern browsers
      target: 'esnext',
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    commonjsOptions: {
      // Process all node_modules with CommonJS plugin
      include: [/node_modules/],
      // Handle mixed ESM/CJS modules (critical for Firebase)
      transformMixedEsModules: true,
      // Use strict mode for better compatibility
      strictRequires: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          utils: ['html2canvas', 'ldrs'],
        },
      },
    },
  },
})
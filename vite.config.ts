import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // FIX: Removed the specific aliases causing the loop.
    // We only keep 'dedupe' to ensure plugins don't load a second instance of Firebase.
    dedupe: ['firebase', '@firebase']
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      // Allow Vite to mix CommonJS and ESM (helpful for Capacitor plugins)
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep Firebase grouped to prevent bundle fragmentation
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
  // Ensure Capacitor plugins are processed correctly
  optimizeDeps: {
    exclude: ['@capacitor-firebase/authentication']
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Remove the 'global': 'window' unless you specifically have a library 
  // complaining about 'global' being undefined.

  resolve: {
    // Keep dedupe to ensure only one version of Firebase is loaded
    dedupe: ['firebase']
  },

  // Let's stop trying to manually chunk Firebase for a moment 
  // to see if a standard build succeeds.
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      // Set this to an empty array to ensure NO firebase packages 
      // are accidentally treated as CommonJS.
      // include: []
    }
  }
})

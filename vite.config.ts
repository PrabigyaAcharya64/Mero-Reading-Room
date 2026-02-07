import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force Vite to always prioritize browser-compatible builds
    // This is critical for Firebase to work correctly in Vercel's environment
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser', 'import'],
  },
  build: {
    chunkSizeWarningLimit: 1600,
  }
})
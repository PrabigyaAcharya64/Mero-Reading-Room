import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser', 'import'],
    alias: {
      '@firebase/firestore': path.resolve(__dirname, 'node_modules/@firebase/firestore/dist/index.esm.js'),
      '@firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/esm/index.js'),
      '@firebase/app': path.resolve(__dirname, 'node_modules/@firebase/app/dist/esm/index.esm.js'),
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
  }
})
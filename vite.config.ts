import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This is often necessary for some older libraries, but be careful with it
    'global': 'window',
  },
  resolve: {
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore'],
    alias: {
      // FIX: Redirect internal @firebase imports to the main package
      // '@firebase/firestore': 'firebase/firestore',
      // '@firebase/auth': 'firebase/auth',
      // '@firebase/app': 'firebase/app',
    }
  },
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/functions',
      '@capacitor-firebase/authentication',
      'lucide-react',
      'recharts'
    ]
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      transformMixedEsModules: true,
      // FIX: Remove /firebase/ from here. It is already ESM.
      // Only include node_modules generally if absolutely necessary, 
      // Otherwise remove this specific include block entirely or keep it minimal.
      // include: []
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@firebase') || id.includes('firebase')) {
              return 'firebase'
            }
            if (id.includes('react')) {
              return 'vendor'
            }
          }
        }
      }
    }
  }
})

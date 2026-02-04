import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'global': 'window',
  },
  resolve: {
    // Force Vite to use the single copy of firebase to avoid dual-package hazards
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore'],
    alias: {
      // Explicitly point to the ESM build to avoid CJS/ESM interop issues
      // 'firebase/auth': 'firebase/auth/dist/index.esm.js',
      // 'firebase/firestore': 'firebase/firestore/dist/index.esm.js',
      // 'firebase/app': 'firebase/app/dist/index.esm.js',
    }
  },
  optimizeDeps: {
    // Pre-bundle these dependencies to convert CJS -> ESM and cache them
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/functions',
      '@capacitor-firebase/authentication',
      'lucide-react',
      'recharts'
    ],
    esbuildOptions: {
      // Allow top-level 'this', common in older libs or polyfills
      supported: {
        bigint: true
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      transformMixedEsModules: true,
      // Help Vite handle the complex exports of newer Firebase versions
      include: [/firebase/, /node_modules/]
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
  },
  ssr: {
    // Ensure these are processed by Vite's pipeline during SSR/Build
    noExternal: ['@capacitor-firebase/authentication', 'firebase']
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fs = require('fs')

// Robustly resolve Firebase files by finding the package root first
// Checks multiple candidate paths to handle version/environment differences
function resolveFirebase(pkgName: string, candidates: string[]) {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkgRoot = path.dirname(pkgJsonPath);

    for (const candidate of candidates) {
      const absPath = path.resolve(pkgRoot, candidate);
      if (fs.existsSync(absPath)) {
        return absPath;
      }
    }

    // If none found, log debug info for Vercel
    console.warn(`[Vite Config] Could not find any candidates for ${pkgName}. Checked: ${candidates.join(', ')}`);
    console.warn(`[Vite Config] ${pkgName} root: ${pkgRoot}`);
    try {
      console.warn(`[Vite Config] ${pkgName}/dist contents:`, fs.readdirSync(path.join(pkgRoot, 'dist')));
      const esmDir = path.join(pkgRoot, 'dist/esm');
      if (fs.existsSync(esmDir)) {
        console.warn(`[Vite Config] ${pkgName}/dist/esm contents:`, fs.readdirSync(esmDir));
      }
    } catch (e) { console.warn('Could not list dist', e); }

    // Fallback to first candidate to let build fail with path error
    return path.resolve(pkgRoot, candidates[0]);

  } catch (e) {
    console.warn(`Could not resolve ${pkgName}/package.json, falling back to node_modules`);
    return path.resolve(process.cwd(), `node_modules/${pkgName}/${candidates[0]}`);
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser', 'import'],
    alias: {
      '@firebase/firestore': resolveFirebase('@firebase/firestore', ['dist/index.esm.js', 'dist/esm/index.esm.js']),
      '@firebase/auth': resolveFirebase('@firebase/auth', ['dist/esm/index.js', 'dist/index.esm.js']),
      '@firebase/app': resolveFirebase('@firebase/app', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
      '@firebase/functions': resolveFirebase('@firebase/functions', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
      '@firebase/storage': resolveFirebase('@firebase/storage', ['dist/index.esm.js', 'dist/esm/index.esm.js']),
      '@firebase/analytics': resolveFirebase('@firebase/analytics', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
      '@firebase/performance': resolveFirebase('@firebase/performance', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
      '@firebase/remote-config': resolveFirebase('@firebase/remote-config', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
      '@firebase/installations': resolveFirebase('@firebase/installations', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
      '@firebase/messaging': resolveFirebase('@firebase/messaging', ['dist/esm/index.esm.js', 'dist/index.esm.js']),
    }
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          utils: ['html2canvas', 'ldrs']
        }
      }
    }
  }
})
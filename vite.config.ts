import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fs = require('fs')


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


    console.warn(`[Vite Config] Could not find any candidates for ${pkgName}. Checked: ${candidates.join(', ')}`);
    console.warn(`[Vite Config] ${pkgName} root: ${pkgRoot}`);
    try {
      console.warn(`[Vite Config] ${pkgName}/dist contents:`, fs.readdirSync(path.join(pkgRoot, 'dist')));
      const esmDir = path.join(pkgRoot, 'dist/esm');
      if (fs.existsSync(esmDir)) {
        console.warn(`[Vite Config] ${pkgName}/dist/esm contents:`, fs.readdirSync(esmDir));
      }
    } catch (e) { console.warn('Could not list dist', e); }

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
      '@firebase/firestore': resolveFirebase('@firebase/firestore', ['dist/index.esm.js', 'dist/esm/index.esm.js', 'dist/index.cjs.js', 'dist/index.esm2017.js', 'dist/esm/index.esm2017.js']),
      '@firebase/auth': resolveFirebase('@firebase/auth', ['dist/esm/index.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/app': resolveFirebase('@firebase/app', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/functions': resolveFirebase('@firebase/functions', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/storage': resolveFirebase('@firebase/storage', ['dist/index.esm.js', 'dist/esm/index.esm.js', 'dist/index.cjs.js', 'dist/index.esm2017.js', 'dist/esm/index.esm2017.js']),
      '@firebase/analytics': resolveFirebase('@firebase/analytics', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/performance': resolveFirebase('@firebase/performance', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/remote-config': resolveFirebase('@firebase/remote-config', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/installations': resolveFirebase('@firebase/installations', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/messaging': resolveFirebase('@firebase/messaging', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/data-connect': resolveFirebase('@firebase/data-connect', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/database': resolveFirebase('@firebase/database', ['dist/index.esm.js', 'dist/esm/index.esm.js', 'dist/index.cjs.js', 'dist/index.esm2017.js', 'dist/esm/index.esm2017.js']),
      '@firebase/component': resolveFirebase('@firebase/component', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/util': resolveFirebase('@firebase/util', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
      '@firebase/logger': resolveFirebase('@firebase/logger', ['dist/esm/index.esm.js', 'dist/index.esm.js', 'dist/index.cjs.js', 'dist/esm/index.esm2017.js', 'dist/index.esm2017.js']),
    }
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Ignore postinstall.js - it's a build script that shouldn't be bundled
      external: [/postinstall\.m?js$/],
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
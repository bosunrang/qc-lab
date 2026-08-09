import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve('src/compat/modular-pilot.global.ts'),
      name: 'QCLabModularPilot',
      formats: ['iife'],
      fileName: () => 'modular-pilot.js',
    },
    outDir: 'assets/generated',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
  },
});

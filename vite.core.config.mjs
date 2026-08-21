import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve('src/domain/core/qc-core.ts'),
      name: 'QCCore',
      formats: ['umd'],
      fileName: () => 'core.js',
    },
    outDir: 'assets',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
  },
});

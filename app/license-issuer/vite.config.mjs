import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Chỉ bundle giao diện công cụ; main và khoá công khai được chép riêng.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), base: './',
  build: { outDir: fileURLToPath(new URL('../../.cache/license-issuer', import.meta.url)), emptyOutDir: true },
});

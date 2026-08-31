import { defineConfig } from 'vite';

// Renderer của app-v2 — Vite build thật (ES module, không IIFE thủ công như
// bản cũ) vì đây là app Electron-only, không cần né minify để giữ diffable
// theo quy ước app cũ (đó là ràng buộc riêng của việc gộp bundle với bundle
// classic, không áp dụng ở đây).
export default defineConfig({
  root: 'app-v2/renderer',
  base: './',
  build: {
    outDir: '../../app-v2-dist/renderer',
    emptyOutDir: true,
  },
});

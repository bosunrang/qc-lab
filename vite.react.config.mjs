import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: resolve('src/react/react-pilot.entry.tsx'),
      name: 'QCLabReact',
      formats: ['iife'],
      fileName: () => 'react-pilot.js',
    },
    outDir: 'assets/generated',
    emptyOutDir: false,
    /* Khác với modular-pilot.js/core.js (minify:false, để đọc/diff được code TỰ
       VIẾT) — react-pilot.js đóng gói cả React/ReactDOM (thư viện ngoài, ~1.4MB
       chưa nén), nên minify để giảm dung lượng VÀ để tránh false-positive ở
       tests/global-name-uniqueness.test.js (scanner quét theo dòng/cột kiểu code
       của app này, không phải parser JS thật — code React chưa nén có nhiều
       thuộc tính object trùng tên nằm ở cột 0 bị hiểu nhầm thành khai báo global
       trùng lặp). */
    minify: true,
    sourcemap: false,
  },
});

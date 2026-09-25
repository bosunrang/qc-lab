// Cấu hình ESLint cho QC Lab.
//
// typescript-eslint chưa hỗ trợ TypeScript 7, nên gói `typescript` trong
// package.json là bí danh của `@typescript/typescript6` (API TypeScript 6 cho
// công cụ), còn trình biên dịch `tsc` lấy từ `@typescript/native` (TS 7). Khi
// typescript-eslint hỗ trợ TS 7 thì bỏ bí danh này.
//
// Chỉ bật hai luật hooks kinh điển. Bộ "recommended" của eslint-plugin-react-hooks
// v7 còn kèm các luật dành cho React Compiler (purity, refs, set-state-in-effect…)
// mà app chưa dùng.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['app-dist/**', 'dist/**', 'node_modules/**', 'docs/**'] },
  {
    files: ['app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['app/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Gọi hook trong điều kiện/vòng lặp làm React trộn state giữa các lần render.
      'react-hooks/rules-of-hooks': 'error',
      // Effect/memo thiếu phụ thuộc thì trang giữ dữ liệu cũ. Để mức cảnh báo:
      // không phải chỗ nào thiếu cũng là lỗi, cần đọc từng chỗ.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

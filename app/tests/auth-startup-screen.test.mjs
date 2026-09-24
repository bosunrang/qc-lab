import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

test('mở QC Lab hiển thị form đăng nhập ngay, không chớp dòng tải thô', () => {
  const router = source('../renderer/router.tsx');
  const authStore = source('../renderer/store/auth-store.ts');

  assert.match(router, /if \(status === 'checking'\) return <LoginPage \/>;/);
  assert.doesNotMatch(router, />Đang tải…</);
  assert.match(authStore, /status: 'logged-out',/);
});



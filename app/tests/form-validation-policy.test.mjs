// Khoá quy tắc hiển thị lỗi biểu mẫu dùng chung để màn hình mới không quay
// lại kiểu dải đỏ ở đầu bảng: lỗi nhập nằm dưới ô, lỗi thao tác dùng dialog.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

test('CSS có một quy tắc chung cho viền, focus và lời nhắc lỗi', () => {
  const css = source('../renderer/styles/app.css');
  assert.match(css, /QUY TẮC LỖI BIỂU MẪU TOÀN APP/);
  assert.match(css, /\.field\{[^}]*align-self:start/s);
  assert.match(css, /\.field-row\{[^}]*align-items:flex-start/s);
  assert.match(css, /\.row-flex\{[^}]*align-items:flex-start/s);
  assert.match(css, /\.grid2\{[^}]*align-items:start/s);
  assert.match(css, /\.grid4\{[^}]*align-items:start/s);
  assert.match(css, /\.field-error\{[^}]*var\(--danger-text\)/s);
  assert.match(css, /\[aria-invalid="true"\][^}]*--focus-ring:var\(--danger-accent\)/s);
  assert.match(css, /input\[type="checkbox"\].*aria-invalid/s);
});

test('các lưới nhập liệu đặc thù căn từ trên khi một ô hiện lỗi', () => {
  const actions = source('../renderer/styles/pages/actions.css');
  const sigma = source('../renderer/styles/pages/sigma.css');
  const westgard = source('../renderer/styles/pages/westgard.css');
  for (const selector of ['nce-technical-input-grid', 'nce-impact-form-grid', 'nce-capa-risk-grid']) {
    assert.match(actions, new RegExp(`\\.${selector}\\{[^}]*align-items:start`, 's'));
  }
  assert.match(sigma, /\.sg-setup-heading \+ \.sg-control-row(?:,[^{]+)?\{[^}]*align-items:start/s);
  assert.match(westgard, /\.wg-test-picker\{[^}]*align-items:start/s);
});

test('hộp thoại hệ thống được gắn ở tầng gốc cho cả đăng nhập và kích hoạt', () => {
  assert.match(source('../renderer/main.tsx'), /<DialogHost\s*\/>/);
  assert.doesNotMatch(source('../renderer/components/AppShell.tsx'), /<DialogHost\s*\/>/);
});

test('các biểu mẫu đặc thù cũng theo quy tắc lỗi dưới ô', () => {
  const license = source('../renderer/components/SoftwareLicense.tsx');
  const report = source('../renderer/pages/ReportPage.tsx');
  const entry = source('../renderer/pages/entry/EntrySheet.tsx');
  const range = source('../renderer/pages/entry/RangeWorkflowModal.tsx');
  assert.match(license, /id="activation-error" className="field-error"/);
  assert.doesNotMatch(license, /id="activation-error" className="auth-err"/);
  assert.match(report, /id="report-range-error" className="field-error"/);
  assert.match(entry, /aria-invalid=\{!!error \|\| undefined\}/);
  assert.doesNotMatch(entry, /noteErr|pointErr/);
  assert.match(range, /<FormErrorMessage/);
  assert.doesNotMatch(range, /rangeSubmitError|alert rej/);
});

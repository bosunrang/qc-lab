import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css']);
const VIETNAMESE_DIACRITICS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/;

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === 'app-dist') return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return EXTENSIONS.has(path.slice(path.lastIndexOf('.'))) ? [path] : [];
  });
}

function isComment(line) {
  return /^\s*(?:\/\/|\/\*|\*(?:\s|\/|$))/.test(line);
}

function isTechnicalDirective(line) {
  return /^\s*\/\/(?:\/|\s*(?:eslint-|@ts-))/.test(line);
}

test('chú thích tiếng Việt phải dùng đầy đủ dấu', () => {
  const violations = [];
  for (const path of sourceFiles(ROOT)) {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (isComment(line) && /[A-Za-z]/.test(line) && !isTechnicalDirective(line) && !VIETNAMESE_DIACRITICS.test(line)) {
        violations.push(`${relative(ROOT, path)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(violations, [], `Chú thích tiếng Việt không dấu:\n${violations.join('\n')}`);
});

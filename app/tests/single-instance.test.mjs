import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('desktop launch reuses the existing QC Lab process', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../main/index.ts'), 'utf8');

  assert.match(source, /if \(!app\.requestSingleInstanceLock\(\)\) \{\s*app\.quit\(\);/);
  assert.match(source, /app\.on\('second-instance', showMainWindow\);/);
  assert.match(source, /function showMainWindow\(\): void \{[\s\S]*?win\.show\(\);[\s\S]*?win\.focus\(\);/);
});



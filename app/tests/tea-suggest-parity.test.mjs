// Gợi ý TEa khi thêm xét nghiệm (renderer, `lib/tea-suggest.ts`) phải dùng
// cùng quy tắc với main khi giải TEa cho Six Sigma (`resolveTea()`): ô ghi đè
// của phòng xét nghiệm để trống thì lấy giá trị mặc định của danh mục (kế
// hoạch kiến trúc F.1). Trước 2026-09-26, chỉ ghi đè Ricos là gợi ý mất CLIA
// của danh mục và chuyển sang Ricos, trong khi Sigma vẫn dùng CLIA.
//
// Nạp module renderer thật bằng `ssrLoadModule` của Vite, không chép lại mã.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);

const { resolveTea } = require('../../app-dist/main/domain/sigma-tea-core.js');
const { TEA_CATALOG } = require('../../app-dist/main/domain/tea-catalog.js');

const RENDERER = fileURLToPath(new URL('../renderer', import.meta.url));
let server;
let suggest;
before(async () => {
  server = await createServer({
    configFile: false, root: RENDERER, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
  });
  suggest = await server.ssrLoadModule('/lib/tea-suggest.ts');
});
after(() => server?.close());

const ref = (item, patch) => ({ id: `ref-${item.id}`, analyte_id: item.id, name: item.name, unit: item.unit, section: item.section, lab: null, lab_source: '', clia: null, ricos: null, ...patch });
const testOf = (item) => ({ name: item.name, tea_ref_key: item.id, unit: item.unit, tea: 0 });
/** TEa% mà main dùng cho một nguồn, theo đúng phần trăm của danh mục/ghi đè. */
const mainPercent = (item, refs, source) => {
  const catalogRow = TEA_CATALOG.find((row) => row.id === item.id);
  const resolvedRef = refs.find((row) => row.analyte_id === item.id);
  return source === 'clia' ? (resolvedRef?.clia ?? catalogRow.clia) : (resolvedRef?.ricos ?? catalogRow.ricos);
};

test('ghi đè một nguồn không làm mất giá trị mặc định của nguồn kia', () => {
  const withBoth = TEA_CATALOG.find((item) => item.clia != null && item.ricos != null);
  assert.ok(withBoth, 'danh mục có analyte mang cả CLIA và Ricos');
  const refs = [ref(withBoth, { ricos: 99 })];
  const suggestion = suggest.teaSuggestions(refs).find((row) => row.teaRefKey === withBoth.id);
  assert.equal(suggestion.teaSource, 'clia', 'CLIA của danh mục vẫn được ưu tiên');
  assert.equal(suggestion.tea, withBoth.clia);
  assert.equal(resolveTea(testOf(withBoth), refs, TEA_CATALOG, 'ricos').value, 99, 'main dùng Ricos ghi đè');

  const cliaOverride = [ref(withBoth, { clia: 7.5 })];
  assert.equal(suggest.teaSuggestions(cliaOverride).find((row) => row.teaRefKey === withBoth.id).tea, 7.5, 'ghi đè CLIA thì dùng số ghi đè');
});

test('trên toàn bộ danh mục, gợi ý trùng TEa% main giải khi chỉ ghi đè Ricos', () => {
  const refs = TEA_CATALOG.map((item) => ref(item, { ricos: 42 }));
  const suggestions = new Map(suggest.teaSuggestions(refs).map((row) => [row.teaRefKey, row]));
  for (const item of TEA_CATALOG) {
    const expectedClia = mainPercent(item, refs, 'clia');
    const expected = expectedClia != null ? expectedClia : mainPercent(item, refs, 'ricos');
    assert.equal(suggestions.get(item.id).tea, expected, `${item.id}: gợi ý lệch với TEa main giải`);
  }
});

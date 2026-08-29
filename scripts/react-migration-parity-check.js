'use strict';
/* Kiểm chứng tạm thời (xem docs/REACT-ADOPTION-PLAN.md, mục "Bước tiếp theo"):
   so khớp #main giữa bản React (đã chuyển) và bản HTML cổ điển (chưa xoá) của
   CÙNG một trang, trên CÙNG một state — trước khi cho phép xoá code cổ điển
   của trang đó. Ép window.QCLabReact.isReactPage(id) trả về false để buộc
   render() dùng lại pageMap()[id]() (bản cũ), so cấu trúc (thẻ/class/
   data-action/data-args/nội dung lá) với bản React đang chạy thật, rồi phục
   hồi lại đúng trạng thái React trước khi đóng trình duyệt. Không phải test
   trong npm test — chạy độc lập, xoá bỏ theo từng trang một khi bản cũ của
   trang đó đã bị xoá (không còn gì để so). */
const { openSeededSession } = require('./lib/seed-browser-session');

// Trang 'dash', 'audit', 'users', 'settings', 'manage', 'reagent', 'report' và
// 'sigma' đã qua parity check và code cũ đã bị xoá (2026-08-29, report/sigma
// 2026-08-30) — không còn gì để so nên bỏ khỏi danh sách. Thêm id trang mới
// vào đây khi đến lượt migrate, xoá lại khi code HTML cũ của trang đó bị dọn.
const PAGES_TO_CHECK = [];

// Trang 'manage' có 8 tab con (ManageUIState.manageTab) với thân trang khác
// nhau hoàn toàn — go('manage') mặc định chỉ vẽ tab 'instruments', nên khi
// còn kiểm chứng phải tự đổi tab rồi render() lại cho CẢ HAI bản (React và cổ
// điển) trước khi so, nếu không 7/8 tab sẽ không được kiểm chứng. Giữ lại
// SUB_TABS làm mẫu cho trang nhiều-tab tiếp theo (nếu có).
const SUB_TABS = {};

function signature(page) {
  return page.evaluate(() => {
    const main = document.getElementById('main');
    if (!main) return [];
    // Bỏ qua các div "display:contents" — đây là wrapper CỐ Ý của
    // dangerouslySetInnerHTML bên React (xem DashboardPage.tsx's <Head>), không
    // sinh box trong layout, không có ở bản HTML cũ; so nó vào sẽ lệch INDEX
    // toàn bộ phần còn lại một cách giả (không phải khác biệt nội dung thật).
    return [...main.querySelectorAll('*')].filter(el => el.getAttribute('style') !== 'display: contents;').map(el => {
      const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).sort().join(' ');
      const action = el.getAttribute('data-action') || '';
      const args = el.getAttribute('data-args') || '';
      const text = el.children.length === 0 ? (el.textContent || '').trim() : '';
      return `${el.tagName.toLowerCase()}|${cls}|${action}|${args}|${text}`;
    });
  });
}

// Khác biệt CÓ CHỦ ĐÍCH, đã rà soát thủ công (không phải bug) — mỗi trang chỉ
// thêm vào đây sau khi đã hiểu rõ và chấp nhận lý do, giống mẫu KNOWN trong
// tests/global-name-uniqueness.test.js. Xoá dòng của một trang khi trang đó
// không còn bản HTML cũ để so nữa.
const KNOWN_DIFFS = {};

function diffSignatures(reactSig, legacySig, pageId) {
  const known = KNOWN_DIFFS[pageId] || [];
  const max = Math.max(reactSig.length, legacySig.length);
  const mismatches = [];
  for (let i = 0; i < max; i++) {
    const react = reactSig[i] ?? '(thiếu)', legacy = legacySig[i] ?? '(thiếu)';
    if (react === legacy) continue;
    if (known.some(k => k.react === react && (k.legacyPattern ? k.legacyPattern.test(legacy) : k.legacy === legacy))) continue;
    mismatches.push({ index: i, react, legacy });
  }
  return mismatches;
}

// Vài trang có nội dung tính SAU khi #main đã vẽ xong (ví dụ trang 'reagent'
// trước khi xoá code cũ: rcCompute() tự vá trực tiếp #rcStats/#rcCrit/
// #rcVerdict/#rcScatter/#rcBland, không qua render()/React — bản React gọi
// nó qua useEffect ngay sau mount, nhưng render() ép về bản cổ điển ở đây
// KHÔNG tự gọi lại). Không gọi lại hàm tính thì bản cổ điển bị so sánh ở
// trạng thái "chưa tính" trong khi bản React đã tính xong — lệch giả, không
// phải khác biệt cấu trúc thật. Giữ POST_RENDER làm mẫu cho trang tiếp theo
// có cùng kiểu tính-sau-khi-vẽ; xoá dòng của một trang khi trang đó không
// còn bản HTML cũ để so nữa.
const POST_RENDER = {};

async function checkPage(page, id, subTab) {
  const settle = POST_RENDER[id];
  await page.evaluate((pageId) => { go(pageId); }, id);
  if (subTab) await page.evaluate((tab) => { ManageUIState.manageTab = tab; render(); }, subTab);
  if (settle) await page.evaluate(settle);
  await page.waitForTimeout(50);
  const reactSig = await signature(page);

  await page.evaluate(() => {
    window.__qcRealIsReactPage = window.QCLabReact.isReactPage;
    window.QCLabReact.isReactPage = () => false;
    render();
  });
  if (settle) await page.evaluate(settle);
  await page.waitForTimeout(50);
  const legacySig = await signature(page);

  await page.evaluate(() => {
    window.QCLabReact.isReactPage = window.__qcRealIsReactPage;
    delete window.__qcRealIsReactPage;
    render();
  });

  return diffSignatures(reactSig, legacySig, id);
}

async function main() {
  const session = await openSeededSession({ headless: true });
  const failures = [];
  try {
    for (const id of PAGES_TO_CHECK) {
      const subTabs = SUB_TABS[id] || [null];
      for (const subTab of subTabs) {
        const label = subTab ? `${id}/${subTab}` : id;
        const mismatches = await checkPage(session.page, id, subTab);
        if (mismatches.length) {
          failures.push(`Trang '${label}': ${mismatches.length} phần tử lệch giữa bản React và bản cũ:\n` +
            mismatches.slice(0, 20).map(m => `  [#${m.index}] react=${JSON.stringify(m.react)} legacy=${JSON.stringify(m.legacy)}`).join('\n'));
        } else {
          console.log(`Trang '${label}': khớp (${(await signature(session.page)).length} phần tử).`);
        }
      }
    }
  } finally {
    await session.close();
  }
  if (failures.length) {
    console.error('\nParity check THẤT BẠI:\n' + failures.join('\n\n'));
    process.exitCode = 1;
  } else {
    console.log('\nParity check: bản React và bản cổ điển khớp cấu trúc — an toàn để xoá code cũ.');
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });

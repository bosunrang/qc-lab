const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const router = read('assets/modules/router-render.js');
const modals = read('assets/modules/modals.js');
const components = read('assets/components.css');
const entryCss = read('assets/professional-entry.css');
const dashboardCss = read('assets/professional-dashboard.css');
const sigmaCss = read('assets/professional-sigma.css');
const actionsRoutes = read('assets/modules/actions-routes.js');
const indexHtml = read('index.html');
const cssFiles = fs.readdirSync(path.join(root, 'assets')).filter(name => name.endsWith('.css'));

assert.match(router, /role="tree" aria-label="Danh mục nội kiểm"/);
assert.match(router, /role="treeitem" tabindex="0" aria-expanded=/);
assert.match(router, /function entryTreeKey\(event\)/);
assert.match(router, /key==='ArrowDown'/);
assert.match(router, /aria-live="polite"/);
assert.match(router, /aria-current="\$\{id===page\?'page':'false'\}"/);
assert.match(router, /role="region" aria-label="Bảng nhập QC theo tháng" tabindex="0"/);

assert.match(modals, /setAttribute\('role','dialog'\)/);
assert.match(modals, /setAttribute\('aria-modal','true'\)/);
assert.match(modals, /event\.key==='Escape'/);
assert.match(modals, /event\.key!=='Tab'/);
assert.match(modals, /modalReturnFocus/);
assert.match(modals, /Đóng hộp thoại/);
assert.match(components, /:focus-visible/);
assert.match(components, /outline:2px solid var\(--focus-outline\);outline-offset:1px/);
assert.match(components, /outline:1px solid var\(--focus-outline\);outline-offset:0/);
assert.match(indexHtml, /<nav id="nav" aria-label="Điều hướng chính">/);
assert.match(indexHtml, /<main id="main" tabindex="-1">/);

assert.equal((entryCss.match(/!important/g) || []).length, 0, 'entry UI must not depend on !important');
assert.equal((dashboardCss.match(/!important/g) || []).length, 0, 'dashboard UI must not depend on !important');
assert.match(sigmaCss, /\.sg-eqa-table th\{[^}]*text-transform:none/);
assert.match(sigmaCss, /\.sg-eqa-summary span\{[^}]*text-transform:none/);
assert.match(actionsRoutes, /function reportActionIcon\(type\)/);
assert.match(actionsRoutes, /reportActionIcon\('print'\)/);
assert.match(actionsRoutes, /reportActionIcon\('excel'\)/);
assert.match(actionsRoutes, /reportActionIcon\('csv'\)/);
assert.match(actionsRoutes, /aria-hidden="true"/);

const canonicalWidths = new Set([640, 760, 900, 980, 1150, 1280]);
for (const file of cssFiles) {
  const css = read(`assets/${file}`);
  for (const match of css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)) {
    assert.ok(canonicalWidths.has(Number(match[1])), `${file} uses non-canonical max-width ${match[1]}px`);
  }
}

console.log('UI accessibility and responsive policy tests passed');

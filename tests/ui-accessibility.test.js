const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const router = read('assets/modules/router-render.js') + read('assets/modules/entry-routes.js');
const modals = read('assets/modules/modals.js');
const appCss = read('assets/app.css');
const auditCss = read('assets/professional-audit.css');
const tokens = read('assets/tokens.css');
const components = read('assets/components.css');
const configCss = read('assets/professional-config.css');
const entryCss = read('assets/professional-entry.css');
const dashboardCss = read('assets/professional-dashboard.css');
const sigmaCss = read('assets/professional-sigma.css');
const reagentCss = read('assets/professional-reagent.css');
const reportsCss = read('assets/professional-reports.css');
const settingsCss = read('assets/professional-settings.css');
const usersCss = read('assets/professional-users.css');
const westgardCss = read('assets/professional-westgard.css');
const actionsRoutes = read('assets/modules/actions-routes.js');
const reportRoutes = read('assets/modules/report-routes.js');
const westgardRoutes = read('assets/modules/westgard-routes.js');
const dashboardRoutes = read('assets/modules/dashboard-routes.js');
const indexHtml = read('index.html');
const cssFiles = fs.readdirSync(path.join(root, 'assets')).filter(name => name.endsWith('.css'));

const dialogZ=Number((/#dialogRoot \.modal-bg\{[^}]*z-index:(\d+)/.exec(components)||[])[1]);
const authZ=Number((/#authOverlay\{[^}]*z-index:(\d+)/.exec(components)||[])[1]);
assert.ok(dialogZ>authZ, 'dialog xác nhận phải nằm trên auth/recovery overlay');

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
// Icon nút của trang Báo cáo đi theo trang sang report-routes.js (tách 2026-07-30).
assert.match(reportRoutes, /function reportActionIcon\(type\)/);
assert.match(reportRoutes, /reportActionIcon\('print'\)/);
assert.match(reportRoutes, /aria-hidden="true"/);
assert.match(actionsRoutes, /aria-hidden="true"/);
assert.match(tokens, /--panel-content-gap:14px/);
assert.match(tokens, /--panel-header-min-height:44px/);
assert.match(tokens, /--subpanel-header-min-height:42px/);
assert.match(components, /h3:first-child\+\*,\.panel>\.row-flex:first-child\+\*\{margin-top:var\(--panel-content-gap\)\}/);
assert.match(components, /h3:first-child\+:is\(\.grid2,\.grid4,\.row-flex\)>div>label:first-child\{margin-top:0\}/);
assert.match(westgardCss, /\.wg-test-picker\{[^}]*margin:var\(--panel-content-gap\) 16px 0/);
assert.match(westgardCss, /\.wg-test-picker label\{\s*margin-top:0/);
assert.match(sigmaCss, /\.sg-data-head\{[^}]*min-height:var\(--panel-header-min-height\)/);
assert.match(sigmaCss, /\.sg-setup-heading\{[^}]*min-height:var\(--panel-header-min-height\)/);
assert.doesNotMatch(sigmaCss, /#sgTrend,\s*#sgMDC\{[^}]*border-top/);
assert.doesNotMatch(sigmaCss, /#sgTrend,\s*#sgMDC\{/);
assert.match(sigmaCss, /\.sg-chart-box > \.hint\{[^}]*padding:var\(--panel-content-gap\) 12px 0/);
assert.match(sigmaCss, /\.sg-chart-box \.chart-inner\{[^}]*padding:var\(--panel-content-gap\) 12px 12px/);
assert.match(sigmaCss, /\.sg-chart-box \.chart-inner > \.hint\{\s*padding:0/);
assert.match(sigmaCss, /\.sg-simple-table-wrap\{[^}]*margin:var\(--panel-content-gap\) 16px 12px/);
assert.match(dashboardCss, /margin:var\(--panel-content-gap\) 16px 14px/);
assert.match(dashboardRoutes, /<div class="dash-test-filterbar"><div class="dash-test-tabs">\$\{dashStatusTabs\}<\/div><div class="dash-test-search">/);
assert.match(dashboardCss, /\.dash-test-filterbar \.dash-test-search input\{\s*height:32px; min-height:32px;/);
assert.equal((dashboardCss.match(/\.dash-main \.alert\{/g)||[]).length,1,'dashboard alert styles must stay consolidated');
assert.match(entryCss, /\.qc-cumulative-note\{margin:var\(--panel-content-gap\) 16px 0\}/);
assert.match(entryCss, /\.lj-range\{\s*margin:var\(--panel-content-gap\) 16px 12px/);
assert.match(entryCss, /\.entry-secondary-summary:focus-visible\{\s*outline:2px solid var\(--focus-outline\)/);
assert.match(entryCss, /\.lj-mini \.chart-scroll canvas\.entryLJStack\{\s*width:100%; min-width:0;/);
assert.match(entryCss, /\.tree \.tn-config\{[^}]*font-size:var\(--type-body\)/);
assert.match(entryCss, /\.lj-qc-stat:not\(\.control\)\+\.lj-qc-stat\.control\{[^}]*border-left:2px solid/);
assert.match(entryCss, /\.lj-mini-h b\{[^}]*font-size:var\(--type-body\)/);
assert.match(entryCss, /\.lj-qc-stat \.v\{[^}]*font-size:var\(--type-body\)/);
assert.match(entryCss, /\.range-band-note\{\s*margin:12px 14px 0;/);
assert.doesNotMatch(entryCss, /\.tn-test \.lots|\.tnode \.lot|\.tnode \.label/);
assert.equal((entryCss.match(/\.lj-mini-h b\{/g)||[]).length,1,'entry chart heading styles must stay consolidated');
assert.equal((entryCss.match(/\.lj-qc-stat \.v\{/g)||[]).length,1,'entry chart metric value styles must stay consolidated');
assert.match(appCss, /\.admin-tools\{[^}]*margin:var\(--panel-content-gap\) 16px 16px/);
assert.match(auditCss, /\.audit-log-head\{[^}]*min-height:var\(--panel-header-min-height\)/);
assert.match(auditCss, /\.audit-filterbar\{[^}]*margin:var\(--panel-content-gap\) 16px 10px/);
assert.match(auditCss, /\.audit-table-wrap\{[^}]*overflow-x:auto/);
assert.match(configCss, /\.tea-source-registry\{[^}]*margin:var\(--panel-content-gap\) 16px 0/);
assert.match(sigmaCss, /margin:var\(--panel-content-gap\) 16px 0/);
assert.match(reagentCss, /padding:var\(--panel-content-gap\) 28px 26px/);
assert.match(reagentCss, /\.rc-toolbar\{[^}]*padding:0 16px/);
assert.match(reagentCss, /\.rc-toolbar-selcol\{[^}]*gap:6px/);
assert.match(reagentCss, /\.rc-toolbar-selcol label\{\s*margin:0/);
assert.match(reagentCss, /\.rc-stats-panel > h3:first-child \+ #rcStats,\s*\.rc-chart-panel > h3:first-child \+ \.rc-charts\{[^}]*padding:var\(--panel-content-gap\)/);
assert.match(reagentCss, /\.rc-chart-panel > \.rc-charts,[^}]*\.rc-stats-panel > #rcStats\{\s*margin:0 !important/);
assert.match(reportsCss, /padding:var\(--panel-content-gap\) 16px 16px/);
assert.match(reportsCss, /\.action-form-body label\{\s*margin-top:0/);
assert.match(settingsCss, /\.settings-unit-fields\{[^}]*margin:var\(--panel-content-gap\) 16px 0/);
assert.match(settingsCss, /\.settings-unit-fields label,\s*\.firebase-auth-grid label\{\s*margin-top:0/);
assert.match(settingsCss, /\.firebase-guide\{[^}]*margin:var\(--panel-content-gap\) 16px 0/);
assert.match(usersCss, /margin:var\(--panel-content-gap\) 16px 16px; padding:0/);
assert.match(usersCss, /\.user-create-fields\{[^}]*padding:var\(--panel-content-gap\) 18px 18px/);
assert.match(usersCss, /\.user-perm-block\{[^}]*padding:var\(--panel-content-gap\) 18px 18px/);
assert.match(usersCss, /\.user-perm-grid label\{[^}]*margin:0/);
assert.match(westgardCss, /\.wg-panel-intro\{\s*margin:var\(--panel-content-gap\) 16px 8px/);
assert.match(westgardCss, /\.wg-target-warning\{\s*margin:var\(--panel-content-gap\) 16px 0/);
assert.equal((westgardRoutes.match(/wg-panel-intro/g) || []).length, 3);
assert.equal((westgardRoutes.match(/wg-target-warning/g) || []).length, 1);

const canonicalWidths = new Set([640, 760, 900, 980, 1150, 1280]);
for (const file of cssFiles) {
  const css = read(`assets/${file}`);
  for (const match of css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)) {
    assert.ok(canonicalWidths.has(Number(match[1])), `${file} uses non-canonical max-width ${match[1]}px`);
  }
}

console.log('UI accessibility and responsive policy tests passed');

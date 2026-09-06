// Khung trang "Cấu hình chung": sidebar 8 tab + toolbar, mỗi tab một file
// trong ./manage (tách 2026-09-03; trước đó 6 tab nằm chung file này, 1121
// dòng). Phần dùng chung giữa các tab ở ./manage/shared.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { PageHeader } from '../components/PageHeader';
import { useWestgardStore } from '../store/westgard-store';
import { TEA_CATALOG } from '../data/tea-catalog';
import { TABS, type TabId } from './manage/shared';
import { HistoryTab } from './manage/HistoryTab';
import { TeaRefsTab } from './manage/TeaRefsTab';
import { InstrumentsTab } from './manage/InstrumentsTab';
import { TestsTab } from './manage/TestsTab';
import { PanelsTab } from './manage/PanelsTab';
import { LotsTab } from './manage/LotsTab';
import { TargetsTab } from './manage/TargetsTab';
import { TransitionsTab } from './manage/TransitionsTab';

export function ManagePage() {
  // Tổng quan bấm "Gán Mean/SD" thì mở sẵn tab Mean/SD, đúng `goManageTargets()`
  // của app cũ (mục còn treo từ Giai đoạn D2). Phân tích Westgard bấm "Mở cấu
  // hình xét nghiệm" (CUSUM chưa bật) thì mở sẵn tab Danh mục xét nghiệm VÀ
  // modal sửa đúng xét nghiệm đó, đúng `openConfigAssay(testId)` app cũ.
  const navState = useLocation().state as { tab?: TabId; editTestId?: string } | null;
  const [tab, setTab] = useState<TabId>(navState?.tab || 'instruments');
  const [instrumentCreateRequest, setInstrumentCreateRequest] = useState(0);
  const store = useManageStore();
  const { loadInstruments, loadTests, loadLots, loadLotGroups, loadPanels, loadLotTransitions, loadTeaRefs } = store;

  useEffect(() => {
    loadInstruments(); loadTests(); loadLots(); loadLotGroups();
    loadPanels(); loadLotTransitions(); loadTeaRefs();
  }, [loadInstruments, loadTests, loadLots, loadLotGroups, loadPanels, loadLotTransitions, loadTeaRefs]);

  useStoreInvalidation(['instruments'], undefined, store.loadInstruments);
  useStoreInvalidation(['tests'], undefined, store.loadTests);
  useStoreInvalidation(['qc_lots', 'lot_groups'], undefined, () => { store.loadLots(); store.loadLotGroups(); });
  useStoreInvalidation(['qc_panels', 'qc_panel_tests'], undefined, store.loadPanels);
  useStoreInvalidation(['lot_transitions'], undefined, store.loadLotTransitions);
  useStoreInvalidation(['tea_refs'], undefined, store.loadTeaRefs);

  // Đúng `counts` của app cũ (manage-page-controller.ts): tab Lô hiện
  // "số lô / số nhóm" dạng chuỗi, không phải 1 con số.
  const { summaries, loadSummaries } = useWestgardStore();
  useEffect(() => { loadSummaries(); }, [loadSummaries]);
  const allLevels = summaries.flatMap((summary) => summary.levels);
  const levelsWithLot = allLevels.filter((level) => level.qcLotId).length;
  const counts: Partial<Record<TabId, number | string>> = {
    instruments: store.instruments.length, tests: store.tests.length, panels: store.panels.length,
    lots: `${store.lots.length} / ${store.lotGroups.length}`, targets: levelsWithLot,
    transitions: store.lotTransitions.length,
    // App cũ: `tearefs: effectiveTeaRefs().length` — danh mục tích hợp CỘNG
    // các hồ sơ PXN tự thêm ngoài danh mục, KHÔNG cộng hồ sơ ghi đè lên một
    // analyte đã có trong danh mục (nếu không sẽ đếm trùng).
    tearefs: TEA_CATALOG.length + store.teaRefs.filter((ref) => !ref.analyte_id
      && !TEA_CATALOG.some((item) => item.name.trim().toLocaleLowerCase('vi') === ref.name.trim().toLocaleLowerCase('vi'))).length,
    // App cũ: mỗi mức góp `max(1, số mốc lịch sử)` — mức chưa có lịch sử vẫn
    // là 1 dòng "đang hiệu lực" trong bảng.
    history: store.tests.reduce((sum, test) => sum + (store.levelsByTestId[test.id] || []).reduce((inner, level) => {
      let past = 0;
      try { const parsed: unknown = JSON.parse(level.mean_sd_history_json || '[]'); past = Array.isArray(parsed) ? parsed.length : 0; } catch { past = 0; }
      return inner + Math.max(1, past);
    }, 0), 0),
  };

  return (
    <>
      <PageHeader title="Cấu hình chung" subtitle="Quản lý máy, Panel QC, lô QC, Mean/SD và luật QC" />
      <div className="config-shell">
        <aside className="config-shell-nav" aria-label="Danh mục cấu hình">
          <div className="rcfg-title">CẤU HÌNH CHUNG</div>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {/* App cũ luôn render `<small>` và để TRỐNG khi số đếm = 0
                  (`count: counts[id] || ''`) — app-v2 in số 0 nên sidebar có
                  thêm một dòng chữ "0" mà bản cũ không có. */}
              <b>{t.label}</b><small>{counts[t.id] || ''}</small>
            </button>
          ))}
        </aside>
        <section className="config-shell-main">
          {tab === 'instruments' && <InstrumentsTab createRequest={instrumentCreateRequest} onCreateRequestHandled={() => setInstrumentCreateRequest(0)} />}
          {tab === 'tests' && <TestsTab openTestId={navState?.editTestId} onNeedInstrument={() => {
            setInstrumentCreateRequest((value) => value + 1); setTab('instruments');
          }} />}
          {tab === 'panels' && <PanelsTab onGoTests={() => setTab('tests')} onGoInstruments={() => setTab('instruments')} />}
          {tab === 'lots' && <LotsTab />}
          {tab === 'targets' && <TargetsTab />}
          {tab === 'transitions' && <TransitionsTab onGoPanels={() => setTab('panels')} onGoLots={() => setTab('lots')} />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'tearefs' && <TeaRefsTab />}
        </section>
      </div>
    </>
  );
}

// App cũ dùng `.grid2` (lưới 2 cột dùng chung, 1 cột ở ≤760px) cho mọi hàng
// 2 ô trong modal — `.field-row` là tên app-v2 tự đặt, gate parity báo
// thiếu class `grid2` trong modal máy xét nghiệm/Panel QC vì vậy.
function FieldRow({ children }: { children: React.ReactNode }) { return <div className="grid2">{children}</div>; }

// ---------------- Máy xét nghiệm ----------------

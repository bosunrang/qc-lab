// Cây "Danh mục nội kiểm" của trang Nhập QC: máy → nhóm lô → xét nghiệm.
// Giữ riêng trạng thái tìm kiếm, lọc máy và nhánh đang mở, nên gõ vào ô tìm
// chỉ vẽ lại cây, không vẽ lại bảng nhập và biểu đồ.
import { memo, useEffect, useMemo, useState } from 'react';
import { handleTreeKeyDown } from '../../lib/entry-tree-navigation';
import { latestOf, type OperationalCatalog, type TreeVerdict } from './operational';
import type { Instrument, TestSummary } from '../../../shared/qc-api';

/** Nhãn ngắn dùng riêng cho cây điều hướng ('Loại', không phải 'Loại bỏ'). */
const TREE_STATE: Record<string, string> = { rej: 'Loại', warn: 'Cảnh báo', ok: 'Đạt', none: 'Chưa có' };

/** Cùng hình chevron và hướng xoay với nút thu gọn thanh điều hướng. */
export function TreeToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** Dấu mở/đóng của từng nhánh cây: SVG giữ nét +/− sắc, đối xứng và không
 * chịu ảnh hưởng baseline của font như ký tự văn bản. */
function TreeNodeToggleIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M3 8h10" />
      {!open && <path d="M8 3v10" />}
    </svg>
  );
}

export const EntryTree = memo(function EntryTree({ summaries, instruments, catalog, testId, treeCollapsed, onSelect, onCollapse }: {
  summaries: TestSummary[];
  instruments: Instrument[];
  catalog: OperationalCatalog;
  testId: string;
  treeCollapsed: boolean;
  onSelect: (testId: string) => void;
  onCollapse: () => void;
}) {
  const [machineFilter, setMachineFilter] = useState('');
  const [search, setSearch] = useState('');
  // Máy mặc định mở; chỉ giữ các máy người dùng đã chủ động thu gọn để cây
  // vẫn hiển thị đủ dữ liệu ngay lần đầu vào trang.
  const [closedMachines, setClosedMachines] = useState<Set<string>>(new Set());
  const [openTests, setOpenTests] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const bySearch = (s: TestSummary) => !search || s.testName.toLowerCase().includes(search.toLowerCase());
    const machines = new Map<string, Map<string, { name: string; tests: TestSummary[] }>>();
    for (const s of summaries) {
      if (!catalog.isOperationalTest(s)) continue;
      if (!bySearch(s)) continue;
      const inst = instruments.find((i) => i.name === s.instrumentName);
      if (machineFilter && inst?.id !== machineFilter) continue;
      const byGroup = machines.get(s.instrumentName) || new Map();
      const g = catalog.lotGroupOf(s);
      const bucket = byGroup.get(g.key) || { name: g.name, tests: [] as TestSummary[] };
      bucket.tests.push(s); byGroup.set(g.key, bucket); machines.set(s.instrumentName, byGroup);
    }
    return Array.from(machines.entries()).map(([machine, byGroup]) => [machine, Array.from(byGroup.entries())] as const);
  }, [summaries, search, machineFilter, instruments, catalog]);

  // Xét nghiệm đang chọn và nhóm lô đang MỞ là hai trạng thái độc lập:
  // người dùng vẫn cần thu gọn được nhóm chứa xét nghiệm đang xem. Bản đầu
  // vô tình dùng `testId` để ép nhóm đó mở mãi, nên bấm dấu − không có tác
  // dụng. Khi chọn một xét nghiệm (kể cả khi mở trang từ Dashboard), chỉ
  // mở nhóm chứa nó một lần; sau đó nút nhóm toàn quyền đóng/mở.
  useEffect(() => {
    if (!testId) return;
    setOpenTests((current) => {
      for (const [, groups] of tree) {
        for (const [groupKey, group] of groups) {
          if (group.tests.some((test) => test.testId === testId)) {
            if (current.has(groupKey)) return current;
            return new Set(current).add(groupKey);
          }
        }
      }
      return current;
    });
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tree" id="entryTreePanel">
      <div className="entry-tree-head">
        <h4>Danh mục nội kiểm</h4>
        <button type="button" className="btn ghost entry-tree-toggle" onClick={onCollapse}
          title="Ẩn danh mục nội kiểm" aria-label="Ẩn danh mục nội kiểm" aria-controls="entryTreePanel" aria-expanded={!treeCollapsed}><TreeToggleIcon /></button>
      </div>
      <div className="tree-tools">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm test, máy..." />
        <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
          <option value="">Tất cả máy</option>
          {instruments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div role="tree">
        {tree.map(([machine, groups]) => {
          const machineKey = `machine:${machine}`;
          const machineOpen = !closedMachines.has(machineKey);
          return (
          <div key={machine}>
            <div className="tnode tn-machine" role="treeitem" aria-expanded={machineOpen}
              tabIndex={0} onKeyDown={handleTreeKeyDown}
              onClick={() => setClosedMachines((current) => { const next = new Set(current); next.has(machineKey) ? next.delete(machineKey) : next.add(machineKey); return next; })}>
              <span className="caret" aria-hidden="true"><TreeNodeToggleIcon open={machineOpen} /></span>{machine}
            </div>
            {machineOpen && groups.map(([groupKey, group]) => {
              const open = openTests.has(groupKey);
              const rank = { none: -1, ok: 0, warn: 1, rej: 2 } as const;
              const groupWorst = group.tests.reduce<TreeVerdict>((acc, s) => rank[latestOf(s)] > rank[acc] ? latestOf(s) : acc, 'none');
              return (
                <div key={groupKey}>
                  <div className={`tnode tn-test${open ? ' open' : ''}`} role="treeitem" aria-expanded={open}
                    tabIndex={0} onKeyDown={handleTreeKeyDown}
                    onClick={() => setOpenTests((s) => { const next = new Set(s); next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey); return next; })}>
                    <span className="caret" aria-hidden="true"><TreeNodeToggleIcon open={open} /></span>{group.name}
                    <span className={`tag ${groupWorst}`}>{TREE_STATE[groupWorst]}</span>
                  </div>
                  {open && group.tests.map((s) => {
                    const state = latestOf(s);
                    return (
                      <div key={s.testId} className={`tnode tn-config${testId === s.testId ? ' on' : ''}`} role="treeitem"
                        tabIndex={0} onKeyDown={handleTreeKeyDown}
                        aria-current={testId === s.testId ? 'true' : 'false'} onClick={() => onSelect(s.testId)}>
                        <span className="config-name">{s.testName}</span>
                        <span className={`tag ${state}`}>{TREE_STATE[state]}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          );
        })}
        {!tree.length && <div className="tree-empty">Không có xét nghiệm phù hợp.</div>}
      </div>
    </div>
  );
});

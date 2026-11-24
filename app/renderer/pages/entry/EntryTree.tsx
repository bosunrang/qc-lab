// Cây "Danh mục nội kiểm" của trang Nhập QC: máy → nhóm lô → xét nghiệm.
// Giữ riêng trạng thái tìm kiếm, lọc máy và nhánh đang mở, nên gõ vào ô tìm
// chỉ vẽ lại cây, không vẽ lại bảng nhập và biểu đồ.
import { memo, useMemo, useRef, useState } from 'react';
import { ResizeHandle, useStoredWidth } from '../../components/ResizeHandle';
import { handleTreeKeyDown } from '../../lib/entry-tree-navigation';
import { normalizeSearch } from '../../lib/useTestSelection';
import { useEntryStore } from '../../store/entry-store';
import { latestOf, type OperationalCatalog, type TreeVerdict } from './operational';
import type { Instrument, TestSummary } from '../../../shared/qc-api';

/** Nhãn ngắn dùng riêng cho cây điều hướng ('Loại', không phải 'Loại bỏ'). */
const TREE_STATE: Record<string, string> = { rej: 'Loại', warn: 'Cảnh báo', ok: 'Đạt', none: 'Chưa có' };

/** Khoảng kéo được, cùng giới hạn với danh sách ở Phân tích ngoại kiểm. */
const TREE_MIN_WIDTH = 280;
const TREE_MAX_WIDTH = 480;

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
  onSelect: (summary: TestSummary) => void;
  onCollapse: () => void;
}) {
  const [machineFilter, setMachineFilter] = useState('');
  const [search, setSearch] = useState('');
  const closedMachines = useEntryStore((s) => s.closedTreeMachines);
  const openGroups = useEntryStore((s) => s.openTreeGroups);
  const toggleMachine = useEntryStore((s) => s.toggleTreeMachine);
  const toggleGroup = useEntryStore((s) => s.toggleTreeGroup);
  // Chưa kéo thì cây tự giãn theo tên dài nhất (CSS `width:max-content`);
  // kéo rồi thì giữ độ rộng người dùng chọn, tối đa 42% bề ngang trang lúc
  // kéo và 36vw khi cửa sổ thu hẹp sau đó, để bảng nhập không bị ép (U26).
  const treeRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useStoredWidth('qclab.entryTreeWidth');
  const treeMaxNow = () => Math.min(TREE_MAX_WIDTH, (treeRef.current?.parentElement?.parentElement?.clientWidth ?? 1000) * 0.42);
  function resizeTree(next: number) {
    setWidth(Math.round(Math.max(TREE_MIN_WIDTH, Math.min(next, treeMaxNow()))));
  }

  const tree = useMemo(() => {
    // Tìm không dấu, theo cả tên xét nghiệm lẫn tên máy (placeholder hứa "Tìm xét nghiệm, máy…").
    const needle = normalizeSearch(search);
    const bySearch = (s: TestSummary) => !needle || normalizeSearch(`${s.testName} ${s.instrumentName}`).includes(needle);
    const machines = new Map<string, { name: string; groups: Map<string, { name: string; tests: TestSummary[] }> }>();
    for (const s of summaries) {
      if (!bySearch(s)) continue;
      const machineKey = catalog.machineKeyOf(s);
      if (machineFilter && machineKey !== machineFilter) continue;
      const machine = machines.get(machineKey) ?? { name: s.instrumentName, groups: new Map() };
      const g = catalog.lotGroupOf(s);
      const bucket = machine.groups.get(g.key) ?? { name: g.name, tests: [] };
      bucket.tests.push(s);
      machine.groups.set(g.key, bucket);
      machines.set(machineKey, machine);
    }
    return Array.from(machines);
  }, [summaries, search, machineFilter, catalog]);

  return (
    <div className="entry-tree-dock">
      <div className="tree" id="entryTreePanel" ref={treeRef} style={width ? { width, maxWidth: '36vw' } : undefined}>
        <div className="entry-tree-head">
          <h4>Danh mục nội kiểm</h4>
          <button type="button" className="btn ghost entry-tree-toggle" onClick={onCollapse}
            title="Ẩn danh mục nội kiểm" aria-label="Ẩn danh mục nội kiểm" aria-controls="entryTreePanel" aria-expanded={!treeCollapsed}><TreeToggleIcon /></button>
        </div>
        <div className="tree-tools">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm xét nghiệm, máy…" aria-label="Tìm xét nghiệm hoặc máy trong danh mục" />
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} aria-label="Lọc danh mục theo máy">
            <option value="">Tất cả máy</option>
            {instruments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div role="tree">
          {tree.map(([machineKey, machine]) => {
            const machineOpen = !closedMachines.has(machineKey);
            return (
            <div key={machineKey}>
              <div className="tnode tn-machine" role="treeitem" aria-expanded={machineOpen}
                tabIndex={0} onKeyDown={handleTreeKeyDown}
                onClick={() => toggleMachine(machineKey)}>
                <span className="caret" aria-hidden="true"><TreeNodeToggleIcon open={machineOpen} /></span>{machine.name}
              </div>
              {machineOpen && Array.from(machine.groups, ([groupKey, group]) => {
                const open = openGroups.has(groupKey);
                const rank = { none: -1, ok: 0, warn: 1, rej: 2 } as const;
                const groupWorst = group.tests.reduce<TreeVerdict>((acc, s) => rank[latestOf(s)] > rank[acc] ? latestOf(s) : acc, 'none');
                return (
                  <div key={groupKey}>
                    <div className={`tnode tn-test${open ? ' open' : ''}`} role="treeitem" aria-expanded={open}
                      tabIndex={0} onKeyDown={handleTreeKeyDown}
                      onClick={() => toggleGroup(groupKey)}>
                      <span className="caret" aria-hidden="true"><TreeNodeToggleIcon open={open} /></span>{group.name}
                      <span className={`tag ${groupWorst}`}>{TREE_STATE[groupWorst]}</span>
                    </div>
                    {open && group.tests.map((s) => {
                      const state = latestOf(s);
                      return (
                        <div key={s.testId} className={`tnode tn-config${testId === s.testId ? ' on' : ''}`} role="treeitem"
                          tabIndex={0} onKeyDown={handleTreeKeyDown}
                          aria-current={testId === s.testId ? 'true' : 'false'} onClick={() => onSelect(s)}>
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
      <ResizeHandle targetRef={treeRef} label="Độ rộng danh mục nội kiểm" value={width}
        min={TREE_MIN_WIDTH} max={TREE_MAX_WIDTH} maxNow={treeMaxNow} onResize={resizeTree} />
    </div>
  );
});

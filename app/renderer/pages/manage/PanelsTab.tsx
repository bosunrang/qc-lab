// Tab "PanelsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
import { useMemo, useState } from 'react';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, infoDialog } from '../../state/dialog-store';
import { EmptyState } from './shared';
import type { QcPanel } from '../../../shared/qc-api';

export function PanelsTab({ onGoTests, onGoInstruments }: { onGoTests?: () => void; onGoInstruments?: () => void } = {}) {
  const { panels, instruments, tests, savePanel, removePanel } = useManageStore();


  async function removePanelRow(panel: QcPanel) {
    const ok = await confirmDialog(`Xóa Panel QC ${panel.name}? Các xét nghiệm vẫn được giữ nguyên.`, {
      title: 'Xóa Panel QC', confirmLabel: 'Xóa Panel QC', cancelLabel: 'Hủy', danger: true,
    });
    if (!ok) return;
    const result = await removePanel(panel.id);
    if (!result.ok) await infoDialog(result.error.message, { title: 'Chưa xóa được Panel QC' });
  }

  const [editing, setEditing] = useState<QcPanel | 'new' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // hệ thống tự chọn MÁY ĐẦU TIÊN khi mở modal Panel QC (`openConfigPanel`),
  // nên danh sách xét nghiệm hiện ngay; app để rỗng thì modal chỉ hiện
  // "Chọn máy để hiện danh sách xét nghiệm" — cùng lớp lỗi "không tự chọn
  // mục đầu tiên" đã gặp ở Entry/Sigma/Westgard/Reagent.
  const [instrumentId, setInstrumentId] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  async function openNew() {
    if (!tests.length) { await infoDialog('Hãy tạo xét nghiệm trước khi tạo Panel QC.'); onGoTests?.(); return; }
    if (!instruments.length) { await infoDialog('Hãy tạo máy xét nghiệm trước khi tạo Panel QC.'); onGoInstruments?.(); return; }
    setErr(null); setInstrumentId(instruments[0] ? instruments[0].id : ''); setChecked(new Set()); setEditing('new');
  }
  function openEdit(p: QcPanel) {
    setErr(null); setInstrumentId(p.instrument_id); setChecked(new Set(p.testIds)); setEditing(p);
  }
  const visibleTests = useMemo(() => tests.filter((t) => t.instrument_id === instrumentId), [tests, instrumentId]);
  const visiblePanels = panels.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  const [shownTestId, setShownTestId] = useState<Record<string, string>>({});
  /** Xét nghiệm của panel, GIỮ NGUYÊN thứ tự đã lưu trong `testIds`.
   *
   * KHÔNG sắp theo tên. Bản đầu (2026-09-13) có `sort` theo a–z với lý do
   * "thứ tự tick lúc tạo không có nghĩa gì" — sai: người dùng tick Na/K/Cl
   * đúng thứ tự trả kết quả của bảng điện giải, sắp a–z biến nó thành
   * Cl/K/Na. Thứ tự trong panel là thứ tự người dùng đặt; đừng sắp lại. */
  const panelTests = (panel: QcPanel): { id: string; name: string }[] => panel.testIds
    // Xét nghiệm đã bị xoá mà panel còn trỏ tới: hiện id thay vì bỏ dòng, để
    // người dùng thấy panel đang thừa một mục cần dọn.
    .map((id) => { const test = tests.find((t) => t.id === id); return { id, name: test ? test.name : id }; });

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const data = { name: String(fd.get('name') || ''), instrumentId, active: fd.get('active') === 'on', testIds: Array.from(checked) };
    const id = editing !== 'new' && editing ? editing.id : undefined;
    const result = await savePanel(id, data);
    if (!result.ok) { setErr(result.error.message); return; }
    setEditing(null);
  }

  return (
    <>
        <div className="rcfg-toolbar">
          <div><h2>Panel QC</h2><p>Nhóm các xét nghiệm theo từng máy để thiết lập và quản lý QC.</p></div>
          <div className="rcfg-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên panel QC, máy và xét nghiệm..." />
            <button className="btn teal" onClick={openNew}>＋ Thêm Panel QC</button>
          </div>
      </div>
      <div className="panel rcfg-list">
        {!panels.length ? <EmptyState title="Chưa có Panel QC">Tạo Panel QC sau khi đã có máy và xét nghiệm để bắt đầu thiết lập lô QC.</EmptyState>
          : !visiblePanels.length ? <EmptyState title="Không tìm thấy Panel QC">Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc hiện tại.</EmptyState>
          : <table className="panel-qc-table">
            <thead><tr><th>Tên panel</th><th>Máy xét nghiệm</th><th>Xét nghiệm trong panel</th><th>Số vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {visiblePanels.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{instruments.find((i) => i.id === p.instrument_id)?.name || '—'}</td>
                  <td>{(() => {
                    const rows = panelTests(p);
                    if (!rows.length) return <span className="cell-missing">Chưa chọn xét nghiệm</span>;
                    const shown = rows.find((t) => t.id === shownTestId[p.id]) || rows[0];
                    return <select className="panel-test-select" value={shown.id} aria-label={`Xem các xét nghiệm trong Panel QC ${p.name}`}
                      onChange={(event) => setShownTestId((current) => ({ ...current, [p.id]: event.target.value }))}>
                      {rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>;
                  })()}</td>
                  <td className="num">{p.testIds.length}</td>
                  <td><span className={`tag ${p.active ? 'ok' : 'none'}`}>{p.active ? 'Đang dùng' : 'Ngừng'}</span></td>
                  <td><div className="manage-actions"><RowActionButton kind="edit" label={`Sửa Panel QC ${p.name}`} onClick={() => openEdit(p)} /><RowActionButton kind="delete" label={`Xóa Panel QC ${p.name}`} onClick={() => removePanelRow(p)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>}
        {editing && (
          <Modal title={editing === 'new' ? 'Thêm Panel QC' : 'Sửa Panel QC'} onClose={() => setEditing(null)} size="lg" className="rcfg-modal"
            footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Hủy</button><button className="btn teal" type="submit" form="panel-form">{editing === 'new' ? 'Thêm Panel QC' : 'Lưu thay đổi'}</button></>}>
            <form id="panel-form" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              {err && <p className="field-error">{err}</p>}
              <div className="grid2 panel-qc-main-grid">
                <div className="field"><label>Tên Panel QC</label><input name="name" placeholder="VD: Sinh hóa AU5800" defaultValue={editing !== 'new' ? editing.name : ''} autoFocus /></div>
                <div className="field">
                  <label>Máy xét nghiệm</label>
                  <select value={instrumentId} onChange={(e) => {
                    const nextId = e.target.value;
                    setInstrumentId(nextId);
                    // hệ thống (`PanelModal.tsx`): checkbox không kiểm soát, list xét
                    // nghiệm remount theo máy — đổi máy rồi đổi LẠI đúng máy ban đầu
                    // thì `testIds` gốc của Panel tự phục hồi (vì initialInstrumentId
                    // khớp lại). Bản trước LUÔN xoá sạch `checked` ở mọi lần đổi máy,
                    // kể cả đổi lại đúng máy cũ — người dùng lỡ tay đổi máy rồi đổi lại
                    // sẽ mất hết lựa chọn đã lưu, phải tick lại từ đầu. Chỉ xoá khi máy
                    // MỚI khác máy gốc của Panel đang sửa; khi tạo mới (không có máy
                    // gốc) vẫn luôn xoá như cũ.
                    setChecked(editing !== 'new' && editing && nextId === editing.instrument_id ? new Set(editing.testIds) : new Set());
                  }}>
                    {instruments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              </div>
              <label className="panel-test-label">Chọn xét nghiệm trong panel</label>
              <div className="panel-test-picker group-lot-picker">
                {instrumentId && !visibleTests.length && <EmptyState size="compact">Máy này chưa có xét nghiệm.</EmptyState>}
                {visibleTests.map((t) => (
                  <label key={t.id}>
                    <input type="checkbox" checked={checked.has(t.id)} onChange={(e) => {
                      setChecked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(t.id); else next.delete(t.id); return next; });
                    }} />
                    <span><b>{t.name}</b><small>{instruments.find((i) => i.id === t.instrument_id)?.name || '—'} · {t.unit || 'Chưa có đơn vị'}</small></span>
                  </label>
                ))}
              </div>
              <label className="rcfg-check panel-active"><input type="checkbox" name="active" defaultChecked={editing === 'new' || editing.active === 1} /> Panel đang sử dụng</label>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}

// ---------------- Lô & nhóm lô QC ----------------



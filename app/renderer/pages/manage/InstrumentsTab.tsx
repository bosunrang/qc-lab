// Tab "InstrumentsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
import { useEffect, useState } from 'react';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, infoDialog } from '../../state/dialog-store';
import { EmptyState, FieldRow } from './shared';
import type { Instrument } from '../../../shared/qc-api';

export function InstrumentsTab({ createRequest = 0, onCreateRequestHandled }: { createRequest?: number; onCreateRequestHandled?: () => void } = {}) {
  const { instruments, tests, panels, saveInstrument, removeInstrument } = useManageStore();
  const [editing, setEditing] = useState<Instrument | 'new' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  function openNew() { setErr(null); setEditing('new'); }
  useEffect(() => {
    if (createRequest <= 0) return;
    openNew(); onCreateRequestHandled?.();
  }, [createRequest]);
  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const data = {
      name: String(fd.get('name') || ''), manufacturer: String(fd.get('manufacturer') || ''),
      // hệ thống không hiển thị trường Model trong popup này. Giữ lại giá trị
      // đã lưu khi sửa để không làm mất dữ liệu cũ chỉ vì form không có ô đó.
      model: editing !== 'new' && editing ? editing.model : '', serial: String(fd.get('serial') || ''),
      section: String(fd.get('section') || ''), active: fd.get('active') === 'on',
    };
    const id = editing !== 'new' && editing ? editing.id : undefined;
    const result = await saveInstrument(id, data);
    if (!result.ok) { setErr(result.error.message); return; }
    setEditing(null);
  }
  async function remove(i: Instrument) {
    if (!(await confirmDialog(`Xoá máy xét nghiệm "${i.name}"?`, { danger: true }))) return;
    const result = await removeInstrument(i.id);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }
  const visible = instruments.filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase()) || i.manufacturer.toLowerCase().includes(query.toLowerCase()) || i.serial.toLowerCase().includes(query.toLowerCase()));
  const testCountOf = (id: string) => tests.filter((t) => t.instrument_id === id).length;
  const panelCountOf = (id: string) => panels.filter((p) => p.instrument_id === id).length;

  return (
    <>
        <div className="rcfg-toolbar">
          <div><h2>Danh sách máy</h2><p>Quản lý máy xét nghiệm, hãng và số sê-ri.</p></div>
          <div className="rcfg-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên máy, hãng, số sê-ri…" />
            <button className="btn teal" onClick={openNew}>＋ Thêm máy xét nghiệm</button>
          </div>
      </div>
      <div className="panel rcfg-list">
        {!instruments.length ? <EmptyState title="Chưa có máy xét nghiệm">Thêm máy xét nghiệm đầu tiên để bắt đầu cấu hình QC.</EmptyState>
          : !visible.length ? <EmptyState title="Không tìm thấy máy xét nghiệm">Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc hiện tại.</EmptyState>
          : <table className="instrument-table">
            <thead><tr><th>Máy xét nghiệm</th><th>Khoa</th><th>Nhà sản xuất</th><th>Số sê-ri</th><th className="num">Xét nghiệm</th><th className="num">Panel</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.name}</b></td>
                  <td>{i.section || <span className="cell-missing">Chưa phân khoa</span>}</td>
                  <td>{i.manufacturer || <span className="cell-missing">Chưa khai</span>}</td>
                  <td>{i.serial || <span className="cell-missing">Chưa khai</span>}</td>
                  <td className="num">{testCountOf(i.id)}</td>
                  <td className="num">{panelCountOf(i.id)}</td>
                  <td><span className={`tag instrument-status ${i.active ? 'ok' : 'none'}`}>{i.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
                  <td><div className="manage-actions"><RowActionButton kind="edit" label={`Sửa máy ${i.name}`} onClick={() => { setErr(null); setEditing(i); }} /><RowActionButton kind="delete" label={`Xóa máy ${i.name}`} onClick={() => remove(i)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>}
        {editing && (
          <Modal title={editing === 'new' ? 'Thêm máy xét nghiệm' : 'Sửa máy xét nghiệm'} onClose={() => setEditing(null)} size="lg" className="rcfg-modal"
            footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Hủy</button><button className="btn teal" type="submit" form="instrument-form">{editing === 'new' ? 'Thêm máy xét nghiệm' : 'Lưu thay đổi'}</button></>}>
            <form id="instrument-form" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              {err && <p className="field-error">{err}</p>}
              <FieldRow>
                <div className="field"><label>Tên hiển thị</label><input name="name" placeholder="VD: AU5800-01" defaultValue={editing !== 'new' ? editing.name : ''} autoFocus /></div>
                <div className="field"><label>Khoa / Khu vực</label><input name="section" placeholder="Hóa sinh" defaultValue={editing !== 'new' ? editing.section : ''} /></div>
              </FieldRow>
              <FieldRow>
                <div className="field"><label>Nhà sản xuất</label><input name="manufacturer" placeholder="Beckman Coulter" defaultValue={editing !== 'new' ? editing.manufacturer : ''} /></div>
                <div className="field"><label>Số sê-ri</label><input name="serial" defaultValue={editing !== 'new' ? editing.serial : ''} /></div>
              </FieldRow>
              <label className="rcfg-check instrument-active">
                <input type="checkbox" name="active" defaultChecked={editing === 'new' || editing.active === 1} /> Máy đang hoạt động
              </label>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}

// ---------------- Danh mục xét nghiệm ----------------



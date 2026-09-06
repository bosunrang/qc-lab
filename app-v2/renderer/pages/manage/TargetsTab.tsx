// Tab "TargetsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
import { useEffect, useMemo, useState } from 'react';
import { useManageStore } from '../../store/manage-store';
import { confirmDialog, reauthDialog, infoDialog } from '../../state/dialog-store';
import { normalizeTargetPick, syncTargetRange } from '../../lib/target-range';
import { EmptyState } from './shared';
import type { QcPanel } from '../../../shared/qc-api';

export function TargetsTab() {
  const { tests, lots, panels, lotGroups: allLotGroups, instruments, levelsByTestId, loadLevels, saveTestLevel } = useManageStore();
  // Nhóm lô "Đã lưu trữ" (`active===0`)/"Đã dừng" (`status==='stopped'`)
  // không còn là nơi gán Mean/SD hợp lý — người dùng yêu cầu ẩn khỏi bảng
  // chọn của tab này (khác tab "Lô & Nhóm QC", nơi vẫn cần thấy MỌI nhóm để
  // quản lý/kích hoạt lại). "Dự kiến"/"Chưa dùng" vẫn hiện vì đây chính là
  // nơi gán Mean/SD lần đầu cho một nhóm mới.
  const lotGroups = allLotGroups.filter((group) => group.active !== 0 && group.status !== 'stopped');
  const [panelId, setPanelId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [level, setLevel] = useState(1);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const panel = panels.find((item) => item.id === panelId);
  const panelTests = tests.filter((test) => panel?.testIds.includes(test.id) && (!query || test.name.toLowerCase().includes(query.toLowerCase())));

  useEffect(() => { if (!panelId && panels.length) setPanelId(panels[0].id); }, [panelId, panels]);
  useEffect(() => {
    if (lotGroups.length && !lotGroups.some((group) => group.id === groupId)) setGroupId(lotGroups[0].id);
  }, [groupId, lotGroups]);
  useEffect(() => { panel?.testIds.forEach((id) => loadLevels(id)); }, [panel, loadLevels]);

  const selectedGroup = lotGroups.find((item) => item.id === groupId);
  const groupLots = useMemo(
    () => lots.filter((lot) => !selectedGroup || selectedGroup.lotIds.includes(lot.id)),
    [lots, selectedGroup],
  );
  /** Các mức QC lấy từ CHÍNH các lô của nhóm lô đang chọn — port
   * `targetLevelSelection(groupLots, …)` app cũ. Trước 2026-09-03 app-v2 lấy
   * từ những mức ĐÃ TỒN TẠI trong `test_levels`, mà xét nghiệm mới chỉ được
   * tạo sẵn Mức 1 — nên nhóm lô 2 mức vẫn chỉ hiện tab "Mức 1" và không có
   * đường nào nhập Mean/SD cho Mức 2 (bẫy con-gà-quả-trứng). */
  const groupLevels = useMemo(() => [...new Set(groupLots.map((lot) => lot.level).filter((value) => Number.isFinite(value)))]
    .sort((left, right) => left - right), [groupLots]);
  const levelLots = groupLots.filter((lot) => lot.level === level);
  // Mức đang chọn phải luôn nằm trong các mức của nhóm lô (app cũ:
  // `targetLevelSelection()` tự rơi về mức đầu tiên khi mức hiện tại không
  // còn hợp lệ, ví dụ vừa đổi sang nhóm lô chỉ có Mức 2).
  useEffect(() => {
    if (!groupLevels.length) return;
    if (!groupLevels.includes(level)) setLevel(groupLevels[0]);
  }, [groupLevels, level]);

  const rows = panelTests.map((test) => ({ test, target: (levelsByTestId[test.id] || []).find((item) => item.level === level) }));
  const linked = rows.filter(({ target }) => target?.qc_lot_id && groupLots.some((lot) => lot.id === target.qc_lot_id)).length;
  const other = rows.filter(({ target }) => target?.qc_lot_id && !groupLots.some((lot) => lot.id === target.qc_lot_id)).length;
  const empty = rows.filter(({ target }) => !target?.qc_lot_id).length;
  const missing = rows.filter(({ target }) => target?.mean == null || target?.sd == null || target.sd <= 0).length;

  /** Bỏ tick 1 hàng thì khoá luôn 4 ô số của hàng đó (port
   * `toggleTargetRow()` app cũ) — người dùng thấy ngay hàng nào sẽ không được
   * lưu, thay vì phải nhớ. */
  function toggleTargetRow(box: HTMLInputElement) {
    const row = box.closest('.target-row');
    if (!row) return;
    row.querySelectorAll<HTMLInputElement>('.tm-mean,.tm-low,.tm-high,.tm-sd')
      .forEach((input) => { input.disabled = !box.checked; });
  }

  function targetCheckAll(on: boolean) {
    document.querySelectorAll<HTMLInputElement>('.target-table .tm-use').forEach((box) => {
      if (box.disabled) return;
      box.checked = on;
      toggleTargetRow(box);
    });
  }

  /** Lưu cả mức: đọc DOM từng hàng đang tick → chuẩn hoá qua
   * `normalizeTargetPick()` (cùng công thức/câu chữ app cũ) → nếu có hàng
   * đang gắn LÔ KHÁC thì hỏi trước (app cũ mở modal "chuyển lô") → xác thực
   * lại mật khẩu → ghi từng mức qua `config:saveTestLevel` (chính handler đó
   * tự chốt Mean/SD cũ vào `mean_sd_history_json`).
   *
   * KHÁC app cũ có chủ đích: app cũ còn "điền lô/Mean-SD cho điểm QC cũ chưa
   * ghi lô" (`targetPickBackfillPoints`) và hỏi thêm nếu việc đó đụng kỳ đã
   * khoá. app-v2 KHÔNG cần: từ Giai đoạn B2, `entry:addPoint` đã chốt
   * `qc_mean`/`qc_sd`/`lot` vào từng điểm ngay lúc nhập, nên không có điểm
   * nào thiếu lô để phải điền bù. */
  async function saveTargetMatrix() {
    const rowEls = [...document.querySelectorAll<HTMLElement>('.target-table .target-row')];
    const picked: { testId: string; level: number; mean: number; sd: number; low: number | null; high: number | null; qcLotId: string; name: string; switching: boolean }[] = [];
    // Bỏ tick 1 hàng ĐANG THẬT SỰ gắn đúng lô của hàng đó (không phải hàng
    // "chưa gán"/"đang gắn lô khác") thì GỠ hẳn liên kết lô — port
    // `applyTargetPick()`'s nhánh `!pick.use` app cũ: `linked` (mức đang gắn
    // ĐÚNG lô đang xét) mới bị gỡ, giữ nguyên Mean/SD đã có. Trước đây bỏ
    // tick chỉ khoá ô nhập trên giao diện, không đụng gì tới DB.
    const unlink: { testId: string; level: number; mean: number | null; sd: number | null; low: number | null; high: number | null }[] = [];
    for (const row of rowEls) {
      const use = row.querySelector<HTMLInputElement>('.tm-use');
      const testId = row.getAttribute('data-test') || '';
      const lotId = row.getAttribute('data-lot') || '';
      const current = (levelsByTestId[testId] || []).find((item) => item.level === level);
      if (!use || !use.checked) {
        if (current?.qc_lot_id && current.qc_lot_id === lotId) {
          unlink.push({ testId, level, mean: current.mean, sd: current.sd, low: current.low, high: current.high });
        }
        continue;
      }
      const test = tests.find((item) => item.id === testId);
      if (!test) continue;
      const read = (selector: string) => row.querySelector<HTMLInputElement>(selector)?.value.trim() || '';
      const result = normalizeTargetPick({
        meanRaw: read('.tm-mean'), lowRaw: read('.tm-low'), highRaw: read('.tm-high'), sdRaw: read('.tm-sd'),
        k: Number(row.getAttribute('data-k') || 2) || 2,
      });
      if ('error' in result) { await infoDialog(result.message, { title: 'Chưa lưu được Mean/SD' }); return; }
      picked.push({
        testId, level, mean: result.mean, sd: result.sd, low: result.low, high: result.high, qcLotId: lotId, name: test.name,
        switching: !!(current?.qc_lot_id && lotId && current.qc_lot_id !== lotId),
      });
    }
    if (!picked.length && !unlink.length) { await infoDialog('Chưa chọn xét nghiệm nào để lưu Mean/SD.', { title: 'Chưa lưu được Mean/SD' }); return; }

    const switching = picked.filter((item) => item.switching);
    if (switching.length) {
      const ok = await confirmDialog(
        `${switching.length} xét nghiệm (${switching.map((item) => item.name).join(', ')}) đang gắn lô khác ở mức này. Lưu tiếp sẽ chuyển các mức đó sang lô của nhóm đang chọn; Mean/SD cũ được chốt vào lịch sử dữ liệu.`,
        { title: 'Ghi Mean/SD sang lô khác', confirmLabel: 'Lưu và chuyển lô' },
      );
      if (!ok) return;
    }
    if (!await reauthDialog({ title: 'Xác thực Mean/SD', message: 'Nhập lại mật khẩu trước khi lưu Mean/SD cho lô QC.' })) return;

    setSaving(true);
    try {
      for (const item of picked) {
        const result = await saveTestLevel(item.testId, { level: item.level, mean: item.mean, sd: item.sd, low: item.low, high: item.high, qcLotId: item.qcLotId });
        if (!result.ok) { await infoDialog(result.error.message, { title: 'Chưa lưu được Mean/SD' }); return; }
      }
      for (const item of unlink) {
        const result = await saveTestLevel(item.testId, { level: item.level, mean: item.mean, sd: item.sd, low: item.low, high: item.high, qcLotId: '' });
        if (!result.ok) { await infoDialog(result.error.message, { title: 'Chưa lưu được Mean/SD' }); return; }
      }
      const total = picked.length + unlink.length;
      await infoDialog(`Đã lưu Mean/SD mức ${level} cho ${total} xét nghiệm.`, { type: 'success', title: 'Đã lưu Mean/SD' });
    } finally {
      setSaving(false);
    }
  }

  /** Nhãn ô chọn Panel QC gồm cả tên máy như app cũ ("Panel Hóa sinh ·
   * EasyLyte Expand") — cùng một tên panel có thể tồn tại trên 2 máy. */
  const panelLabel = (item: QcPanel) => {
    const instrument = instruments.find((machine) => machine.id === item.instrument_id);
    return instrument ? `${item.name} · ${instrument.name}` : item.name;
  };

  return (
    <>
      <div className="rcfg-toolbar"><div><h2>Mean/SD theo nhóm lô QC</h2><p>Chọn Panel QC và nhóm lô, app tự đưa các xét nghiệm trong panel vào bảng Mean/SD.</p></div><div className="rcfg-tools"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên xét nghiệm..." /></div></div>
      <div className="panel target-matrix-panel">
      {!tests.length ? <EmptyState title="Chưa có xét nghiệm">Tạo xét nghiệm trước, sau đó quay lại nhập Mean/SD theo nhóm lô.</EmptyState> : <>
      <div className="target-selector target-config-selector">
        <div><label>Panel QC</label><select value={panelId} onChange={(e) => { setPanelId(e.target.value); setLevel(1); }}>{panels.length ? panels.map((item) => <option key={item.id} value={item.id}>{panelLabel(item)}</option>) : <option value="">Chưa có panel</option>}</select></div>
        <div><label>Nhóm lô QC</label><select value={groupId} onChange={(e) => setGroupId(e.target.value)}>{lotGroups.length ? lotGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>) : <option value="">Không tìm thấy nhóm lô QC phù hợp</option>}</select></div>
      </div>
      {panel && selectedGroup ? <>
        <div className="target-summary"><span className="ok"><b>{linked}</b> đã gán mức này</span><span className={other ? 'warn' : 'none'}><b>{other}</b> đang dùng lô khác</span><span className={empty ? 'warn' : 'none'}><b>{empty}</b> chưa gán lô</span><span className={missing ? 'warn' : 'ok'}><b>{missing}</b> thiếu Mean/SD</span></div>
        <div className="target-level-toolbar"><div><b>Mức {level}</b><span className="target-level-lot">{levelLots.map((lot) => lot.lot_no).join(' / ') || '—'}</span></div><div className="dayseg">{groupLevels.map((item) => <button type="button" key={item} className={item === level ? 'on' : ''} onClick={() => setLevel(item)}>Mức {item}</button>)}</div></div>
          <div className="target-table">
            <div className="target-head"><span>Dùng</span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>
            {rows.map(({ test, target }) => {
              const decimals = test.decimal_places ?? 2;
              const k = target?.range_k && target.range_k > 0 ? target.range_k : 2;
              const ready = target?.mean != null && target?.sd != null && target.sd > 0;
              const linkedLot = target ? groupLots.find((lot) => lot.id === target.qc_lot_id) : undefined;
              // Ưu tiên lô đang gắn; nếu chưa gắn thì chọn lô còn dùng đầu
              // tiên của mức. `targetRowState()` app cũ khoá lô `depleted`.
              const rowLot = linkedLot || levelLots.find((lot) => !lot.depleted) || levelLots[0];
              const locked = !!rowLot?.depleted;
              const status = locked
                ? <b className="tag none">Lô đã hết dùng</b>
                : !target?.qc_lot_id
                ? <b className="tag none">Chưa gán</b>
                : linkedLot ? <b className="tag ok">Đã gán</b> : <b className="tag warn">Đang dùng {lots.find((lot) => lot.id === target.qc_lot_id)?.lot_no || 'lô khác'}</b>;
              // `key` PHẢI đổi theo cả `level` lẫn lô đang gán — các ô Mean/SD/
              // giới hạn là uncontrolled (`defaultValue`, đọc DOM lúc lưu, xem
              // comment syncTargetRange ở trên). Với key CHỈ là `test.id` (bản
              // trước), đổi mức QC không làm React tạo lại DOM node cho cùng
              // 1 xét nghiệm, nên các ô vẫn hiện nguyên giá trị của mức VỪA
              // XEM trước đó thay vì nạp lại theo mức mới — lỗi thật, không
              // phải cảm nhận (tái hiện: đổi Mức 1 → Mức 2, ô Mean/SD vẫn là
              // số của Mức 1).
              const lotId = rowLot?.id || target?.qc_lot_id || '';
              // Tick mặc định — port `targetRowState()` app cũ:
              // `checked = locked ? false : !!linked || !assigned`. Hàng đang
              // gắn LÔ KHÁC (`status==='other'`, không phải lô của nhóm đang
              // chọn) mặc định BỎ TICK — trước đây LUÔN tick sẵn, khiến bấm
              // "Lưu Mean/SD mức này" vô tình chuyển cả những xét nghiệm KHÔNG
              // liên quan sang lô của nhóm đang xem.
              const checked = !locked && (!target?.qc_lot_id || !!linkedLot);
              return <div className="target-row" key={`${test.id}:${level}:${lotId}`} data-test={test.id} data-lot={lotId} data-decimals={decimals} data-k={k}>
              <label className="lot-assay-check" title={locked ? 'Lô QC đã hết dùng' : ''}><input className="tm-use" type="checkbox" disabled={locked} defaultChecked={checked} onChange={(e) => toggleTargetRow(e.currentTarget)} /><span /></label>
              <div className="lot-assay-name"><b>{test.name}</b><small>{test.unit || 'Chưa có đơn vị'}</small></div>
              <input className="tm-mean" type="number" step="any" disabled={!checked} defaultValue={target?.mean ?? ''} placeholder="Trung bình" onChange={(e) => syncTargetRange(e.currentTarget, 'target')} />
              <input className="tm-low" type="number" step="any" disabled={!checked} defaultValue={ready ? (target!.mean! - k * target!.sd!).toFixed(decimals) : ''} placeholder="Giới hạn dưới" onChange={(e) => syncTargetRange(e.currentTarget, 'limits')} />
              <input className="tm-high" type="number" step="any" disabled={!checked} defaultValue={ready ? (target!.mean! + k * target!.sd!).toFixed(decimals) : ''} placeholder="Giới hạn trên" onChange={(e) => syncTargetRange(e.currentTarget, 'limits')} />
              <input className="tm-sd" type="number" step="any" disabled={!checked} defaultValue={target?.sd ?? ''} placeholder="Độ lệch chuẩn" onChange={(e) => syncTargetRange(e.currentTarget, 'target')} />
              <span>{status}</span>
            </div>;
            })}
          </div>
          <div className="modal-f target-actions">
            <button type="button" className="btn ghost" onClick={() => targetCheckAll(false)}>Bỏ chọn tất cả</button>
            <button type="button" className="btn ghost" onClick={() => targetCheckAll(true)}>Chọn tất cả</button>
            <button type="button" className="btn teal" disabled={saving} onClick={saveTargetMatrix}>Lưu Mean/SD mức này</button>
          </div>
      </> : <EmptyState title="Chưa đủ cấu hình">Chọn Panel QC và nhóm lô QC để nhập Mean/SD hàng loạt.</EmptyState>}
      </>}
      </div>
    </>
  );
}

// ---------------- Chuyển tiếp lô ----------------

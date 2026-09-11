// Tab "TestsTab" của trang Cấu hình chung — tách khỏi ManagePage.tsx
// (2026-09-03) khi file đó lên 1121 dòng gồm 6 tab. Phần dùng chung ở ./shared.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, reauthDialog, infoDialog } from '../../state/dialog-store';
import { teaSuggestions, findTeaSuggestion, normalizeName, type TeaSuggestion } from '../../lib/tea-suggest';
import { EmptyState, WESTGARD_RULES, parseRuleConfig } from './shared';
import { defaultRuleAction } from '../../../main/domain/westgard-rules';
import type { Test } from '../../../shared/qc-api';

function testCatalogKey(test: Test): string {
  // `analyte_id` là mã kỹ thuật từ các lần tạo/cập nhật trước. Một số bản ghi
  // cũ của cùng xét nghiệm trên hai máy có thể mang mã khác nhau, nên dùng nó
  // để dựng bảng sẽ tách sai một danh mục thành nhiều dòng. Danh mục hiển thị
  // được xác định theo tên và đơn vị; mỗi máy vốn đã không được có bản ghi
  // trùng cặp này.
  return normalizeName(`${test.name}|${test.unit}`);
}

/** `openTestId` — điều hướng chéo trang mở SẴN modal sửa xét nghiệm (port
 * `openConfigAssay(testId)` app cũ, gọi từ nút "Mở cấu hình xét nghiệm" của
 * trang Phân tích Westgard khi CUSUM chưa bật). Chỉ mở 1 LẦN cho mỗi giá trị
 * — không phụ thuộc `tests` (mảng đổi tham chiếu mỗi lần store nạp lại) để
 * tránh việc form đang sửa dở bị reset mở lại liên tục. */
// Nhãn của hai ô "để trống" trong bảng luật nâng cao. Phải khớp từng chữ với
// các <option> tường minh ngay bên dưới, để "Theo chuẩn — Cả hai phạm vi" và
// lựa chọn "Cả hai phạm vi" đọc ra cùng một thứ.
const SCOPE_LABELS: Record<string, string> = {
  within: 'Chỉ trong từng mức', across: 'Chỉ chéo mức/lần chạy', both: 'Cả hai phạm vi',
};
const ACTION_LABELS: Record<string, string> = {
  inactive: 'Không dùng', alert: 'Cảnh báo', reject: 'Loại bỏ',
};

export function TestsTab({ openTestId, onNeedInstrument }: { openTestId?: string; onNeedInstrument?: () => void } = {}) {
  const { tests, instruments, teaRefs, saveTest, removeTest, saveRuleAction, saveRuleScope, ruleScopesByTestId, loadRuleScopes } = useManageStore();
  // Gợi ý TEa: danh mục tích hợp đã phủ ghi đè của phòng xét nghiệm.
  const suggestions = useMemo(() => teaSuggestions(teaRefs), [teaRefs]);

  /** Xoá xét nghiệm — port luồng `delTest()` app cũ: xác nhận (nêu rõ không
   * thể hoàn tác) → xác thực lại mật khẩu → gọi IPC. Cổng "còn điểm QC thuộc
   * kỳ đã khoá thì TỪ CHỐI" nằm ở main (`config:removeTest`), renderer chỉ
   * hiện lại thông báo — kiểm ở main mới là kiểm thật. */
  async function removeTestRow(test: Test, assignments: Test[], selected: Test) {
    const removeWholeCatalog = assignments.length === 1;
    const instrument = instruments.find(item => item.id === selected.instrument_id);
    const targetLabel = removeWholeCatalog ? `xét nghiệm ${test.name}` : `${test.name} khỏi máy ${instrument?.name || 'đã chọn'}`;
    const ok = await confirmDialog(`Xóa ${targetLabel}? Chỉ cấu hình chưa phát sinh dữ liệu QC hoặc lịch sử mới có thể xóa.`, {
      title: removeWholeCatalog ? 'Xóa xét nghiệm' : 'Gỡ máy khỏi xét nghiệm',
      confirmLabel: removeWholeCatalog ? 'Xóa xét nghiệm' : 'Gỡ khỏi máy', cancelLabel: 'Hủy', danger: true,
    });
    if (!ok) return;
    if (!await reauthDialog({ title: 'Xác thực xóa xét nghiệm', message: `Nhập lại mật khẩu trước khi xóa ${targetLabel}.` })) return;
    const result = await removeTest(selected.id, [selected.id]);
    if (!result.ok) { await infoDialog(result.error.message, { title: 'Chưa xóa được xét nghiệm' }); return; }
    await infoDialog(`Đã xóa ${targetLabel}.`, { type: 'success', title: 'Đã cập nhật danh mục' });
  }

  const [editing, setEditing] = useState<Test | 'new' | null>(null);
  const [editingSingleAssignment, setEditingSingleAssignment] = useState(false);
  const [assigningMachines, setAssigningMachines] = useState(false);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [namePickerOpen, setNamePickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const namePickerCloseTimer = useRef<number | null>(null);
  const openedForRef = useRef('');
  useEffect(() => {
    if (!openTestId || openedForRef.current === openTestId) return;
    const t = tests.find((x) => x.id === openTestId);
    if (t) { setEditingSingleAssignment(true); setEditing(t); openedForRef.current = openTestId; }
  }, [openTestId, tests]);
  useEffect(() => {
    setNameQuery(editing && editing !== 'new' ? editing.name : '');
    if (!editing) { setNamePickerOpen(false); setAssigningMachines(false); }
  }, [editing]);
  useEffect(() => () => {
    if (namePickerCloseTimer.current != null) window.clearTimeout(namePickerCloseTimer.current);
  }, []);
  const matchingSuggestions = useMemo(() => {
    const key = normalizeName(nameQuery);
    if (!key) return suggestions;
    return suggestions.filter((item) => normalizeName(`${item.displayName} ${item.hint}`).includes(key));
  }, [nameQuery, suggestions]);
  const editingAssignments = useMemo(() => {
    if (!editing || editing === 'new') return [];
    const key = testCatalogKey(editing);
    return tests.filter(test => testCatalogKey(test) === key);
  }, [editing, tests]);
  const displayedInstruments = useMemo(() => {
    if (!editingSingleAssignment || assigningMachines || !editing || editing === 'new') return instruments;
    return instruments.filter(instrument => instrument.id === editing.instrument_id);
  }, [assigningMachines, editing, editingSingleAssignment, instruments]);
  const ruleActions = useMemo(() => {
    const raw = editing !== 'new' && editing ? parseRuleConfig(editing.rule_actions_json) as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(raw).map(([rule, value]) => [
      rule,
      typeof value === 'boolean' ? defaultRuleAction(rule, value) : String(value || ''),
    ]));
  }, [editing]);
  const ruleScopes = useMemo(
    () => editing !== 'new' && editing ? parseRuleConfig(editing.rule_scopes_json) : {},
    [editing],
  );
  // Giá trị THẬT mà hai ô "để trống" rơi về, do main tính theo số mức đang
  // vận hành + cấu hình chung. Không có nó thì modal chỉ nói "Theo cấu hình
  // chung"/"Phạm vi SOP khuyến nghị" mà không nơi nào đọc ra được luật đang
  // chạy thế nào — đúng chỗ đã giấu lỗi phạm vi `6x` (mục 3.4 kế hoạch).
  const editingId = editing !== 'new' && editing ? editing.id : '';
  useEffect(() => { if (editingId) void loadRuleScopes(editingId); }, [editingId, loadRuleScopes]);
  const ruleHints = useMemo(() => {
    const rows = editingId ? ruleScopesByTestId[editingId] : undefined;
    return Object.fromEntries((rows || []).map((r) => [r.id, r]));
  }, [editingId, ruleScopesByTestId]);

  function openNew() {
    // App cũ mở thẳng form tạo máy nếu chưa có máy; tránh đưa người dùng vào
    // form xét nghiệm không thể lưu vì select Máy hoàn toàn rỗng.
    if (!instruments.length) { onNeedInstrument?.(); return; }
    setErr(null); setEditingSingleAssignment(false); setEditing('new');
  }
  /** Gõ tên khớp danh mục TEa tham chiếu → tự điền tên chuẩn hoá, đơn vị,
   * TEa% và 2 trường nguồn (port `configAssaySuggestionInput` app cũ; ghi
   * THẲNG vào DOM của form vì form này để uncontrolled, giống bản cũ).
   * KHÔNG tự điền Khoa/Khu vực — app cũ cố ý bỏ trường đó ra, vì khoa lấy
   * theo máy xét nghiệm đang chọn. */
  function fillTeaSuggestion(form: HTMLFormElement, match: TeaSuggestion | null) {
    if (!form) return;
    const field = <T extends HTMLElement>(name: string) => form.elements.namedItem(name) as T | null;
    const keyEl = field<HTMLInputElement>('teaRefKey');
    const sourceEl = field<HTMLInputElement>('teaSource');
    if (!match) { if (keyEl) keyEl.value = ''; if (sourceEl) sourceEl.value = ''; return; }
    if (keyEl) keyEl.value = match.teaRefKey;
    if (sourceEl) sourceEl.value = match.teaSource;
    const unitEl = field<HTMLInputElement>('unit');
    const teaEl = field<HTMLInputElement>('tea');
    if (unitEl) unitEl.value = match.unit || '';
    if (teaEl) teaEl.value = match.tea == null ? '' : String(match.tea);
  }

  function changeTestName(input: HTMLInputElement) {
    const match = findTeaSuggestion(input.value, teaRefs);
    // Không chuẩn hoá lại chuỗi ngay khi đang gõ: thay value của input giữa
    // một lần nhập làm con trỏ nhảy và popup chớp/giật. Chỉ dùng kết quả khớp
    // để điền các trường liên quan; tên chuẩn được áp dụng khi chọn một dòng.
    setNameQuery(input.value);
    if (input.form) fillTeaSuggestion(input.form, match);
    openNamePicker();
  }

  function cancelNamePickerClose() {
    if (namePickerCloseTimer.current != null) window.clearTimeout(namePickerCloseTimer.current);
    namePickerCloseTimer.current = null;
  }

  function openNamePicker() {
    cancelNamePickerClose();
    setNamePickerOpen(true);
  }

  function closeNamePickerSoon() {
    if (namePickerCloseTimer.current != null) window.clearTimeout(namePickerCloseTimer.current);
    namePickerCloseTimer.current = window.setTimeout(() => {
      namePickerCloseTimer.current = null;
      setNamePickerOpen(false);
    }, 150);
  }

  function chooseTeaSuggestion(match: TeaSuggestion) {
    const input = nameInputRef.current;
    if (!input?.form) return;
    setNameQuery(match.displayName);
    fillTeaSuggestion(input.form, match);
    setNamePickerOpen(false);
  }

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const selectedInstrumentIds = fd.getAll('instrumentIds').map(String);
    if (assigningMachines) {
      const existingInstrumentIds = new Set(editingAssignments.map(item => item.instrument_id));
      if (!selectedInstrumentIds.some(id => !existingInstrumentIds.has(id))) {
        setErr('Chọn ít nhất một máy mới để gán xét nghiệm.');
        return;
      }
    }
    const singleAssignment = editingSingleAssignment && !assigningMachines && editing !== 'new' && editing ? editing : null;
    const data = {
      name: String(fd.get('name') || ''),
      ...(singleAssignment ? {
        instrumentId: singleAssignment.instrument_id,
        section: singleAssignment.section,
      } : {
        instrumentIds: selectedInstrumentIds,
        assignmentIds: editingAssignments.map(item => item.id),
        analyteId: editing !== 'new' && editing ? testCatalogKey(editing) : String(fd.get('teaRefKey') || ''),
        preserveExistingAssignments: assigningMachines,
      }),
      unit: String(fd.get('unit') || ''), decimalPlaces: Number(fd.get('decimalPlaces') || 2),
      tea: Number(fd.get('tea') || 0),
      // Nguồn TEa do ô tên tự điền khi khớp danh mục TEa tham chiếu (app cũ:
      // `configAssaySuggestionInput`); người dùng sửa tay TEa% thì 2 trường
      // này vẫn giữ vết analyte đã khớp, đúng như bản cũ.
      teaSource: String(fd.get('teaSource') || ''),
      teaRefKey: String(fd.get('teaRefKey') || ''),
      method: String(fd.get('method') || ''), reagent: String(fd.get('reagent') || ''),
      // CUSUM đọc THẲNG từ form (trước 2026-09-03 khối này chỉ để duyệt giao
      // diện: 3 ô có `name` nhưng submit lấy lại giá trị cũ, nên bật/tắt hay
      // đổi k/h đều không có tác dụng).
      cusumOn: fd.get('cusumOn') === 'on',
      cusumK: Number(fd.get('cusumK') || 0.5),
      cusumH: Number(fd.get('cusumH') || 4),
      active: fd.get('closed') !== 'on',
    };
    const id = editing !== 'new' && editing ? editing.id : undefined;
    const result = await saveTest(id, data);
    if (result.ok) {
      // Phạm vi luật lưu ở bảng riêng (`config:saveRuleScope`), không thuộc
      // hàng `tests` — nên phải gọi sau khi có id xét nghiệm.
      const assignmentIds = result.data.assignment_ids || [result.data.id];
      for (const testId of assignmentIds) {
        for (const rule of WESTGARD_RULES) {
          const action = String(fd.get(`ruleAction:${rule}`) || '') as '' | 'inactive' | 'alert' | 'reject';
          if (action !== (ruleActions[rule] || '')) {
            const actionResult = await saveRuleAction(testId, rule, action);
            if (!actionResult.ok) { setErr(actionResult.error.message); return; }
          }
          const scope = String(fd.get(`ruleScope:${rule}`) || '');
          if (scope !== (ruleScopes[rule] || '')) {
            const scopeResult = await saveRuleScope(testId, rule, scope as '' | 'within' | 'across' | 'both');
            if (!scopeResult.ok) { setErr(scopeResult.error.message); return; }
          }
        }
      }
    }
    if (!result.ok) { setErr(result.error.message); return; }
    setAssigningMachines(false); setEditing(null);
  }
  const catalogGroups = useMemo(() => {
    const groups = new Map<string, Test[]>();
    for (const test of tests) {
      const key = testCatalogKey(test);
      const group = groups.get(key) || [];
      group.push(test); groups.set(key, group);
    }
    return [...groups.entries()].map(([key, assignments]) => ({ key, assignments, test: assignments[0] }));
  }, [tests]);
  const normalizedQuery = normalizeName(query);
  const visible = catalogGroups.filter(group => !normalizedQuery || group.assignments.some(test => {
    const instrument = instruments.find(item => item.id === test.instrument_id);
    return normalizeName(`${test.name} ${test.unit} ${test.method} ${test.reagent} ${test.tea} ${instrument?.name || ''} ${instrument?.section || test.section}`).includes(normalizedQuery);
  }));

  return (
    <>
        <div className="rcfg-toolbar">
          <div><h2>Danh mục xét nghiệm</h2><p>Quản lý xét nghiệm, máy, đơn vị, phương pháp và TEa.</p></div>
          <div className="rcfg-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên xét nghiệm, máy, đơn vị, phương pháp, hóa chất, TEa..." />
            <button className="btn teal" onClick={openNew}>＋ Thêm xét nghiệm</button>
          </div>
      </div>
      <div className="panel rcfg-list">
        {!tests.length ? <EmptyState title="Chưa có xét nghiệm">{instruments.length ? 'Thêm xét nghiệm đầu tiên để tiếp tục cấu hình Panel QC, lô QC và Mean/SD.' : 'Thêm máy xét nghiệm trước, sau đó tạo danh mục xét nghiệm.'}</EmptyState>
          : !visible.length ? <EmptyState title="Không tìm thấy xét nghiệm">Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc hiện tại.</EmptyState>
          : <table className="assay-table">
            <thead><tr><th className="num">STT</th><th>Tên xét nghiệm</th><th>Máy xét nghiệm</th><th>Hóa chất</th><th>TEa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
            {visible.map(({ key, test: t, assignments }, i) => {
              const selected = assignments.find(item => item.id === selectedAssignmentIds[key]) || assignments[0];
              const selectedInstrument = instruments.find(item => item.id === selected.instrument_id);
              const instrumentOptionLabel = (assignment: Test) => {
                const instrument = instruments.find(item => item.id === assignment.instrument_id);
                const section = instrument?.section || assignment.section;
                const name = instrument?.name || 'Máy không còn tồn tại';
                return section ? `${name} · ${section}` : name;
              };
              return <tr key={key}>
                <td className="num">{i + 1}</td>
                <td><b>{selected.name}</b><div className="hint">{selected.method || 'Chưa nhập phương pháp'}{selected.unit ? ' · ' + selected.unit : ''}</div></td>
                <td><select className="assay-machine-select" value={selected.id} aria-label={`Chọn máy cho ${selected.name}`}
                  onChange={(event) => setSelectedAssignmentIds(current => ({ ...current, [key]: event.target.value }))}>
                  {assignments.map(assignment => {
                    return <option key={assignment.id} value={assignment.id}>{instrumentOptionLabel(assignment)}</option>;
                  })}
                </select>
                </td>
                <td>{selected.reagent || '—'}</td>
                <td className="num">{selected.tea ? `${selected.tea}%` : '—'}</td>
                <td><span className={`tag ${selected.active ? 'ok' : 'none'}`}>{selected.active ? 'Đang dùng' : 'Ngừng dùng'}</span></td>
                <td><div className="manage-actions">
                  <RowActionButton kind="edit" label={`Sửa ${selected.name} trên ${selectedInstrument?.name || 'máy đã chọn'}`} onClick={() => { setErr(null); setAssigningMachines(false); setEditingSingleAssignment(true); setEditing(selected); }} />
                  <RowActionButton kind="delete" label={`Xóa ${selected.name} khỏi ${selectedInstrument?.name || 'máy đã chọn'}`} onClick={() => removeTestRow(t, assignments, selected)} />
                </div></td>
              </tr>
            } )}
            </tbody>
          </table>}

        {editing && (
          <Modal title={editing === 'new' ? 'Thêm xét nghiệm' : assigningMachines ? 'Gán thêm máy' : 'Sửa xét nghiệm'} onClose={() => setEditing(null)} className="rcfg-modal rcfg-assay-modal"
            footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Hủy</button><button className="btn teal" type="submit" form="test-form">{editing === 'new' ? 'Thêm xét nghiệm' : assigningMachines ? 'Gán thêm máy' : 'Lưu thay đổi'}</button></>}>
            <form id="test-form" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
              {err && <p className="field-error">{err}</p>}
              <div className="assay-form-heading"><h4>Thông tin xét nghiệm</h4></div>
              <div className="assay-setup-layout">
                <section className="assay-config-card assay-settings-column">
                  <div className="assay-card-head">
                    <span><b>Thiết lập xét nghiệm</b><small>Thông tin định danh và thông số sử dụng</small></span>
                  </div>
                  <div className="assay-card-body">
                    <div className="assay-main-grid">
                    <div className="field">
                      <label>Tên xét nghiệm <span className="req">*</span></label>
                      <div className="assay-name-picker">
                        <input ref={nameInputRef} name="name" autoComplete="off"
                          role="combobox" aria-autocomplete="list" aria-expanded={namePickerOpen}
                          aria-controls="assayTeaSuggestions"
                          placeholder="Gõ để tìm tên, viết tắt hoặc bí danh…"
                          value={nameQuery}
                          onFocus={cancelNamePickerClose}
                          onClick={openNamePicker}
                          onBlur={closeNamePickerSoon}
                          onChange={(event) => changeTestName(event.currentTarget)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') { setNamePickerOpen(false); return; }
                            if (event.key === 'ArrowDown') { event.preventDefault(); setNamePickerOpen(true); return; }
                            if (event.key === 'Enter' && namePickerOpen && matchingSuggestions.length) {
                              event.preventDefault(); chooseTeaSuggestion(matchingSuggestions[0]);
                            }
                          }} />
                        {namePickerOpen && (
                          <div id="assayTeaSuggestions" className="assay-name-options" role="listbox">
                            {matchingSuggestions.length ? matchingSuggestions.map((item) => (
                              <button type="button" role="option" key={item.teaRefKey}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => chooseTeaSuggestion(item)}>
                                <span>{item.displayName}</span>
                                <small>{item.hint || 'Chưa phân nhóm'}</small>
                              </button>
                            )) : <p>Không tìm thấy xét nghiệm phù hợp.</p>}
                          </div>
                        )}
                      </div>
                      <input type="hidden" name="teaRefKey" defaultValue={editing !== 'new' ? editing.tea_ref_key : ''} />
                      <input type="hidden" name="teaSource" defaultValue={editing !== 'new' ? editing.tea_source : ''} />
                    </div>
                    <div className="field"><label>Đơn vị</label><input name="unit" defaultValue={editing !== 'new' ? editing.unit : ''} /></div>
                    </div>
                    <div className="assay-detail-grid">
                      <div className="field"><label>Phương pháp</label><input name="method" defaultValue={editing !== 'new' ? editing.method : ''} /></div>
                      <div className="field"><label>TEa %</label><input name="tea" type="number" step="0.01" defaultValue={editing !== 'new' ? editing.tea : ''} /></div>
                      <div className="field"><label>Hóa chất</label><input name="reagent" defaultValue={editing !== 'new' ? editing.reagent : ''} /></div>
                      <div className="field"><label>Số thập phân</label><select name="decimalPlaces" defaultValue={editing !== 'new' ? editing.decimal_places : 2}>{[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                    </div>
                  </div>
                </section>
                <section className="assay-config-card assay-machine-section" aria-labelledby="assay-machine-title">
                  <div className="assay-card-head">
                    <span><b id="assay-machine-title">{assigningMachines ? 'Chọn máy mới' : editingSingleAssignment ? 'Máy đang cấu hình' : 'Máy áp dụng'} <span className="req">*</span></b><small>{assigningMachines ? 'Máy mới dùng thông số đang hiển thị bên trái' : editingSingleAssignment ? 'Thông số bên trái chỉ áp dụng cho máy này' : 'Chọn máy thực hiện xét nghiệm'}</small></span>
                    <div className="assay-machine-head-actions">
                      {editingSingleAssignment && (assigningMachines || editingAssignments.length < instruments.length) && <button type="button" className="assay-add-machine" onClick={() => { setErr(null); setAssigningMachines(value => !value); }}>{assigningMachines ? 'Hủy gán thêm' : '＋ Gán thêm máy'}</button>}
                    </div>
                  </div>
                  <div className="assay-card-body assay-machine-body">
                    <div className="assay-machine-picker">
                      {displayedInstruments.map((instrument) => {
                        const assigned = editingAssignments.some(item => item.instrument_id === instrument.id);
                        return <label key={instrument.id} className={assigned ? 'assigned' : ''}>
                          <input type="checkbox" name={assigned ? undefined : 'instrumentIds'} value={instrument.id} defaultChecked={assigned} disabled={assigned} />
                          {assigned && <input type="hidden" name="instrumentIds" value={instrument.id} />}
                          <span className="assay-machine-check" aria-hidden="true">✓</span>
                          <span className="assay-machine-copy">
                            <b>{instrument.name}</b>
                            <small>{instrument.section || 'Chưa gán khu vực'}{instrument.model ? ` · ${instrument.model}` : ''}</small>
                          </span>
                          {assigned && <span className="assay-machine-lock">Đã gán</span>}
                        </label>;
                      })}
                      {!instruments.length && <p className="empty-state">Chưa có máy xét nghiệm. Hãy thêm máy trước khi tạo xét nghiệm.</p>}
                    </div>
                    {assigningMachines && <small className="assay-machine-help">Máy đã gán được khóa để bảo toàn lịch sử QC. Chọn một hoặc nhiều máy mới.</small>}
                  </div>
                </section>
              </div>
              <details className="assay-advanced" open={editing !== 'new' && (Object.keys(parseRuleConfig(editing.rule_actions_json)).length > 0 || Object.keys(parseRuleConfig(editing.rule_scopes_json)).length > 0)}>
                <summary><span><b>Cấu hình Westgard nâng cao</b><small>Mặc định dùng cấu hình chung của hệ thống</small></span><span aria-hidden="true">+</span></summary>
                <div className="assay-advanced-body">
                  {/* Hành động và phạm vi đều lưu theo từng xét nghiệm. Engine
                      dùng cùng cấu hình này ở Nhập QC và Phân tích Westgard. */}
                  <div className="assay-rule-head" aria-hidden="true"><span>Luật</span><span>Hành động</span><span>Phạm vi áp dụng</span></div>
                  <div className="assay-rule-grid">
                    {WESTGARD_RULES.map((id) => {
                      const hint = ruleHints[id];
                      return <div className="assay-rule-row" key={id}>
                        <b>{id}</b>
                        <select name={`ruleAction:${id}`} aria-label={`Hành động ${id}`} defaultValue={ruleActions[id] || ''}><option value="">{hint ? `Theo cấu hình chung — ${ACTION_LABELS[hint.defaultAction]}` : 'Theo cấu hình chung'}</option><option value="inactive">Không dùng</option><option value="alert">Cảnh báo</option><option value="reject">Loại bỏ</option></select>
                        <select name={`ruleScope:${id}`} aria-label={`Phạm vi ${id}`} defaultValue={ruleScopes[id] || ''}><option value="">{hint ? `Theo chuẩn — ${SCOPE_LABELS[hint.defaultScope]}` : 'Phạm vi SOP khuyến nghị'}</option><option value="within">Chỉ trong từng mức</option><option value="across">Chỉ chéo mức/lần chạy</option><option value="both">Cả hai phạm vi</option></select>
                      </div>;
                    })}
                  </div>
                </div>
              </details>
              <details className="assay-advanced" open={editing !== 'new' && editing.cusum_on === 1}>
                <summary><span><b>Giám sát xu hướng CUSUM</b><small>Tùy chọn hỗ trợ phát hiện trôi hoặc dịch chuyển kéo dài</small></span><span aria-hidden="true">+</span></summary>
                <div className="assay-advanced-body">
                  <label className="rcfg-check"><input type="checkbox" name="cusumOn" defaultChecked={editing !== 'new' && editing.cusum_on === 1} /> Bật biểu đồ CUSUM cho xét nghiệm này</label>
                  <div className="assay-cusum-grid">
                    <div className="field"><label>Ngưỡng tích lũy k (SD)</label><input name="cusumK" type="number" step="0.1" min="0.1" defaultValue={editing !== 'new' ? editing.cusum_k : 0.5} /></div>
                    <div className="field"><label>Ngưỡng cảnh báo h (SD)</label><input name="cusumH" type="number" step="0.5" min="0.5" defaultValue={editing !== 'new' ? editing.cusum_h : 4} /></div>
                  </div>
                </div>
              </details>
              <label className="rcfg-check assay-closed">
                <input type="checkbox" name="closed" defaultChecked={editing !== 'new' && editing.active !== 1} /> Ngừng sử dụng xét nghiệm này cho cấu hình QC mới
              </label>
            </form>
          </Modal>
        )}

      </div>
    </>
  );
}

// ---------------- Panel QC ----------------

// Khắc phục sự cố (NCE/CAPA): protocol-v3 8 phần port theo luồng app cũ
// (nhận diện → kiểm soát → FMEA → checklist → nguyên nhân/hành động →
// release → ảnh hưởng bệnh nhân → hiệu lực/rủi ro còn lại). JSX chỉ giữ
// state trình bày; điều kiện khép vòng được xác thực lại ở main process.
import { useEffect, useMemo, useState } from 'react';
import { useManageStore } from '../store/manage-store';
import { useNceStore } from '../store/nce-store';
import { useWestgardStore } from '../store/westgard-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { DateField } from '../components/DateField';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../store/auth-store';
import { canWrite } from '../lib/permissions';
import type { NceRecord, NceDetail, QcPointView } from '../../shared/qc-api';
import { vnDate as formatVnDate, todayIso } from '../lib/format';

/** Luật thuộc SAI SỐ HỆ THỐNG — port `WG_RULE_REGISTRY[].err === 'SE'` app
 * cũ; luật còn lại tính là sai số ngẫu nhiên (RE), đúng cách `errorType()`
 * phân loại. */
const SE_RULES = ['2-2s', '4-1s', '10x', '8x', '6x', '2of3-2s', '3-1s', '7T', 'CUSUM +h', 'CUSUM −h', 'CUSUM ±h'];
/** Nhãn trạng thái NGẮN của app cũ (`reportLabels.stateName`). */
const TREE_STATE: Record<string, string> = { rej: 'Loại', warn: 'Cảnh báo', ok: 'Đạt', none: 'Chưa có' };
/** `formatDateTimeVN()` app cũ: giờ:phút rồi tới ngày, theo locale vi-VN. */
function formatDateTimeVN(value: string): string {
  const date = new Date(value);
  return isNaN(+date) ? '' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
}

/** `vnDate()` app cũ. */
const vnDate = (iso: string) => formatVnDate(iso, '—');

const VERDICT_LABEL: Record<string, string> = { warn: 'Cảnh báo', rej: 'Vi phạm' };

const GUIDE_STEPS = [
  '1. Nhận diện sự cố — ghi nhận xét nghiệm/mức/lô/luật vi phạm.',
  '2. Điều tra — mô tả quá trình kiểm tra thực tế đã làm.',
  '3. Nguyên nhân — phân loại SE (hệ thống)/RE (ngẫu nhiên) + mô tả cụ thể.',
  '4. Khắc phục — xử lý tức thời + hạn hoàn thành hành động.',
  '5. Rerun — gắn bằng chứng bằng 1 điểm QC thật đã chạy lại.',
  '6. Release-to-service — quyết định giữ hay phát hành kết quả bệnh nhân.',
  '7. Hiệu lực — sau khi hoàn thành hành động, đánh giá hiệu quả.',
  '8. Residual risk — đánh giá rủi ro còn lại TRƯỚC KHI kết luận hiệu quả.',
];

function parseDetail(json: string): NceDetail {
  try { return JSON.parse(json || '{}'); } catch { return {}; }
}

/** Dòng NCE phải gắn vào đúng điểm đã tạo cảnh báo, không chỉ test+mức. */
type NcePrefill = { testId: string; level: number; pointId: string; lot: string; date: string; rule: string; errorType: 'SE' | 'RE' };

export function ActionsPage() {
  const { tests, loadTests } = useManageStore();
  const store = useNceStore();
  const { summaries, loadSummaries } = useWestgardStore();
  const [form, setForm] = useState<{ prefill: NcePrefill | null; record: NceRecord | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const writable = canWrite(useAuthStore((s) => s.user)?.role);

  /** Hủy hồ sơ ngay từ bảng nhật ký — app cũ có nút này trên từng dòng. Hủy
   * CÓ LƯU VẾT (soft-delete + lý do), không xoá dữ liệu. */
  async function cancelRecord(id: string) {
    const note = 'Hủy từ bảng nhật ký';
    if (!(await confirmDialog('Hủy hồ sơ này? Dữ liệu được giữ lại để truy xuất.', { title: 'Hủy hồ sơ NCE', danger: true, confirmLabel: 'Hủy hồ sơ' }))) return;
    const result = await store.cancel(id, note);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  /** Xuất CSV nhật ký — cùng cơ chế `downloadCsv` đã dùng ở Audit/Report. */
  function exportLogCsv() {
    const header = ['nceId', 'test', 'date', 'level', 'lot', 'rule', 'errorType', 'correction', 'approval', 'effectiveness', 'recordStatus', 'dueDate'];
    const value = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header.join(',')];
    for (const r of store.records) {
      const detail = parseDetail(r.detail_json);
      lines.push([r.nce_id, testName(r.test_id), r.date, r.level ?? '', r.lot || '', r.rule, r.error_type,
        detail.correction || '', r.approval_status, r.effectiveness_status, r.record_status, r.due_date].map(value).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nhat-ky-khac-phuc.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { loadTests(); store.load(); loadSummaries(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useStoreInvalidation(['actions'], undefined, store.load);
  useStoreInvalidation(['qc_points', 'tests'], undefined, loadSummaries);

  const testName = (id: string | null) => tests.find((t) => t.id === id)?.name ?? '(không rõ)';
  const detailRecord = store.records.find((r) => r.id === detailId) || null;

  // "Sự cố cần xử lý" — mọi mức đang cảnh báo/vi phạm (từ Westgard) mà CHƯA
  // có hồ sơ NCE nào còn active gắn đúng test+mức đó, giống bố cục
  // "IssuesPanel" bản cũ. Không domain/IPC mới — chỉ lọc lại 2 nguồn dữ liệu
  // đã có sẵn (testSummaries + NCE records), giữ đúng nguyên tắc "không domain
  // mới nếu đã có API phù hợp" đã dùng cho Dashboard/Westgard.
  // Gom theo XÉT NGHIỆM + NGÀY của điểm mới nhất, đúng `issue-group` app cũ.
  // KHÔNG lọc bỏ mức đã có hồ sơ NCE: app cũ vẫn hiện dòng đó, chỉ đổi nút
  // thành "Tiếp tục hồ sơ" — ẩn đi là mất cảnh báo đang tồn tại.
  const issueGroups = useMemo(() => {
    const groups: {
      key: string; testName: string; date: string; severity: 'warn' | 'rej'; count: number;
      items: {
        key: string; testId: string; level: number; pointId: string; lot: string; date: string; rule: string; errorType: 'SE' | 'RE'; severity: 'warn' | 'rej';
        levelLabel: string; state: string; meta: string; footer: string;
        openRecordId: string | null;
      }[];
    }[] = [];
    for (const s of summaries) {
      const items = s.levels
        .filter((lv) => lv.latestVerdict !== 'ok' && lv.latest)
        .map((lv) => {
          // App cũ gắn hồ sơ với dòng sự cố theo ĐIỂM QC (`pointId`), không
          // theo test+mức: một hồ sơ chưa gắn điểm nào thì dòng vi phạm vẫn
          // hiện "Chưa ghi khắc phục" và nút "Lập hồ sơ".
          const open = lv.latest
            ? store.records.find((r) => r.record_status === 'active' && r.point_id === lv.latest!.id)
            : undefined;
          const err = lv.latestRules.some((r) => SE_RULES.includes(r)) ? 'SE — Sai số hệ thống' : 'RE — Sai số ngẫu nhiên';
          const errorType: 'SE' | 'RE' = lv.latestRules.some((r) => SE_RULES.includes(r)) ? 'SE' : 'RE';
          return {
            key: `${s.testId}:${lv.level}`, testId: s.testId, level: lv.level,
            pointId: lv.latest!.id, lot: lv.lot, date: lv.latest!.date, rule: lv.latestRules.join(', '), errorType,
            severity: lv.latestVerdict as 'warn' | 'rej',
            levelLabel: `M${lv.level} · Lô ${lv.lot || '—'}`,
            state: TREE_STATE[lv.latestVerdict],
            meta: `${lv.latest ? lv.latest.val.toFixed(s.decimalPlaces) : '—'} ${s.unit || ''} · ${lv.latestRules.join(', ') || '—'} · ${err}`,
            footer: open ? 'Đã có hồ sơ đang mở' : 'Chưa ghi khắc phục',
            openRecordId: open ? open.id : null,
          };
        });
      if (!items.length) continue;
      const newest = s.levels.reduce<string>((acc, lv) => (lv.latest && lv.latest.date > acc ? lv.latest.date : acc), '');
      groups.push({
        key: s.testId, testName: s.testName, date: vnDate(newest),
        severity: items.some((i) => i.severity === 'rej') ? 'rej' : 'warn',
        count: items.length, items,
      });
    }
    return groups;
  }, [summaries, store.records]);
  const issueCount = issueGroups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div>
      <PageHeader title="Khắc phục sự cố" subtitle="Điều tra nguyên nhân, ghi nhận, chạy lại QC và phê duyệt khép vòng" />


      <div className="panel action-issues-panel">
        <h2 className="panel-title">Sự cố cần xử lý</h2>
        <div className="dash-list">
          {!issueGroups.length
            ? <div className="alert ok">Không có vi phạm/cảnh báo hoặc hồ sơ NCE đang mở.</div>
            : issueGroups.map((group) => (
              <div className={`issue-group ${group.severity}`} key={group.key}>
                <div className="issue-group-h">
                  <div><b>{group.testName}</b><span className="issue-group-date">{group.date}</span></div>
                  <span className="issue-group-count">{group.count} vi phạm</span>
                </div>
                <div className="issue-group-body">
                  {group.items.map((item) => (
                    <div className={`issue-row ${item.severity}`} key={item.key}>
                      <div className="issue-row-main">
                        <b>{item.levelLabel} · {item.state}</b>
                        <div className="meta">{item.meta}</div>
                        <div className="action-chipline"><span className={`action-chip ${item.severity === 'rej' ? 'bad' : 'warn'}`}>{item.footer}</span></div>
                        <div className="hint">{item.severity === 'rej' ? 'Hướng ngẫu nhiên: bọt khí, thể tích hút, mẫu QC pha/bảo quản, điện áp, thao tác.' : 'Theo dõi thêm điểm QC tiếp theo trước khi kết luận.'}</div>
                      </div>
                      {item.openRecordId
                        ? <button type="button" className="btn ghost sm" onClick={() => setForm({ prefill: null, record: store.records.find((r) => r.id === item.openRecordId) || null })}>Tiếp tục hồ sơ</button>
                        : <button type="button" className="btn ghost sm" onClick={() => setForm({ prefill: { testId: item.testId, level: item.level, pointId: item.pointId, lot: item.lot, date: item.date, rule: item.rule, errorType: item.errorType }, record: null })}>Lập hồ sơ</button>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="panel action-form-panel">
        <div className="action-form-panel-head">
          <h2 className="panel-title">Lập hồ sơ sự không phù hợp (NCE)</h2>
          <button type="button" className="btn ghost sm" onClick={() => setShowGuide(true)}>Quy trình 8 bước</button>
        </div>
        {form ? <NceProtocolForm prefill={form.prefill} record={form.record} onClose={() => setForm(null)} /> : <div className="empty">
          <b>{issueCount ? 'Chọn một sự cố để lập hồ sơ' : 'Không có vi phạm nào cần lập hồ sơ'}</b>
          <p>{issueCount
            ? `Có ${issueCount} sự cố ở trên — bấm "Lập hồ sơ" ngay trên dòng cần xử lý để hồ sơ được gắn đúng điểm QC và tự theo dõi QC chạy lại.`
            : 'Hồ sơ NCE thường bắt đầu từ một vi phạm QC. Khi không có vi phạm nào, chỉ mở hồ sơ khi thực sự cần ghi nhận sự không phù hợp khác.'}</p>
          {writable && <button type="button" className="btn ghost" onClick={() => setForm({ prefill: null, record: null })}>Lập hồ sơ từ nguồn khác</button>}
        </div>}
      </div>

      <div className="panel action-log-panel">
        <h2 className="panel-title">Nhật ký khắc phục</h2>
        {store.records.length ? (
          <>
            <div className="action-log-tools">
              <button type="button" className="btn teal sm" onClick={exportLogCsv}>Xuất CSV nhật ký</button>
            </div>
            <div className="action-log-wrap"><table className="action-log-table">
              <thead><tr><th>Thời điểm</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {store.records.map((r) => {
                  const detail = parseDetail(r.detail_json);
                  const cancelled = r.record_status === 'cancelled';
                  return (
                    <tr key={r.id} style={{ opacity: cancelled ? 0.5 : 1 }}>
                      <td>
                        <div className="action-date">{vnDate(r.date)}</div>
                        {r.created_at ? <div className="action-time">Mở: {formatDateTimeVN(r.created_at)}</div> : null}
                      </td>
                      <td>
                        <div className="action-test">{r.nce_id} · {testName(r.test_id)}</div>
                        <div className="action-sub">M{r.level ?? '—'} · Lô {r.lot || '—'}</div>
                        <div className="action-rule">{r.rule || '—'} · {r.error_type === 'SE' ? 'Sai số hệ thống' : 'Sai số ngẫu nhiên'}</div>
                      </td>
                      <td>
                        <div className="action-text">{detail.correction || '—'}</div>
                        <div className="action-sub">Phụ trách: {detail.owner || '—'}{r.due_date ? ` · hạn ${vnDate(r.due_date)}` : ''}</div>
                      </td>
                      <td><div className="action-status-stack">
                        <span className={`action-chip ${cancelled ? 'none' : r.approval_status === 'approved' ? 'ok' : r.approval_status === 'returned' ? 'bad' : 'warn'}`}>
                          {cancelled ? 'Đã huỷ' : r.approval_status === 'approved' ? 'Đã duyệt' : r.approval_status === 'returned' ? 'Trả lại' : 'Chờ duyệt'}
                        </span>
                        <span className={`action-chip ${r.effectiveness_status === 'effective' ? 'ok' : r.effectiveness_status === 'ineffective' ? 'bad' : 'none'}`}>
                          {r.effectiveness_status === 'effective' ? 'Hiệu quả' : r.effectiveness_status === 'ineffective' ? 'Không hiệu quả' : 'Chưa đánh giá'}
                        </span>
                        {r.parent_nce_id ? <span className="action-chip none">vòng tiếp</span> : null}
                      </div></td>
                      <td><div className="action-row-actions">
                        <button type="button" className="btn ghost sm" onClick={() => setDetailId(r.id)}>Chi tiết</button>
                        {!cancelled && r.approval_status !== 'approved' && <button type="button" className="btn ghost sm" onClick={() => setForm({ prefill: null, record: r })}>Tiếp tục</button>}
                        {!cancelled && r.approval_status !== 'approved' && writable && <button type="button" className="btn danger sm" title="Hủy có lưu vết — không xóa dữ liệu" onClick={() => cancelRecord(r.id)}>Hủy hồ sơ</button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </>
        ) : (
          <div className="empty">
            <div className="empty-title">Chưa có nhật ký</div>
            <div>Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.</div>
          </div>
        )}
      </div>

      {detailRecord && <DetailModal record={detailRecord} testName={testName(detailRecord.test_id)} onClose={() => setDetailId(null)} />}
      {showGuide && (
        <Modal title="Quy trình xử lý sự cố — 8 bước" onClose={() => setShowGuide(false)}>
          <ol style={{ paddingLeft: 18 }}>{GUIDE_STEPS.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}</ol>
        </Modal>
      )}
    </div>
  );
}

const NCE_SOURCES = [['', '— Chọn nguồn —'], ['iqc', 'Nội kiểm IQC'], ['eqa', 'Ngoại kiểm EQA'], ['instrument', 'Cảnh báo thiết bị'], ['clinical', 'Phản hồi lâm sàng'], ['audit', 'Đánh giá / audit'], ['other', 'Nguồn khác']];
const NCE_PHASES = [['', '— Chọn giai đoạn —'], ['pre', 'Trước xét nghiệm'], ['exam', 'Trong xét nghiệm'], ['post', 'Sau xét nghiệm']];
const NCE_RISK = [['', '— Phân loại —'], ['low', 'Thấp'], ['medium', 'Trung bình'], ['high', 'Cao'], ['critical', 'Nghiêm trọng']];
const NCE_CHECKS = [['', 'Chưa đánh giá'], ['ok', 'Đạt'], ['abnormal', 'Bất thường'], ['na', 'Không áp dụng'], ['not-needed', 'Không cần']];
const NCE_CAUSES = [['', '— Chưa xác định —'], ['qc', 'Vật liệu QC'], ['operator', 'Thao tác'], ['instrument', 'Thiết bị'], ['reagent', 'Hóa chất / calibrator'], ['calibration', 'Hiệu chuẩn'], ['environment', 'Môi trường'], ['unknown', 'Chưa xác định']];
const NCE_PATIENT = [['', '— Chọn kết luận —'], ['none', 'Không có mẫu/kết quả bị ảnh hưởng'], ['held', 'Đã giữ kết quả để rà soát'], ['affected', 'Có kết quả cần xử lý lại']];
const NCE_CHECK_ROWS = [['qcMaterial', 'Vật liệu QC'], ['instrument', 'Máy phân tích'], ['reagent', 'Hóa chất / calibrator'], ['calibration', 'Hiệu chuẩn'], ['lotToLot', 'So sánh lot-to-lot']] as const;

function protocolDefaults(detail?: NceDetail, record?: NceRecord | null): NceDetail {
  return { eventSource: '', processPhase: '', owner: '', containmentStatus: '', containmentNote: '', correction: '', investigation: '', riskSeverity: 0, riskOccurrence: 0, riskDetectability: 0, riskLevel: '', riskBasis: '', qcMaterialStatus: '', qcMaterialNote: '', instrumentStatus: '', instrumentNote: '', reagentStatus: '', reagentNote: '', calibrationStatus: '', calibrationNote: '', lotToLotStatus: '', lotToLotNote: '', causeCategory: '', cause: '', action: '', biasBefore: '', biasAfter: '', actionCompletedDate: record?.action_completed_date || '', releaseStatus: '', releaseDate: '', releaseBy: '', releaseNote: '', patientImpact: '', patientAction: '', effectivenessStatus: record?.effectiveness_status || 'pending', effectivenessDate: '', effectivenessNote: '', residualSeverity: 0, residualOccurrence: 0, residualDetectability: 0, residualRiskLevel: '', residualRiskBasis: '', ...detail };
}
function riskScore(a?: number, b?: number, c?: number): string { return a && b && c ? String(a * b * c) : '—'; }
function NceSelect({ value, onChange, options, disabled = false }: { value: string; onChange: (value: string) => void; options: string[][]; disabled?: boolean }) {
  return <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>;
}

/** Form protocol-v3 đặt ngay trong panel như app cũ. Modal chỉ còn dùng cho
 * xem chi tiết/bằng chứng, tránh một form dài bị bó hẹp trong cửa sổ popup. */
function NceProtocolForm({ prefill, record, onClose }: { prefill: NcePrefill | null; record: NceRecord | null; onClose: () => void }) {
  const { tests } = useManageStore(); const store = useNceStore();
  const old = record ? parseDetail(record.detail_json) : {};
  const [protocol, setProtocol] = useState<NceDetail>(() => protocolDefaults(old, record));
  const [testId, setTestId] = useState(record?.test_id || prefill?.testId || '');
  const [level, setLevel] = useState(String(record?.level ?? prefill?.level ?? 1)); const [lot, setLot] = useState(record?.lot || prefill?.lot || '');
  const [date, setDate] = useState(record?.date || prefill?.date || todayIso()); const [rule, setRule] = useState(record?.rule || prefill?.rule || '');
  const [errorType, setErrorType] = useState(record?.error_type || prefill?.errorType || ''); const [dueDate, setDueDate] = useState(record?.due_date || '');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const readOnly = record?.record_status === 'cancelled' || record?.approval_status === 'approved';
  const set = <K extends keyof NceDetail>(key: K, value: NceDetail[K]) => setProtocol((current) => ({ ...current, [key]: value }));
  const number = <K extends keyof NceDetail>(key: K, value: string) => set(key, (Number(value) || 0) as NceDetail[K]);
  const initialRpn = riskScore(protocol.riskSeverity, protocol.riskOccurrence, protocol.riskDetectability);
  const residualRpn = riskScore(protocol.residualSeverity, protocol.residualOccurrence, protocol.residualDetectability);

  async function submit() {
    setError(''); setSaving(true);
    const result = record
      ? await store.saveProtocol(record.id, dueDate, protocol)
      : await store.create({ testId, level: Number(level) || 1, lot, date, pointId: prefill?.pointId, rule, errorType, correction: protocol.correction || '', dueDate, investigation: protocol.investigation, causeCategory: protocol.causeCategory, causeDescription: protocol.cause, protocol });
    setSaving(false);
    if (!result.ok) { setError(result.error.message); return; }
    onClose();
  }
  const disabled = !!readOnly || saving;
  const field = (label: string, child: React.ReactNode) => <div className="field"><label>{label}</label>{child}</div>;
  const scale = (key: keyof NceDetail, label: string) => field(label, <NceSelect disabled={disabled} value={String(protocol[key] || '')} onChange={(value) => number(key, value)} options={[['0', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]} />);

  return <div className="action-form-body">
    {error && <div className="alert danger">{error}</div>}
    <div className="action-incident-banner"><b>{record ? `Đang tiếp tục hồ sơ ${record.nce_id}` : 'Đang lập hồ sơ NCE'}</b><div>{tests.find((test) => test.id === testId)?.name || 'Chưa chọn xét nghiệm'} · M{level} · Lô {lot || '—'} · {date}</div></div>
    <div className="action-ident-groups">
      <div className="action-ident-group"><div className="action-ident-group-title"><b>Đối tượng QC</b><small>{record ? 'Khóa theo hồ sơ đã mở để bảo toàn bằng chứng' : 'Sự cố có thể gắn vào dòng vi phạm QC hoặc tạo từ nguồn khác'}</small></div>
        <div className="action-form-main">
          {field('Xét nghiệm', <select disabled={!!record || disabled} value={testId} onChange={(event) => setTestId(event.target.value)}><option value="">— Chọn xét nghiệm —</option>{tests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select>)}
          {field('Mức QC', <input disabled={!!record || disabled} value={level} onChange={(event) => setLevel(event.target.value)} />)}
          {field('Lô QC', <input disabled={!!record || disabled} value={lot} onChange={(event) => setLot(event.target.value)} />)}
        </div>
      </div>
      <div className="action-ident-group"><div className="action-ident-group-title"><b>Phân loại và phân công</b><small>Ghi rõ nguồn phát hiện, giai đoạn và người chịu trách nhiệm</small></div>
        <div className="action-form-meta">
          {field('Ngày ghi nhận', <DateField value={date} onChange={setDate} disabled={!!record || disabled} />)}
          {field('Luật vi phạm', <input disabled={!!record || disabled} value={rule} onChange={(event) => setRule(event.target.value)} />)}
          {field('Nguồn phát hiện', <NceSelect disabled={disabled} value={protocol.eventSource || ''} onChange={(value) => set('eventSource', value as never)} options={NCE_SOURCES} />)}
          {field('Giai đoạn', <NceSelect disabled={disabled} value={protocol.processPhase || ''} onChange={(value) => set('processPhase', value as never)} options={NCE_PHASES} />)}
          {field('Loại sai số', <select disabled={!!record || disabled} value={errorType} onChange={(event) => setErrorType(event.target.value)}><option value="">—</option><option value="SE">SE — hệ thống</option><option value="RE">RE — ngẫu nhiên</option></select>)}
          {field('Người phụ trách', <input disabled={disabled} value={protocol.owner || ''} onChange={(event) => set('owner', event.target.value)} placeholder="Họ tên" />)}
          {field('Hạn hoàn thành', <DateField value={dueDate} onChange={setDueDate} disabled={disabled} />)}
        </div>
      </div>
    </div>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>1</span><div><b>Kiểm soát và xử lý tức thời</b><small>Phần tối thiểu bắt buộc để lưu hồ sơ đang điều tra</small></div></summary>
      <div className="action-immediate-grid">
        {field('Phạm vi kiểm soát', <NceSelect disabled={disabled} value={protocol.containmentStatus || ''} onChange={(value) => set('containmentStatus', value as never)} options={[['', '— Chọn —'], ['held', 'Đã dừng/giữ kết quả liên quan'], ['none', 'Không có kết quả bệnh nhân liên quan']]} />)}
        {field('Ghi chú phạm vi', <input disabled={disabled} value={protocol.containmentNote || ''} onChange={(event) => set('containmentNote', event.target.value)} placeholder="VD: Giữ kết quả từ 08:00 đến khi QC đạt" />)}
        {field('Xử lý tức thời đã thực hiện', <textarea disabled={disabled} rows={2} value={protocol.correction || ''} onChange={(event) => set('correction', event.target.value)} placeholder="Dừng trả kết quả, cô lập vật liệu và thông báo phụ trách…" />)}
      </div>
    </details>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>2</span><div><b>Đánh giá nguy cơ FMEA</b><small>RPN = S × O × D; nêu căn cứ theo SOP của đơn vị</small></div><span className="action-chip neutral">RPN {initialRpn}</span></summary>
      <div className="action-risk-grid">{scale('riskSeverity', 'Mức độ ảnh hưởng (S)')}{scale('riskOccurrence', 'Khả năng xảy ra (O)')}{scale('riskDetectability', 'Khả năng không phát hiện (D)')}
        {field('Phân loại theo SOP', <NceSelect disabled={disabled} value={protocol.riskLevel || ''} onChange={(value) => set('riskLevel', value as never)} options={NCE_RISK} />)}
        {field('Căn cứ phân loại', <input disabled={disabled} value={protocol.riskBasis || ''} onChange={(event) => set('riskBasis', event.target.value)} placeholder="VD: SOP-QC-07, ma trận nguy cơ bảng 3" />)}
      </div>
    </details>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>3</span><div><b>Checklist điều tra</b><small>Ghi rõ bằng chứng khi bất thường hoặc không áp dụng</small></div></summary>
      <div className="action-investigation-grid">{NCE_CHECK_ROWS.map(([key, label]) => <div className="action-investigation-item" key={key}><div className="action-investigation-head"><b>{label}</b></div><div className="action-investigation-choices"><NceSelect disabled={disabled} value={String(protocol[`${key}Status` as keyof NceDetail] || '')} onChange={(value) => set(`${key}Status` as keyof NceDetail, value as never)} options={NCE_CHECKS} /></div><div className="action-investigation-note"><input disabled={disabled} value={String(protocol[`${key}Note` as keyof NceDetail] || '')} onChange={(event) => set(`${key}Note` as keyof NceDetail, event.target.value as never)} placeholder="Ghi chú / bằng chứng" /></div></div>)}</div>
    </details>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>4–6</span><div><b>Nguyên nhân gốc, hành động và trở lại dịch vụ</b><small>Tách hành động phòng ngừa tái diễn khỏi xử lý tức thời</small></div></summary>
      <div className="action-cause-grid">{field('Nhóm nguyên nhân', <NceSelect disabled={disabled} value={protocol.causeCategory || ''} onChange={(value) => set('causeCategory', value as never)} options={NCE_CAUSES} />)}{field('Nguyên nhân gốc hoặc nghi ngờ', <textarea disabled={disabled} rows={2} value={protocol.cause || ''} onChange={(event) => set('cause', event.target.value)} />)}{field('Hành động khắc phục', <textarea disabled={disabled} rows={2} value={protocol.action || ''} onChange={(event) => set('action', event.target.value)} />)}</div>
      <div className="action-cause-second-row">{field('Ngày hoàn thành hành động', <DateField value={protocol.actionCompletedDate || ''} onChange={(value) => set('actionCompletedDate', value)} disabled={disabled} />)}{field('Bias trước (%)', <input disabled={disabled} value={protocol.biasBefore || ''} onChange={(event) => set('biasBefore', event.target.value)} />)}{field('Bias sau (%)', <input disabled={disabled} value={protocol.biasAfter || ''} onChange={(event) => set('biasAfter', event.target.value)} />)}</div>
      {protocol.containmentStatus === 'held' && <div className="action-release-block"><div className="action-release-title"><b>Cho phép hoạt động/trả kết quả trở lại</b><small>Chỉ được cho phép sau khi có bằng chứng QC rerun đạt</small></div><div className="action-release-grid">{field('Quyết định', <NceSelect disabled={disabled} value={protocol.releaseStatus || ''} onChange={(value) => set('releaseStatus', value as never)} options={[['', '— Chưa quyết định —'], ['released', 'Đã cho phép trở lại']]} />)}{field('Ngày cho phép', <DateField value={protocol.releaseDate || ''} onChange={(value) => set('releaseDate', value)} disabled={disabled} />)}{field('Người cho phép', <input disabled={disabled} value={protocol.releaseBy || ''} onChange={(event) => set('releaseBy', event.target.value)} />)}{field('Căn cứ', <input disabled={disabled} value={protocol.releaseNote || ''} onChange={(event) => set('releaseNote', event.target.value)} placeholder="QC chạy lại được chấp nhận" />)}</div></div>}
    </details>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>7</span><div><b>Đánh giá ảnh hưởng bệnh nhân</b><small>Ghi rõ phạm vi và cách xử lý khi có kết quả liên quan</small></div></summary><div className="action-patient-grid">{field('Kết luận ảnh hưởng', <NceSelect disabled={disabled} value={protocol.patientImpact || ''} onChange={(value) => set('patientImpact', value as never)} options={NCE_PATIENT} />)}{field('Xử lý mẫu/kết quả liên quan', <textarea disabled={disabled} rows={2} value={protocol.patientAction || ''} onChange={(event) => set('patientAction', event.target.value)} />)}</div></details>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>8</span><div><b>Đánh giá hiệu lực và nguy cơ còn lại</b><small>Kết luận “hiệu quả” bắt buộc có FMEA còn lại, không vượt RPN ban đầu</small></div><span className="action-chip neutral">RPN {residualRpn}</span></summary>
      <div className="action-effectiveness-grid">{field('Kết luận hiệu lực', <NceSelect disabled={disabled} value={protocol.effectivenessStatus || 'pending'} onChange={(value) => set('effectivenessStatus', value as never)} options={[['pending', 'Chưa đánh giá'], ['effective', 'Có hiệu lực'], ['ineffective', 'Không hiệu lực']]} />)}{field('Ngày đánh giá', <DateField value={protocol.effectivenessDate || ''} onChange={(value) => set('effectivenessDate', value)} disabled={disabled} />)}{field('Bằng chứng/nhận xét', <textarea disabled={disabled} rows={2} value={protocol.effectivenessNote || ''} onChange={(event) => set('effectivenessNote', event.target.value)} />)}</div>
      {protocol.effectivenessStatus === 'effective' && <div className="action-residual-block"><div className="action-release-title"><b>Nguy cơ còn lại sau khắc phục</b><small>Dùng cùng thang điểm và SOP với đánh giá ban đầu</small></div><div className="action-residual-grid">{scale('residualSeverity', 'Mức độ (S)')}{scale('residualOccurrence', 'Khả năng xảy ra (O)')}{scale('residualDetectability', 'Khả năng không phát hiện (D)')}{field('Phân loại theo SOP', <NceSelect disabled={disabled} value={protocol.residualRiskLevel || ''} onChange={(value) => set('residualRiskLevel', value as never)} options={NCE_RISK} />)}{field('Căn cứ đánh giá lại', <input disabled={disabled} value={protocol.residualRiskBasis || ''} onChange={(event) => set('residualRiskBasis', event.target.value)} />)}</div></div>}
    </details>
    <div className="action-form-submit"><div><b>{record ? 'Cập nhật tiến độ hồ sơ' : 'Lưu hồ sơ đang điều tra'}</b><span>Có thể lưu dở; khi duyệt, hệ thống sẽ kiểm đầy đủ protocol và tính độc lập người duyệt.</span></div><div className="action-submit-buttons"><button type="button" className="btn ghost" onClick={onClose}>Đóng</button>{!readOnly && <button type="button" className="btn teal" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : record ? 'Lưu thay đổi' : 'Lập hồ sơ NCE'}</button>}</div></div>
  </div>;
}

function SectionTitle({ n, title }: { n?: number; title: string }) {
  return (
    <div className="action-form-section-title">
      {n != null && <span>{n}</span>}
      <b>{title}</b>
    </div>
  );
}

function DetailModal({ record, testName, onClose }: { record: NceRecord; testName: string; onClose: () => void }) {
  const store = useNceStore();
  const detail = parseDetail(record.detail_json);
  const [completedDate, setCompletedDate] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [releaseDecision, setReleaseDecision] = useState<'held' | 'released'>('held');
  const [releaseNote, setReleaseNote] = useState('');
  const [rerunPointId, setRerunPointId] = useState('');
  const [rerunPoints, setRerunPoints] = useState<QcPointView[]>([]);
  const [rerunNote, setRerunNote] = useState('');
  const [residualRisk, setResidualRisk] = useState('');
  const [effNote, setEffNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (record.test_id && record.level != null) {
      window.qcApi.queryPoints(record.test_id, record.level).then(setRerunPoints);
    }
  }, [record.test_id, record.level]);

  async function guard(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setErr(null);
    const result = await fn();
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  const canReview = record.record_status !== 'cancelled';

  return (
    <Modal title={`Hồ sơ ${record.nce_id} — ${testName}`} onClose={onClose} width={640}
      footer={<button className="btn ghost" onClick={onClose}>Đóng</button>}>
      {err && <p className="field-error">{err}</p>}

      <SectionTitle n={1} title="Nhận diện sự cố" />
      <p>Mức {record.level ?? '—'} · Lô {record.lot || '—'} · Ngày {record.date} · Luật {record.rule || '—'} · Loại lỗi {record.error_type || '—'}</p>
      {record.parent_nce_id && <p style={{ color: 'var(--muted)' }}>Vòng tiếp theo của hồ sơ {record.parent_nce_id}.</p>}

      <SectionTitle n={2} title="Điều tra" />
      <p>{detail.investigation || <span className="empty-state">Chưa ghi nhận.</span>}</p>

      <SectionTitle n={3} title="Nguyên nhân" />
      <p>{detail.causeCategory ? `${detail.causeCategory} — ` : ''}{detail.causeDescription || <span className="empty-state">Chưa ghi nhận.</span>}</p>

      <SectionTitle n={4} title="Khắc phục" />
      <p>{detail.correction}</p>
      <p style={{ color: 'var(--muted)' }}>Hạn hoàn thành: {record.due_date || '—'}</p>

      <SectionTitle n={5} title="Rerun (bằng chứng)" />
      {detail.rerunSnapshot ? (
        <p>Điểm {detail.rerunSnapshot.date} lần {detail.rerunSnapshot.runId}, giá trị {detail.rerunSnapshot.val}. {detail.rerunNote}</p>
      ) : canReview ? (
        <div className="field-row">
          <div className="field">
            <label>Chọn điểm QC rerun</label>
            <select value={rerunPointId} onChange={(e) => setRerunPointId(e.target.value)}>
              <option value="">Chọn điểm</option>
              {rerunPoints.map((p) => <option key={p.id} value={p.id}>{p.date} · lần {p.run_id} · {p.val}</option>)}
            </select>
          </div>
          <div className="field"><label>Ghi chú</label><input value={rerunNote} onChange={(e) => setRerunNote(e.target.value)} /></div>
          <div className="field"><label>&nbsp;</label><button className="btn ghost sm" disabled={!rerunPointId} onClick={() => guard(() => store.setRerunEvidence(record.id, rerunPointId, rerunNote))}>Gắn bằng chứng</button></div>
        </div>
      ) : <p className="empty-state">Chưa có.</p>}

      <SectionTitle n={6} title="Release-to-service" />
      {detail.releaseDecision ? (
        <p>{detail.releaseDecision === 'released' ? 'Đã phát hành' : 'Đang giữ kết quả'} — {detail.releaseNote} ({detail.releaseDecidedBy})</p>
      ) : canReview ? (
        <div className="field-row">
          <select value={releaseDecision} onChange={(e) => setReleaseDecision(e.target.value as never)}>
            <option value="held">Giữ kết quả</option><option value="released">Phát hành</option>
          </select>
          <div className="field"><label>Căn cứ</label><input value={releaseNote} onChange={(e) => setReleaseNote(e.target.value)} /></div>
          <div className="field"><label>&nbsp;</label><button className="btn ghost sm" onClick={() => guard(() => store.setReleaseDecision(record.id, releaseDecision, releaseNote))}>Lưu quyết định</button></div>
        </div>
      ) : <p className="empty-state">Chưa có.</p>}

      <SectionTitle n={7} title="Hiệu lực" />
      {!record.action_completed_date && canReview && (
        <div className="field-row">
          <DateField label="Ngày hoàn thành hành động" value={completedDate} onChange={setCompletedDate} />
          <div className="field"><label>&nbsp;</label><button className="btn ghost sm" disabled={!completedDate} onClick={() => guard(() => store.setCompletedDate(record.id, completedDate))}>Lưu ngày hoàn thành</button></div>
        </div>
      )}
      {record.action_completed_date && record.effectiveness_status === 'pending' && canReview && (
        <>
          <p style={{ color: 'var(--muted)' }}>Hoàn thành hành động: {record.action_completed_date}</p>
          <SectionTitle n={8} title="Đánh giá rủi ro còn lại (bắt buộc trước khi kết luận hiệu quả)" />
          <div className="field"><textarea rows={2} placeholder="Rủi ro còn lại sau khắc phục" value={residualRisk} onChange={(e) => setResidualRisk(e.target.value)} /></div>
          <div className="field"><label>Ghi chú hiệu lực</label><input value={effNote} onChange={(e) => setEffNote(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn teal sm" onClick={() => guard(() => store.markEffectiveness(record.id, 'effective', residualRisk, effNote))}>Hiệu quả</button>
            <button className="btn danger sm" onClick={() => guard(() => store.markEffectiveness(record.id, 'ineffective', undefined, effNote))}>Không hiệu quả</button>
          </div>
        </>
      )}
      {record.effectiveness_status !== 'pending' && (
        <>
          <p><span className={`badge ${record.effectiveness_status === 'effective' ? 'ok' : 'rej'}`}>{record.effectiveness_status === 'effective' ? 'Hiệu quả' : 'Không hiệu quả'}</span> {detail.effectivenessNote}</p>
          {detail.residualRisk && <p style={{ color: 'var(--muted)' }}>Rủi ro còn lại: {detail.residualRisk}</p>}
          {record.effectiveness_status === 'ineffective' && !record.follow_up_nce_id && canReview && (
            <button className="btn ghost sm" onClick={() => guard(() => store.reopen(record.id, 'Chưa hiệu quả, mở vòng tiếp theo'))}>Mở vòng tiếp theo</button>
          )}
          {record.follow_up_nce_id && <p style={{ color: 'var(--muted)' }}>Đã mở vòng tiếp theo.</p>}
        </>
      )}

      {canReview && (
        <>
          <SectionTitle title="Duyệt hồ sơ" />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {record.approval_status !== 'approved' && <button className="btn teal sm" onClick={() => guard(() => store.approve(record.id))}>Duyệt</button>}
            <input placeholder="Lý do trả lại/huỷ" value={returnNote || cancelNote} onChange={(e) => { setReturnNote(e.target.value); setCancelNote(e.target.value); }} style={{ width: 200 }} />
            <button className="btn ghost sm" onClick={() => guard(() => store.returnForRevision(record.id, returnNote))}>Trả lại</button>
            {record.approval_status !== 'approved' && (
              <button className="btn danger sm" onClick={async () => { if (await confirmDialog('Hủy hồ sơ này?', { danger: true })) guard(() => store.cancel(record.id, cancelNote)); }}>Hủy hồ sơ</button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

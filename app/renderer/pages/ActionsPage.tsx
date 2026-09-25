import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useNceStore } from '../store/nce-store';
import { useWestgardStore } from '../store/westgard-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { DateField } from '../components/DateField';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useAuthStore } from '../store/auth-store';
import { canWrite } from '../lib/permissions';
import type { NceRecord, NceDetail, QcPointView } from '../../shared/qc-api';
import { vnDate as formatVnDate, todayIso } from '../lib/format';
import { formatAuditDateTimeVN } from '../../main/domain/audit-format';
import type { NceBiasSuggestion } from '../../main/domain/nce-bias-suggestion';
import { errorClass, normalizeErrorClass } from '../../main/domain/westgard-rules';

/** Nhãn trạng thái NGẮN của hệ thống (`reportLabels.stateName`). */
const TREE_STATE: Record<string, string> = { rej: 'Loại', warn: 'Cảnh báo', ok: 'Đạt', none: 'Chưa có' };
/** `vnDate()` hệ thống. */
const vnDate = (iso: string) => formatVnDate(iso, '—');

const GUIDE_STEPS = [
  { title: 'Ghi nhận sự cố', body: 'Xác định xét nghiệm, mức QC, lô, ngày, nguồn phát hiện và quy tắc/loại sai số; chỉ định người phụ trách.', note: 'Khóa định danh sau khi đã mở hồ sơ' },
  { title: 'Kiểm soát tức thời', body: 'Khoanh vùng sự cố, giữ kết quả liên quan khi cần và ghi rõ biện pháp đã thực hiện trước khi điều tra.', note: 'Ưu tiên an toàn người bệnh' },
  { title: 'Đánh giá nguy cơ FMEA', body: 'Chấm mức độ ảnh hưởng, khả năng xảy ra và khả năng không phát hiện (S × O × D); nêu căn cứ theo SOP.', note: 'Ghi RPN và mức nguy cơ ban đầu' },
  { title: 'Điều tra có bằng chứng', body: 'Rà soát vật liệu QC, máy, hóa chất/calibrator, hiệu chuẩn và so sánh lô; ghi bằng chứng cho mọi bất thường.', note: 'Không thay bằng nhận định chung chung' },
  { title: 'Nguyên nhân gốc và CAPA', body: 'Nêu nguyên nhân gốc hoặc nghi ngờ, hành động khắc phục/phòng ngừa tái diễn, người phụ trách và hạn hoàn thành.', note: 'Tách khỏi xử lý tức thời' },
  { title: 'QC rerun và trở lại dịch vụ', body: 'Gắn một điểm QC rerun thật, cùng xét nghiệm và chạy sau sự cố. Nếu đã giữ kết quả, chỉ cho phép trở lại khi có bằng chứng đạt và quyết định có căn cứ.', note: 'Không dùng mô tả tay thay bằng chứng' },
  { title: 'Rà soát ảnh hưởng người bệnh', body: 'Kết luận phạm vi mẫu/kết quả bị ảnh hưởng và ghi rõ cách giữ, rà soát hoặc xử lý lại khi có liên quan.', note: 'Áp dụng theo phạm vi sự cố' },
  { title: 'Đánh giá hiệu lực và phê duyệt', body: 'Sau khi hoàn thành hành động, đánh giá hiệu lực. Nếu kết luận hiệu quả, đánh giá lại nguy cơ còn lại; người lập/người sửa không được tự duyệt.', note: 'Không hiệu quả thì chỉ mở một vòng tiếp theo' },
];

function parseDetail(json: string): NceDetail {
  try { return JSON.parse(json || '{}'); } catch { return {}; }
}

/** Dòng NCE phải gắn vào đúng điểm đã tạo cảnh báo, không chỉ test+mức. */
type NcePrefill = { testId: string; level: number; pointId: string; lot: string; date: string; rule: string; errorType: 'SE' | 'RE' | '' };

export function ActionsPage() {
  const location = useLocation();
  const { tests, loadTests } = useManageStore();
  const store = useNceStore();
  const { summaries, loadSummaries } = useWestgardStore();
  const [form, setForm] = useState<{ prefill: NcePrefill | null; record: NceRecord | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const requestedRecordId = useRef((location.state as { recordId?: string } | null)?.recordId || '');
  const writable = canWrite(useAuthStore((s) => s.user)?.role);

  /** Hủy hồ sơ ngay từ bảng nhật ký — hệ thống có nút này trên từng dòng. Hủy
   * CÓ LƯU VẾT (soft-delete + lý do), không xoá dữ liệu. */
  async function cancelRecord(id: string) {
    const note = 'Hủy từ bảng nhật ký';
    if (!(await confirmDialog('Hủy hồ sơ này? Dữ liệu được giữ lại để truy xuất.', { title: 'Hủy hồ sơ NCE', danger: true, confirmLabel: 'Hủy hồ sơ' }))) return;
    const result = await store.cancel(id, note);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  /** Xuất CSV nhật ký — cùng cơ chế `downloadCsv` đã dùng ở Audit/Report. */
  const exportLogCsv = () => exportNceLogCsv(store.records, testName);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { loadTests(); store.load(); loadSummaries(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!requestedRecordId.current) return;
    const record = store.records.find(item => item.id === requestedRecordId.current);
    if (record) {
      requestedRecordId.current = '';
      setForm({ prefill: null, record });
    }
  }, [store.records]);
  useStoreInvalidation(['actions'], undefined, store.load);
  useStoreInvalidation(['qc_points', 'tests'], undefined, loadSummaries);

  const testName = (id: string | null) => tests.find((t) => t.id === id)?.name ?? '(không rõ)';
  const detailRecord = store.records.find((r) => r.id === detailId) || null;

  const issueGroups = useMemo(() => {
    const groups: {
      key: string; testName: string; date: string; severity: 'warn' | 'rej'; count: number;
      items: {
        key: string; testId: string; level: number; pointId: string; lot: string; date: string; rule: string; errorType: 'SE' | 'RE' | ''; severity: 'warn' | 'rej';
        levelLabel: string; state: string; meta: string; footer: string; guidance: string;
        openRecordId: string | null;
      }[];
    }[] = [];
    for (const s of summaries) {
      const items = s.levels
        .filter((lv) => (lv.latestVerdict === 'warn' || lv.latestVerdict === 'rej') && lv.latest)
        .map((lv) => {
          // hệ thống gắn hồ sơ với dòng sự cố theo ĐIỂM QC (`pointId`), không
          // theo test+mức: một hồ sơ chưa gắn điểm nào thì dòng vi phạm vẫn
          // hiện "Chưa ghi khắc phục" và nút "Lập hồ sơ".
          const open = lv.latest
            ? store.records.find((r) => r.record_status === 'active' && r.point_id === lv.latest!.id)
            : undefined;
          const errorType = errorClass(lv.latestRules);
          const err = errorType === 'SE' ? 'SE — Sai số hệ thống' : errorType === 'RE' ? 'RE — Sai số ngẫu nhiên' : 'Chưa phân loại';
          return {
            key: `${s.testId}:${lv.level}`, testId: s.testId, level: lv.level,
            pointId: lv.latest!.id, lot: lv.lot, date: lv.latest!.date, rule: lv.latestRules.join(', '), errorType,
            severity: lv.latestVerdict as 'warn' | 'rej',
            levelLabel: `M${lv.level} · Lô ${lv.lot || '—'}`,
            state: TREE_STATE[lv.latestVerdict],
            meta: `${lv.latest ? lv.latest.val.toFixed(s.decimalPlaces) : '—'} ${s.unit || ''} · ${lv.latestRules.join(', ') || '—'} · ${err}`,
            footer: open ? 'Đã có hồ sơ đang mở' : 'Chưa ghi khắc phục',
            guidance: errorType === 'RE'
              ? 'Rà soát bọt khí, thể tích hút, vật liệu QC, điện áp và thao tác.'
              : errorType === 'SE' ? 'Rà soát xu hướng, hiệu chuẩn, hóa chất/calibrator và tình trạng thiết bị.' : 'Theo dõi theo SOP; chưa đủ căn cứ để phân loại sai số.',
            openRecordId: open ? open.id : null,
          };
        });
      if (!items.length) continue;
      const newest = items.reduce((latest, item) => item.date > latest ? item.date : latest, '');
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


      <div className="panel">
        <div className="action-card-head">
          <div><h2 className="panel-title">Sự cố cần xử lý</h2><p>Theo dõi cảnh báo và vi phạm QC theo đúng điểm phát sinh.</p></div>
          {issueCount > 0 && <span className="tag warn">{issueCount} sự cố</span>}
        </div>
        <div className="action-issues-body">
          {!issueGroups.length
            ? <div className="alert ok">Không có cảnh báo hoặc vi phạm QC cần xử lý.</div>
            : issueGroups.map((group) => (
              <div className={`issue-group ${group.severity}`} key={group.key}>
                <div className="issue-group-h">
                  <div><b>{group.testName}</b><span className="issue-group-date">{group.date}</span></div>
                  <span className="issue-group-count">{group.count} sự cố cần xử lý</span>
                </div>
                <div className="issue-group-body">
                  {group.items.map((item) => (
                    <div className={`issue-row ${item.severity}`} key={item.key}>
                      <div className="issue-row-main">
                        <b>{item.levelLabel} · {item.state}</b>
                        <div className="meta">{item.meta}</div>
                        <div className="action-chipline"><span className={`tag ${item.severity === 'rej' ? 'rej' : 'warn'}`}>{item.footer}</span></div>
                        <div className="hint">{item.guidance}</div>
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
          <div><h2 className="panel-title">Lập hồ sơ sự không phù hợp (NCE)</h2><p>Lưu tiến độ điều tra, bằng chứng rerun và quyết định khép vòng trong cùng một hồ sơ.</p></div>
          <button type="button" className="btn ghost sm" onClick={() => setShowGuide(true)}>Quy trình 8 bước</button>
        </div>
        {form ? <NceProtocolForm prefill={form.prefill} record={form.record} onClose={() => setForm(null)} /> : <EmptyState
          title={issueCount ? 'Chọn một sự cố để lập hồ sơ' : 'Không có vi phạm nào cần lập hồ sơ'}
          action={writable && <button type="button" className="btn ghost" onClick={() => setForm({ prefill: null, record: null })}>Lập hồ sơ từ nguồn khác</button>}
        >{issueCount
          ? `Có ${issueCount} sự cố ở trên — bấm "Lập hồ sơ" ngay trên dòng cần xử lý để hồ sơ được gắn đúng điểm QC và tự theo dõi QC chạy lại.`
          : 'Hồ sơ NCE thường bắt đầu từ một vi phạm QC. Khi không có vi phạm nào, chỉ mở hồ sơ khi thực sự cần ghi nhận sự không phù hợp khác.'}
        </EmptyState>}
      </div>

      <ActionLogPanel
        records={store.records}
        testName={testName}
        writable={writable}
        onDetail={setDetailId}
        onContinue={(record) => setForm({ prefill: null, record })}
        onCancel={cancelRecord}
        onExport={exportLogCsv}
      />

      {detailRecord && <DetailModal record={detailRecord} testName={testName(detailRecord.test_id)} onClose={() => setDetailId(null)} />}
      {showGuide && <NceGuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}

function exportNceLogCsv(records: NceRecord[], testName: (id: string | null) => string) {
  const header = ['nceId', 'test', 'date', 'level', 'lot', 'rule', 'errorType', 'correction', 'approval', 'effectiveness', 'recordStatus', 'dueDate'];
  const csvCell = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header.join(',')];
  for (const record of records) {
    const detail = parseDetail(record.detail_json);
    lines.push([
      record.nce_id, testName(record.test_id), vnDate(record.date), record.level ?? '', record.lot || '', record.rule,
      normalizeErrorClass(record.error_type), detail.correction || '', record.approval_status, record.effectiveness_status,
      record.record_status, record.due_date ? vnDate(record.due_date) : '',
    ].map(csvCell).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nhat-ky-khac-phuc.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ActionLogPanel({
  records, testName, writable, onDetail, onContinue, onCancel, onExport,
}: {
  records: NceRecord[];
  testName: (id: string | null) => string;
  writable: boolean;
  onDetail: (id: string) => void;
  onContinue: (record: NceRecord) => void;
  onCancel: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="panel action-log-panel">
      <div className="action-card-head">
        <div><h2 className="panel-title">Nhật ký khắc phục</h2><p>Toàn bộ hồ sơ NCE được lưu vết, kể cả hồ sơ đã hủy.</p></div>
        {records.length ? <button type="button" className="btn teal sm" onClick={onExport}>Xuất CSV nhật ký</button> : null}
      </div>
      {records.length ? (
        <>
          <div className="action-log-wrap"><table className="action-log-table">
            <thead><tr><th scope="col">Thời điểm</th><th scope="col">Sự cố</th><th scope="col">Hành động</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>
              {records.map((record) => {
                const detail = parseDetail(record.detail_json);
                const cancelled = record.record_status === 'cancelled';
                return (
                  <tr key={record.id} className={cancelled ? 'action-log-row-cancelled' : undefined}>
                    <td>
                      <div className="action-date">{vnDate(record.date)}</div>
                      {record.created_at ? <div className="action-time">Mở: {formatAuditDateTimeVN(record.created_at)}</div> : null}
                    </td>
                    <td>
                      <div className="action-test">{record.nce_id} · {testName(record.test_id)}</div>
                      <div className="action-sub">M{record.level ?? '—'} · Lô {record.lot || '—'}</div>
                      <div className="action-rule">{record.rule || '—'} · {errorClassLabel(record.error_type)}</div>
                    </td>
                    <td>
                      <div className="action-text">{detail.correction || '—'}</div>
                      <div className="action-sub">Phụ trách: {detail.owner || '—'}{record.due_date ? ` · hạn ${vnDate(record.due_date)}` : ''}</div>
                    </td>
                    <td><div className="action-status-stack">
                      <span className={`tag ${cancelled ? 'none' : record.approval_status === 'approved' ? 'ok' : record.approval_status === 'returned' ? 'rej' : 'warn'}`}>
                        {cancelled ? 'Đã huỷ' : record.approval_status === 'approved' ? 'Đã duyệt' : record.approval_status === 'returned' ? 'Trả lại' : 'Chờ duyệt'}
                      </span>
                      <span className={`tag ${record.effectiveness_status === 'effective' ? 'ok' : record.effectiveness_status === 'ineffective' ? 'rej' : 'none'}`}>
                        {record.effectiveness_status === 'effective' ? 'Hiệu quả' : record.effectiveness_status === 'ineffective' ? 'Không hiệu quả' : 'Chưa đánh giá'}
                      </span>
                      {record.parent_nce_id ? <span className="tag none">vòng tiếp</span> : null}
                    </div></td>
                    <td><div className="action-row-actions">
                      <button type="button" className="btn ghost sm" onClick={() => onDetail(record.id)}>Chi tiết</button>
                      {!cancelled && record.approval_status !== 'approved' && <button type="button" className="btn ghost sm" onClick={() => onContinue(record)}>Tiếp tục</button>}
                      {!cancelled && record.approval_status !== 'approved' && writable && <button type="button" className="btn danger sm" title="Hủy có lưu vết — không xóa dữ liệu" onClick={() => onCancel(record.id)}>Hủy hồ sơ</button>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </>
      ) : (
        <EmptyState title="Chưa có nhật ký">Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.</EmptyState>
      )}
    </div>
  );
}

function NceGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Quy trình xử lý sự cố — 8 bước" size="lg" onClose={onClose}>
      <div className="action-guide-intro">Thực hiện theo thứ tự để hồ sơ NCE đủ bằng chứng, kiểm soát được nguy cơ và có thể khép vòng độc lập.</div>
      <ol className="action-guide-steps">
        {GUIDE_STEPS.map((step, index) => <li className="action-guide-step" key={step.title}>
          <span className="step-number">{index + 1}</span>
          <div><b>{step.title}</b><p>{step.body}</p><small>{step.note}</small></div>
        </li>)}
      </ol>
    </Modal>
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

/** Form protocol-v3 đặt ngay trong panel như hệ thống. Modal chỉ còn dùng cho
 * xem chi tiết/bằng chứng, tránh một form dài bị bó hẹp trong cửa sổ popup. */
function NceProtocolForm({ prefill, record, onClose }: { prefill: NcePrefill | null; record: NceRecord | null; onClose: () => void }) {
  const { tests } = useManageStore(); const store = useNceStore();
  const latestSigmaBias = useNceStore((state) => state.latestSigmaBias);
  const old = record ? parseDetail(record.detail_json) : {};
  const [protocol, setProtocol] = useState<NceDetail>(() => protocolDefaults(old, record));
  const [testId, setTestId] = useState(record?.test_id || prefill?.testId || '');
  const [level, setLevel] = useState(String(record?.level ?? prefill?.level ?? 1)); const [lot, setLot] = useState(record?.lot || prefill?.lot || '');
  const [date, setDate] = useState(record?.date || prefill?.date || todayIso()); const [rule, setRule] = useState(record?.rule || prefill?.rule || '');
  const [errorType, setErrorType] = useState(normalizeErrorClass(record?.error_type || prefill?.errorType || '')); const [dueDate, setDueDate] = useState(record?.due_date || '');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const [biasSuggestion, setBiasSuggestion] = useState<NceBiasSuggestion | null>(null);
  const biasRequest = useRef(0);
  const readOnly = record?.record_status === 'cancelled' || record?.approval_status === 'approved';
  const set = <K extends keyof NceDetail>(key: K, value: NceDetail[K]) => setProtocol((current) => ({ ...current, [key]: value }));
  const number = <K extends keyof NceDetail>(key: K, value: string) => set(key, (Number(value) || 0) as NceDetail[K]);
  const initialRpn = riskScore(protocol.riskSeverity, protocol.riskOccurrence, protocol.riskDetectability);
  const residualRpn = riskScore(protocol.residualSeverity, protocol.residualOccurrence, protocol.residualDetectability);

  const refreshBiasSuggestion = useCallback(async () => {
    const request = ++biasRequest.current;
    if (!testId || !Number(level)) { setBiasSuggestion(null); return; }
    const suggestion = await latestSigmaBias(testId, Number(level));
    if (request === biasRequest.current) setBiasSuggestion(suggestion);
  }, [latestSigmaBias, level, testId]);

  useEffect(() => { void refreshBiasSuggestion(); }, [refreshBiasSuggestion]);
  useStoreInvalidation(['sigma_data'], testId || undefined, () => { void refreshBiasSuggestion(); });

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

  const biasField = (label: string, key: 'biasBefore' | 'biasAfter', suggestion = false) => field(label, <div className="action-bias-field">
    <input disabled={disabled} value={protocol[key] || ''} onChange={(event) => set(key, event.target.value)} inputMode="decimal" />
    {suggestion && biasSuggestion && !disabled && <button type="button" className="btn ghost sm action-bias-suggestion" onClick={() => set('biasBefore', String(biasSuggestion.value))}>
      Dùng Bias EQA/EQC kỳ {biasSuggestion.period}: {biasSuggestion.value}%
    </button>}
  </div>);

  return <div className="action-form-body">
    {error && <div className="alert danger">{error}</div>}
    <div className="action-incident-banner"><b>{record ? `Đang tiếp tục hồ sơ ${record.nce_id}` : 'Đang lập hồ sơ NCE'}</b><div>{tests.find((test) => test.id === testId)?.name || 'Chưa chọn xét nghiệm'} · M{level} · Lô {lot || '—'} · {vnDate(date)}</div></div>
    <div className="action-form-step-ident"><span className="step-number">1</span><div><b>Nhận diện và phân công sự cố</b><small>Ghi đúng đối tượng QC, nguồn phát hiện và người phụ trách trước khi điều tra.</small></div></div>
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
          {field('Loại sai số', <select disabled={!!record || disabled} value={errorType} onChange={(event) => setErrorType(normalizeErrorClass(event.target.value))}><option value="">—</option><option value="SE">SE — hệ thống</option><option value="RE">RE — ngẫu nhiên</option></select>)}
          {field('Người phụ trách', <input disabled={disabled} value={protocol.owner || ''} onChange={(event) => set('owner', event.target.value)} placeholder="Họ tên" />)}
          {field('Hạn hoàn thành', <DateField value={dueDate} onChange={setDueDate} disabled={disabled} />)}
        </div>
      </div>
    </div>
    <details className="action-form-section" open><summary className="action-form-section-title"><span>2</span><div><b>Kiểm soát và xử lý tức thời</b><small>Phần tối thiểu bắt buộc để lưu hồ sơ đang điều tra</small></div></summary>
      <div className="action-immediate-grid">
        {field('Phạm vi kiểm soát', <NceSelect disabled={disabled} value={protocol.containmentStatus || ''} onChange={(value) => set('containmentStatus', value as never)} options={[['', '— Chọn —'], ['held', 'Đã dừng/giữ kết quả liên quan'], ['none', 'Không có kết quả bệnh nhân liên quan']]} />)}
        {field('Ghi chú phạm vi', <input disabled={disabled} value={protocol.containmentNote || ''} onChange={(event) => set('containmentNote', event.target.value)} placeholder="VD: Giữ kết quả từ 08:00 đến khi QC đạt" />)}
        {field('Xử lý tức thời đã thực hiện', <textarea disabled={disabled} rows={2} value={protocol.correction || ''} onChange={(event) => set('correction', event.target.value)} placeholder="Dừng trả kết quả, cô lập vật liệu và thông báo phụ trách…" />)}
      </div>
    </details>
    <details className="action-form-section"><summary className="action-form-section-title"><span>3</span><div><b>Đánh giá nguy cơ FMEA</b><small>RPN = S × O × D; nêu căn cứ theo SOP của đơn vị</small></div><span className="tag none">RPN {initialRpn}</span></summary>
      <div className="action-risk-grid">{scale('riskSeverity', 'Mức độ ảnh hưởng (S)')}{scale('riskOccurrence', 'Khả năng xảy ra (O)')}{scale('riskDetectability', 'Khả năng không phát hiện (D)')}
        {field('Phân loại theo SOP', <NceSelect disabled={disabled} value={protocol.riskLevel || ''} onChange={(value) => set('riskLevel', value as never)} options={NCE_RISK} />)}
        {field('Căn cứ phân loại', <input disabled={disabled} value={protocol.riskBasis || ''} onChange={(event) => set('riskBasis', event.target.value)} placeholder="VD: SOP-QC-07, ma trận nguy cơ bảng 3" />)}
      </div>
    </details>
    <details className="action-form-section"><summary className="action-form-section-title"><span>4</span><div><b>Checklist điều tra</b><small>Ghi rõ bằng chứng khi bất thường hoặc không áp dụng</small></div></summary>
      <div className="action-investigation-grid">{NCE_CHECK_ROWS.map(([key, label]) => <div className="action-investigation-item" key={key}><div className="action-investigation-head"><b>{label}</b></div><div className="action-investigation-choices"><NceSelect disabled={disabled} value={String(protocol[`${key}Status` as keyof NceDetail] || '')} onChange={(value) => set(`${key}Status` as keyof NceDetail, value as never)} options={NCE_CHECKS} /></div><div className="action-investigation-note"><input disabled={disabled} value={String(protocol[`${key}Note` as keyof NceDetail] || '')} onChange={(event) => set(`${key}Note` as keyof NceDetail, event.target.value as never)} placeholder="Ghi chú / bằng chứng" /></div></div>)}</div>
    </details>
    <details className="action-form-section"><summary className="action-form-section-title"><span>5–6</span><div><b>Nguyên nhân gốc, hành động và trở lại dịch vụ</b><small>Tách hành động phòng ngừa tái diễn khỏi xử lý tức thời</small></div></summary>
      <div className="action-cause-grid">{field('Nhóm nguyên nhân', <NceSelect disabled={disabled} value={protocol.causeCategory || ''} onChange={(value) => set('causeCategory', value as never)} options={NCE_CAUSES} />)}{field('Nguyên nhân gốc hoặc nghi ngờ', <textarea disabled={disabled} rows={2} value={protocol.cause || ''} onChange={(event) => set('cause', event.target.value)} />)}{field('Hành động khắc phục', <textarea disabled={disabled} rows={2} value={protocol.action || ''} onChange={(event) => set('action', event.target.value)} />)}</div>
      <div className="action-cause-second-row">{field('Ngày hoàn thành hành động', <DateField value={protocol.actionCompletedDate || ''} onChange={(value) => set('actionCompletedDate', value)} disabled={disabled} />)}{biasField('Bias trước (%)', 'biasBefore', true)}{biasField('Bias sau (%)', 'biasAfter')}</div>
      {protocol.containmentStatus === 'held' && <div className="action-release-block"><div className="action-release-title"><b>Cho phép hoạt động/trả kết quả trở lại</b><small>Chỉ được cho phép sau khi có bằng chứng QC rerun đạt</small></div><div className="action-release-grid">{field('Quyết định', <NceSelect disabled={disabled} value={protocol.releaseStatus || ''} onChange={(value) => set('releaseStatus', value as never)} options={[['', '— Chưa quyết định —'], ['released', 'Đã cho phép trở lại']]} />)}{field('Ngày cho phép', <DateField value={protocol.releaseDate || ''} onChange={(value) => set('releaseDate', value)} disabled={disabled} />)}{field('Người cho phép', <input disabled={disabled} value={protocol.releaseBy || ''} onChange={(event) => set('releaseBy', event.target.value)} />)}{field('Căn cứ', <input disabled={disabled} value={protocol.releaseNote || ''} onChange={(event) => set('releaseNote', event.target.value)} placeholder="QC chạy lại được chấp nhận" />)}</div></div>}
    </details>
    <details className="action-form-section"><summary className="action-form-section-title"><span>7</span><div><b>Đánh giá ảnh hưởng bệnh nhân</b><small>Ghi rõ phạm vi và cách xử lý khi có kết quả liên quan</small></div></summary><div className="action-patient-grid">{field('Kết luận ảnh hưởng', <NceSelect disabled={disabled} value={protocol.patientImpact || ''} onChange={(value) => set('patientImpact', value as never)} options={NCE_PATIENT} />)}{field('Xử lý mẫu/kết quả liên quan', <textarea disabled={disabled} rows={2} value={protocol.patientAction || ''} onChange={(event) => set('patientAction', event.target.value)} />)}</div></details>
    <details className="action-form-section"><summary className="action-form-section-title"><span>8</span><div><b>Đánh giá hiệu lực và nguy cơ còn lại</b><small>Kết luận “hiệu quả” bắt buộc có FMEA còn lại, không vượt RPN ban đầu</small></div><span className="tag none">RPN {residualRpn}</span></summary>
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
      // Đọc TỨC THỜI cho ô chọn bằng chứng rerun trong modal chi tiết —
      // không phải dữ liệu hiển thị của trang nên không đưa vào store.
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
    <Modal title={`Hồ sơ ${record.nce_id} — ${testName}`} onClose={onClose}
      footer={<button className="btn ghost" onClick={onClose}>Đóng</button>}>
      {err && <p className="field-error">{err}</p>}

      <SectionTitle n={1} title="Nhận diện sự cố" />
      <p>Mức {record.level ?? '—'} · Lô {record.lot || '—'} · Ngày {vnDate(record.date)} · Luật {record.rule || '—'} · Loại lỗi {errorClassLabel(record.error_type)}</p>
      {record.parent_nce_id && <p className="action-detail-muted">Vòng tiếp theo của hồ sơ {record.parent_nce_id}.</p>}

      <SectionTitle n={2} title="Điều tra" />
      <p>{detail.investigation || <span className="hint-inline">Chưa ghi nhận.</span>}</p>

      <SectionTitle n={3} title="Nguyên nhân" />
      <p>{detail.causeCategory ? `${detail.causeCategory} — ` : ''}{detail.causeDescription || <span className="hint-inline">Chưa ghi nhận.</span>}</p>

      <SectionTitle n={4} title="Khắc phục" />
      <p>{detail.correction}</p>
      <p className="action-detail-muted">Hạn hoàn thành: {record.due_date ? vnDate(record.due_date) : '—'}</p>

      <SectionTitle n={5} title="Rerun (bằng chứng)" />
      {detail.rerunSnapshot ? (
        <p>Điểm {vnDate(detail.rerunSnapshot.date)} lần {detail.rerunSnapshot.runId}, giá trị {detail.rerunSnapshot.val}. {detail.rerunNote}</p>
      ) : canReview ? (
        <div className="field-row">
          <div className="field">
            <label>Chọn điểm QC rerun</label>
            <select value={rerunPointId} onChange={(e) => setRerunPointId(e.target.value)}>
              <option value="">Chọn điểm</option>
              {rerunPoints.map((p) => <option key={p.id} value={p.id}>{vnDate(p.date)} · lần {p.run_id} · {p.val}</option>)}
            </select>
          </div>
          <div className="field"><label>Ghi chú</label><input value={rerunNote} onChange={(e) => setRerunNote(e.target.value)} /></div>
          <div className="field"><label>&nbsp;</label><button className="btn ghost sm" disabled={!rerunPointId} onClick={() => guard(() => store.setRerunEvidence(record.id, rerunPointId, rerunNote))}>Gắn bằng chứng</button></div>
        </div>
      ) : <p className="hint-inline">Chưa có.</p>}

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
      ) : <p className="hint-inline">Chưa có.</p>}

      <SectionTitle n={7} title="Hiệu lực" />
      {!record.action_completed_date && canReview && (
        <div className="field-row">
          <DateField label="Ngày hoàn thành hành động" value={completedDate} onChange={setCompletedDate} />
          <div className="field"><label>&nbsp;</label><button className="btn ghost sm" disabled={!completedDate} onClick={() => guard(() => store.setCompletedDate(record.id, completedDate))}>Lưu ngày hoàn thành</button></div>
        </div>
      )}
      {record.action_completed_date && record.effectiveness_status === 'pending' && canReview && (
        <>
          <p className="action-detail-muted">Hoàn thành hành động: {vnDate(record.action_completed_date)}</p>
          <SectionTitle n={8} title="Đánh giá rủi ro còn lại (bắt buộc trước khi kết luận hiệu quả)" />
          <div className="field"><textarea rows={2} placeholder="Rủi ro còn lại sau khắc phục" value={residualRisk} onChange={(e) => setResidualRisk(e.target.value)} /></div>
          <div className="field"><label>Ghi chú hiệu lực</label><input value={effNote} onChange={(e) => setEffNote(e.target.value)} /></div>
          <div className="action-detail-actions">
            <button className="btn teal sm" onClick={() => guard(() => store.markEffectiveness(record.id, 'effective', residualRisk, effNote))}>Hiệu quả</button>
            <button className="btn danger sm" onClick={() => guard(() => store.markEffectiveness(record.id, 'ineffective', undefined, effNote))}>Không hiệu quả</button>
          </div>
        </>
      )}
      {record.effectiveness_status !== 'pending' && (
        <>
          <p><span className={`tag ${record.effectiveness_status === 'effective' ? 'ok' : 'rej'}`}>{record.effectiveness_status === 'effective' ? 'Hiệu quả' : 'Không hiệu quả'}</span> {detail.effectivenessNote}</p>
          {detail.residualRisk && <p className="action-detail-muted">Rủi ro còn lại: {detail.residualRisk}</p>}
          {record.effectiveness_status === 'ineffective' && !record.follow_up_nce_id && canReview && (
            <button className="btn ghost sm" onClick={() => guard(() => store.reopen(record.id, 'Chưa hiệu quả, mở vòng tiếp theo'))}>Mở vòng tiếp theo</button>
          )}
          {record.follow_up_nce_id && <p className="action-detail-muted">Đã mở vòng tiếp theo.</p>}
        </>
      )}

      {canReview && (
        <>
          <SectionTitle title="Duyệt hồ sơ" />
          <div className="action-detail-actions action-detail-review-actions">
            {record.approval_status !== 'approved' && <button className="btn teal sm" onClick={() => guard(() => store.approve(record.id))}>Duyệt</button>}
            <input className="action-detail-review-note" placeholder="Lý do trả lại/huỷ" value={returnNote || cancelNote} onChange={(e) => { setReturnNote(e.target.value); setCancelNote(e.target.value); }} />
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
function errorClassLabel(value: unknown): string {
  const kind = normalizeErrorClass(value);
  return kind === 'SE' ? 'Sai số hệ thống' : kind === 'RE' ? 'Sai số ngẫu nhiên' : 'Chưa phân loại';
}



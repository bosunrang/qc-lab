// Khắc phục sự cố (NCE/CAPA) — Giai đoạn B5 (docs/APP-V2-PLAN.md): form 8
// phần (nhận diện → điều tra → nguyên nhân → khắc phục → rerun →
// release-to-service → hiệu lực → residual-risk), chip gợi ý theo
// causeCategory (SE/RE — tập rút gọn, không port hết ACT_SUGGEST bản cũ),
// duyệt/trả lại/huỷ/mở lại vòng tiếp theo, hướng dẫn quy trình 8 bước.
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
import { vnDate as formatVnDate } from '../lib/format';

/** Luật thuộc SAI SỐ HỆ THỐNG — port `WG_RULE_REGISTRY[].err === 'SE'` app
 * cũ; luật còn lại tính là sai số ngẫu nhiên (RE), đúng cách `errorType()`
 * phân loại. */
const SE_RULES = ['2-2s', '4-1s', '10x', '8x', '6x', '2of3-2s', '3-1s', '7T'];
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

const CAUSE_CHIPS: Record<'SE' | 'RE', string[]> = {
  SE: ['Hiệu chuẩn lại máy', 'Kiểm tra lô hóa chất/QC mới', 'Kiểm tra nhiệt độ bảo quản', 'Xem lại Mean/SD đang áp dụng'],
  RE: ['Kiểm tra thao tác hút mẫu', 'Kiểm tra bọt khí trong đường ống/ống mẫu', 'Kiểm tra pipet/kim hút', 'Đào tạo lại kỹ thuật viên'],
};

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

export function ActionsPage() {
  const { tests, loadTests } = useManageStore();
  const store = useNceStore();
  const { summaries, loadSummaries } = useWestgardStore();
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<{ testId: string; level: number } | null>(null);
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
        key: string; testId: string; level: number; severity: 'warn' | 'rej';
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
          return {
            key: `${s.testId}:${lv.level}`, testId: s.testId, level: lv.level,
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
                        ? <button type="button" className="btn ghost sm" onClick={() => setDetailId(item.openRecordId!)}>Tiếp tục hồ sơ</button>
                        : <button type="button" className="btn ghost sm" onClick={() => { setPrefill({ testId: item.testId, level: item.level }); setCreating(true); }}>Lập hồ sơ</button>}
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
        <div className="empty">
          <b>{issueCount ? 'Chọn một sự cố để lập hồ sơ' : 'Không có vi phạm nào cần lập hồ sơ'}</b>
          <p>{issueCount
            ? `Có ${issueCount} sự cố ở trên — bấm "Lập hồ sơ" ngay trên dòng cần xử lý để hồ sơ được gắn đúng điểm QC và tự theo dõi QC chạy lại.`
            : 'Hồ sơ NCE thường bắt đầu từ một vi phạm QC. Khi không có vi phạm nào, chỉ mở hồ sơ khi thực sự cần ghi nhận sự không phù hợp khác.'}</p>
          {writable && <button type="button" className="btn ghost" onClick={() => { setPrefill(null); setCreating(true); }}>Lập hồ sơ từ nguồn khác</button>}
        </div>
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
                        {!cancelled && r.approval_status !== 'approved' && <button type="button" className="btn ghost sm" onClick={() => setDetailId(r.id)}>Tiếp tục</button>}
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

      {creating && <CreateModal prefill={prefill} onClose={() => setCreating(false)} />}
      {detailRecord && <DetailModal record={detailRecord} testName={testName(detailRecord.test_id)} onClose={() => setDetailId(null)} />}
      {showGuide && (
        <Modal title="Quy trình xử lý sự cố — 8 bước" onClose={() => setShowGuide(false)}>
          <ol style={{ paddingLeft: 18 }}>{GUIDE_STEPS.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}</ol>
        </Modal>
      )}
    </div>
  );
}

function CreateModal({ prefill, onClose }: { prefill: { testId: string; level: number } | null; onClose: () => void }) {
  const { tests } = useManageStore();
  const { create } = useNceStore();
  const [testId, setTestId] = useState(prefill?.testId || '');
  const [level, setLevel] = useState(String(prefill?.level || 1));
  const [lot, setLot] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rule, setRule] = useState('');
  const [errorType, setErrorType] = useState('');
  const [investigation, setInvestigation] = useState('');
  const [causeCategory, setCauseCategory] = useState<'SE' | 'RE' | ''>('');
  const [causeDescription, setCauseDescription] = useState('');
  const [correction, setCorrection] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const result = await create({
      testId: testId || undefined, level: testId ? Number(level) : undefined, lot: lot || undefined, date,
      rule: rule || undefined, errorType: errorType || undefined, correction, dueDate: dueDate || undefined,
      investigation: investigation || undefined, causeCategory: causeCategory || undefined, causeDescription: causeDescription || undefined,
    });
    if (!result.ok) { setErr(result.error.message); return; }
    onClose();
  }

  return (
    <Modal title="Mở hồ sơ khắc phục sự cố mới" onClose={onClose} width={560}
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Tạo hồ sơ</button></>}>
      {err && <p className="field-error">{err}</p>}

      <SectionTitle n={1} title="Nhận diện sự cố" />
      <div className="field-row">
        <div className="field"><label>Xét nghiệm</label><select value={testId} onChange={(e) => setTestId(e.target.value)}><option value="">(không gắn)</option>{tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="field"><label>Mức</label><input value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 60 }} /></div>
        <div className="field"><label>Lô</label><input value={lot} onChange={(e) => setLot(e.target.value)} /></div>
      </div>
      <div className="field-row">
        <DateField label="Ngày xảy ra" value={date} onChange={setDate} />
        <div className="field"><label>Luật vi phạm</label><input placeholder="vd 1-3s" value={rule} onChange={(e) => setRule(e.target.value)} /></div>
        <div className="field"><label>Loại lỗi</label>
          <select value={errorType} onChange={(e) => setErrorType(e.target.value)}><option value="">—</option><option value="SE">SE — hệ thống</option><option value="RE">RE — ngẫu nhiên</option></select>
        </div>
      </div>

      <SectionTitle n={2} title="Điều tra" />
      <div className="field"><textarea rows={2} placeholder="Đã kiểm tra những gì?" value={investigation} onChange={(e) => setInvestigation(e.target.value)} /></div>

      <SectionTitle n={3} title="Nguyên nhân" />
      <div className="field">
        <label>Phân loại</label>
        <select value={causeCategory} onChange={(e) => setCauseCategory(e.target.value as never)}><option value="">Chưa xác định</option><option value="SE">SE — sai số hệ thống</option><option value="RE">RE — sai số ngẫu nhiên</option></select>
      </div>
      {(causeCategory === 'SE' || causeCategory === 'RE') && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
          {CAUSE_CHIPS[causeCategory].map((c) => (
            <button type="button" key={c} className="badge neutral" style={{ cursor: 'pointer', border: 'none' }}
              onClick={() => setCauseDescription((d) => (d ? `${d}; ${c}` : c))}>{c}</button>
          ))}
        </div>
      )}
      <div className="field"><textarea rows={2} placeholder="Mô tả nguyên nhân cụ thể" value={causeDescription} onChange={(e) => setCauseDescription(e.target.value)} /></div>

      <SectionTitle n={4} title="Khắc phục" />
      <div className="field"><label>Xử lý tức thời (≥10 ký tự)</label><textarea rows={2} value={correction} onChange={(e) => setCorrection(e.target.value)} /></div>
      <DateField label="Hạn hoàn thành" value={dueDate} onChange={setDueDate} />
    </Modal>
  );
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

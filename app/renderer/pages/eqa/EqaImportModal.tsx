// Nhập báo cáo PDF của trung tâm ngoại kiểm (docs/EQA-PLAN-2026-10-28.md, E-11
// đến E-13). Mỗi bước một modal có chân modal chuẩn:
//   1. Chọn file: mỗi file là một máy (nhóm thiết bị) của một đợt; người dùng
//      chọn máy của PXN và kiểm năm cho từng file (VEQAS không ghi năm). File
//      được gom theo đợt, nên chọn được nhiều đợt một lần.
//   2. Một đợt: xem trước — main kiểm từng dòng, ánh xạ, đối chiếu z với báo
//      cáo, tính z và xếp loại; người dùng ánh xạ cặp mã thông số × máy rồi ghi.
//      Nhiều đợt: danh sách đợt; đợt không cần thao tác gì thêm nhập hàng
//      loạt, đợt cần ánh xạ hay lý do nhập lại mở bước xem trước như trên.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { SearchSelect } from '../../components/SearchSelect';
import type { SearchSelectOption } from '../../lib/search-options';
import { readEqaPdfFiles } from '../../lib/eqa-file';
import type { EqaImportInput, EqaImportPreview, Instrument, IpcResult } from '../../../shared/qc-api';
import { eqaNormalize } from '../../../main/domain/eqa/evaluation';
import { eqaPairKey, groupEqaSources, mergeEqaSources, type EqaParsedSource } from '../../../main/domain/eqa/import';
import type { EqaPdfReport } from '../../../main/domain/eqa/pdf-report';
import { Facts, roundLabel } from './shared';
import { EqaResultsSummary } from './EqaResultsSummary';
import { errorDialog } from '../../state/dialog-store';

const TITLE = 'Nhập báo cáo ngoại kiểm';
const ERROR_ROW_LIMIT = 50;
/** Lỗi/cảnh báo về năm của bộ đọc đã được người dùng xử lý ở bước chọn file. */
const YEAR_NOTICE = /không xác định được năm|không ghi năm/;
const withoutYearNotice = (messages: readonly string[] = []) => messages.filter((m) => !YEAR_NOTICE.test(m));

function PdfFileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2.75h8l4 4V21.25H6z" />
    <path d="M14 2.75v4h4" />
    <path d="M8.5 15.5h7M8.5 12h7" />
  </svg>;
}

/** Gợi ý máy của PXN cho nhóm thiết bị ghi trên báo cáo ("Beckman DxC 700 AU"
 * → máy tên "DxC700"). Chỉ điền khi đúng một máy khớp. */
function suggestInstrument(group: string, instruments: readonly Instrument[]): string {
  const key = eqaNormalize(group);
  const hits = instruments.filter((i) => i.active && [i.name, i.model].map(eqaNormalize).some((name) => name.length >= 3 && key.includes(name)));
  return hits.length === 1 ? hits[0].id : '';
}

export function EqaImportModal({ onClose, onImported }: { onClose: () => void; onImported: (roundId: string) => void }) {
  const instruments = useManageStore((s) => s.instruments);
  const [reports, setReports] = useState<EqaPdfReport[]>([]);
  const [instrumentFor, setInstrumentFor] = useState<Record<number, string>>({});
  const [yearFor, setYearFor] = useState<Record<number, string>>({});
  const [sampleFor, setSampleFor] = useState<Record<number, string>>({});
  const [fileError, setFileError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<EqaParsedSource | null>(null);
  const [batch, setBatch] = useState<EqaBatchItem[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | readonly File[] | null) {
    const list = files ? [...files] : [];
    if (!list.length) return;
    setParsing(true); setFileError(''); setReports([]); setInstrumentFor({}); setYearFor({}); setSampleFor({});
    try {
      const read = await readEqaPdfFiles(list);
      setReports(read);
      setInstrumentFor(Object.fromEntries(read.map((report, i) => [i, suggestInstrument(report.instrumentGroup, instruments)])));
      // File không ghi năm (VEQAS) lấy năm của file khác trong lần chọn; người dùng vẫn sửa được.
      const fallback = read.find((r) => r.round.year)?.round.year;
      setYearFor(Object.fromEntries(read.map((report, i) => [i, String(report.round.year ?? fallback ?? '')])));
      setSampleFor(Object.fromEntries(read.map((report, i) => [i, String(report.rows[0]?.sample ?? '')])));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Không đọc được file.');
    } finally { setParsing(false); }
  }

  // Mỗi file một máy, năm hợp lệ; trong cùng một đợt không có hai file cùng máy, cùng mẫu.
  const yearOf = (i: number) => Number(yearFor[i] ?? '');
  const yearValid = reports.every((_, i) => Number.isInteger(yearOf(i)) && yearOf(i) >= 2000 && yearOf(i) <= 2100);
  const chosen = reports.map((_, i) => instrumentFor[i] ?? '');
  // Báo cáo mỗi tệp một mẫu (VEQAS) phải có mã mẫu: thiếu thì hai mẫu cùng máy sẽ ghi đè nhau.
  const sampleOf = (i: number) => (sampleFor[i] ?? '').trim();
  const sampleValid = reports.every((report, i) => !report.samplePerFile || (sampleOf(i).length > 0 && sampleOf(i).length <= 20));
  const fileErrors = reports.map((r) => withoutYearNotice(r.errors));
  const readErrors = fileErrors.flat();
  const named = reports.map((report, i): EqaParsedSource => {
    const instrument = instruments.find((item) => item.id === chosen[i]);
    return {
      round: { ...report.round, year: yearOf(i) || null },
      rows: report.rows.map((row) => ({ ...row, instrument: instrument?.name ?? row.instrument, ...(report.samplePerFile ? { sample: sampleOf(i) } : {}) })),
      errors: fileErrors[i], files: report.files,
      warnings: withoutYearNotice(report.warnings),
    };
  });
  const groups = groupEqaSources(named);
  // Một đợt VEQAS phát hành mỗi mẫu một tệp, nên hai tệp cùng máy là hợp lệ
  // khi khác mẫu; chỉ chặn khi cùng máy lại trùng mẫu (một kết quả hai nguồn).
  const samplesOf = (i: number) => new Set(named[i].rows.map((row) => String(row.sample ?? '').trim().toLowerCase()));
  const duplicateInstrument = groups.some((g) => g.indices.some((i, k) => chosen[i] && g.indices.some((j, m) => m > k && chosen[j] === chosen[i]
    && [...samplesOf(i)].some((sample) => samplesOf(j).has(sample)))));
  const ready = reports.length > 0 && yearValid && sampleValid && chosen.every(Boolean) && !duplicateInstrument;

  function startReview() {
    const items = groups.map((g): EqaBatchItem => ({
      key: g.key,
      source: mergeEqaSources(g.indices.map((i) => named[i]), g.indices.map((i) => reports[i].fileName)),
      sourceName: g.indices.map((i) => reports[i].fileName).join(', '),
    }));
    if (items.length === 1) setReview(items[0].source); else setBatch(items);
  }

  if (review) {
    return <EqaImportReview source={review} sourceName={reports.map((r) => r.fileName).join(', ')}
      onClose={onClose} onBack={() => setReview(null)} onImported={onImported} />;
  }
  if (batch) return <EqaImportBatch items={batch} onClose={onClose} onBack={() => setBatch(null)} />;

  return (
    <Modal title={TITLE} size="xl" onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>Đóng</button>
        <button type="button" className="btn teal" disabled={!ready} onClick={startReview}>{groups.length > 1 ? `Kiểm tra ${groups.length} đợt` : 'Xem trước'}</button>
      </>}>
      <div className="eqa-import-pick">
        <div className="field">
          <label htmlFor="eqaFile">Chọn báo cáo PDF</label>
          <div className={`eqa-file-picker${dragging ? ' is-dragging' : ''}${reports.length ? ' is-ready' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (!parsing) setDragging(true); }}
            onDragLeave={(e) => {
              if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
              setDragging(false);
            }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!parsing) void pick(e.dataTransfer.files); }}>
            <span className="eqa-file-picker-icon"><PdfFileIcon /></span>
            <span className="eqa-file-picker-copy">
              <b>{reports.length ? `${reports.length} báo cáo đã được đọc` : 'Thả báo cáo PDF vào đây'}</b>
              <span>{reports.length ? 'Bạn có thể chọn lại nếu cần thay tệp.' : 'Chọn được nhiều tệp, kể cả nhiều đợt; mỗi đợt, mỗi máy một tệp.'}</span>
            </span>
            <button type="button" className="btn ghost" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
              {parsing ? 'Đang đọc…' : reports.length ? 'Chọn lại' : 'Chọn tệp PDF'}
            </button>
            <input ref={fileInputRef} id="eqaFile" hidden type="file" accept="application/pdf,.pdf" multiple
              aria-label="Chọn báo cáo PDF ngoại kiểm" onChange={(e) => { void pick(e.target.files); e.target.value = ''; }} />
          </div>
        </div>
        {parsing && <p className="eqa-note" role="status">Đang đọc báo cáo…</p>}
        {fileError && <div className="alert rej eqa-pre" role="alert">{fileError}</div>}
        {reports.length > 0 && (
          <>
            <p className="eqa-note">{reports.length} tệp thuộc {groups.length} đợt. Kiểm tra năm của từng tệp trước khi tiếp tục; năm là một phần của đợt nên sửa năm sẽ chuyển tệp sang đợt khác.</p>
            <div className="eqa-table-wrap">
              <table className="eqa-table eqa-center-rest eqa-import-files">
                <thead><tr><th>File</th><th>Nhóm thiết bị trên báo cáo</th><th>Chương trình · đợt</th><th>Năm</th><th>Mẫu</th><th className="num">Thông số</th><th>Máy của PXN</th><th>Đọc file</th></tr></thead>
                <tbody>
                  {reports.map((report, index) => (
                    <tr key={report.fileName + index}>
                      <td className="eqa-wrap">{report.fileName}</td>
                      <td>{report.instrumentGroup || '—'}</td>
                      <td>{report.round.programCode || report.round.program || '—'} · {report.round.round || '—'}</td>
                      <td><input className="eqa-import-year" type="number" min={2000} max={2100} aria-label={`Năm của đợt cho ${report.fileName}`}
                        value={yearFor[index] ?? ''} onChange={(e) => setYearFor((m) => ({ ...m, [index]: e.target.value }))} /></td>
                      <td>{report.samplePerFile
                        ? <input className="eqa-import-year" maxLength={20} placeholder="vd. 09-01" aria-label={`Mã mẫu cho ${report.fileName}`} aria-invalid={!sampleOf(index) || undefined}
                          value={sampleFor[index] ?? ''} onChange={(e) => setSampleFor((m) => ({ ...m, [index]: e.target.value }))} />
                        : '—'}</td>
                      <td className="num">{report.rows.length}</td>
                      <td>
                        <select aria-label={`Máy của PXN cho ${report.fileName}`} value={instrumentFor[index] ?? ''} onChange={(e) => setInstrumentFor((m) => ({ ...m, [index]: e.target.value }))}>
                          <option value="">— Chọn máy —</option>
                          {instruments.filter((i) => i.active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </td>
                      <td>{fileErrors[index].length ? <span className="tag rej">Có lỗi</span> : <span className="tag ok">Đọc được</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!sampleValid && <div className="alert warn">Báo cáo VEQAS không ghi mã mẫu trong nội dung; app đọc mã mẫu từ tên tệp gốc của trung tâm (dạng 09-01). Ghi mã mẫu cho tệp còn trống để hai mẫu của cùng máy không ghi đè nhau.</div>}
            {duplicateInstrument && <div className="alert warn">Hai file của cùng một đợt đang chọn cùng một máy cho cùng một mẫu. Mỗi báo cáo PDF là kết quả của một máy, một mẫu.</div>}
            {readErrors.length > 0 && <div className="alert rej eqa-pre" role="alert">{readErrors.join('\n')}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

function EqaImportReview({ source, sourceName, onClose, onBack, onImported, backLabel = 'Quay lại chọn máy' }: {
  source: EqaParsedSource; sourceName: string; onClose: () => void; onBack: () => void; onImported: (roundId: string) => void; backLabel?: string;
}) {
  const { preview: runPreview, importRound } = useEqaStore(useShallow((s) => ({ preview: s.preview, importRound: s.importRound })));
  const { tests, instruments } = useManageStore(useShallow((s) => ({ tests: s.tests, instruments: s.instruments })));
  const [mappings, setMappings] = useState<Record<string, { code: string; instrument: string; testId: string }>>({});
  const [replaceReason, setReplaceReason] = useState('');
  const [preview, setPreview] = useState<EqaImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  const testOptions = useMemo(() => {
    const instrumentName = new Map(instruments.map((i) => [i.id, i.name]));
    return tests.filter((t) => t.active)
      .map((t): SearchSelectOption => {
        const machine = instrumentName.get(t.instrument_id) ?? 'Chưa gắn máy';
        return { value: t.id, label: `${t.name} · ${machine}`, keywords: `${t.name} ${machine} ${t.unit} ${t.method}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [tests, instruments]);

  const previewInput = useMemo<EqaImportInput>(() => ({
    round: source.round, rows: source.rows, source: 'pdf', sourceName, sourceFiles: source.files,
    mappings: Object.values(mappings).filter((m) => m.testId),
  }), [mappings, source, sourceName]);

  useEffect(() => {
    let alive = true;
    // Giữ bản xem trước cũ trong lúc kiểm lại: xoá đi thì bảng ánh xạ bị gỡ khỏi
    // DOM sau mỗi lần chọn, ô vừa chọn mất focus và vị trí cuộn. Nút ghi vẫn
    // khoá khi `loading`, nên không ghi được theo bản cũ.
    setLoading(true); setError('');
    void runPreview(previewInput).then((result) => {
      if (!alive) return;
      setLoading(false);
      if (!result.ok) { setError(result.error.message); return; }
      setError(''); setPreview(result.data);
      // Cặp chưa ánh xạ có đúng MỘT gợi ý thì điền sẵn; người dùng vẫn xem và đổi được trước khi ghi.
      if (!seeded.current) {
        seeded.current = true;
        const initial: Record<string, { code: string; instrument: string; testId: string }> = {};
        for (const pair of result.data.pairs) if (!pair.test_id && pair.suggestions.length === 1) initial[eqaPairKey(pair.code, pair.instrument)] = { code: pair.code, instrument: pair.instrument, testId: pair.suggestions[0] };
        if (Object.keys(initial).length) setMappings(initial);
      }
    }).catch((e) => { if (alive) { setLoading(false); setError(e instanceof Error ? e.message : 'Không xem trước được dữ liệu.'); } });
    return () => { alive = false; };
  }, [previewInput, runPreview]);

  const needsReplaceReason = !!preview?.existing?.needs_reason && replaceReason.trim().length < 10;
  const errorRows = preview?.rows.filter((r) => r.errors.length) ?? [];
  const warningRows = preview?.rows.filter((r) => r.warnings.length) ?? [];
  const canImport = !!preview && !loading && !busy && !error && preview.blocking === 0 && !needsReplaceReason && source.errors.length === 0;

  async function submit() {
    setBusy(true); setError('');
    try {
      const result = await importRound({ ...previewInput, replaceReason, expectedVersion: preview?.existing?.row_version });
      setBusy(false);
      if (result.ok) onImported(result.data.round.id); else await errorDialog(result.error.message, { title: 'Chưa nhập được đợt ngoại kiểm' });
    } catch (e) {
      setBusy(false);
      await errorDialog(e instanceof Error ? e.message : 'Không ghi được đợt ngoại kiểm.', { title: 'Chưa nhập được đợt ngoại kiểm' });
    }
  }

  return (
    <Modal title={TITLE} size="xl" busy={busy} onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" disabled={busy} onClick={onBack}>{backLabel}</button>
        <button type="button" className="btn teal" disabled={!canImport} onClick={() => void submit()}>{busy ? 'Đang ghi…' : preview?.existing?.unchanged ? 'Giữ nguyên đợt' : preview?.existing?.needs_reason ? 'Nhập lại đợt này' : preview?.existing ? 'Bổ sung vào đợt' : 'Ghi đợt ngoại kiểm'}</button>
      </>}>
      <div className="eqa-import-review">
        <section className="eqa-import-block" aria-label="Thông tin đợt trong báo cáo">
          <h3>{source.round.program || 'Chưa có tên chương trình'} · {roundLabel(source.round)}</h3>
          <Facts items={[
            ['Đơn vị tổ chức', source.round.provider], ['Mã chương trình', source.round.programCode], ['Mã đơn vị', source.round.unitCode],
            ['Mã báo cáo', source.round.reportCode], ['Số kết quả', String(source.rows.length)], ['File', sourceName],
          ]} />
          {source.errors.length > 0 && <div className="alert rej eqa-pre" role="alert">{source.errors.join('\n')}</div>}
          {!!source.warnings?.length && <div className="alert warn eqa-pre">{source.warnings.join('\n')}</div>}
          {preview?.existing && (
            <div className="eqa-replace">
              {preview.existing.unchanged ? (
                <div className="alert info">Số liệu trùng khớp kết quả đang lưu của đợt này. Ghi sẽ không tạo phiên bản mới và không làm thay đổi phiếu xem xét đã ký.</div>
              ) : preview.existing.needs_reason ? (
                <div className="alert warn">
                  {preview.existing.status === 'cancelled'
                    ? `Đợt này đã có trong app nhưng đã huỷ. Nhập lại sẽ mở lại đợt với phiên bản ${preview.existing.version + 1}${preview.existing.instruments.length ? `; kết quả cũ của ${preview.existing.instruments.join(', ')} được giữ, trừ đúng máy và mẫu có trong lần nhập này` : ''}.`
                    : `Đợt này đã có kết quả của ${preview.existing.replaces.join(', ')}. Nhập lại thay kết quả của đúng máy và mẫu đó bằng phiên bản ${preview.existing.version + 1}; phiên bản cũ vẫn được giữ trong CSDL.`}
                </div>
              ) : (
                <div className="alert info">Đợt này đã có trong app (đang có: {preview.existing.instruments.join(', ') || 'chưa có máy nào'}). Lần nhập này bổ sung máy mới, kết quả của các máy đã có giữ nguyên.{preview.existing.reviewed_all && ' Phiếu xem xét "Tất cả máy" đã ký của đợt sẽ cần ký lại để bao gồm máy mới; phiếu đã ký riêng từng máy vẫn giữ hiệu lực.'}</div>
              )}
              {preview.existing.needs_reason && (
                <div className="field">
                  <label htmlFor="eqaReplaceReason">Lý do nhập lại (ít nhất 10 ký tự)</label>
                  <input id="eqaReplaceReason" value={replaceReason} onChange={(e) => setReplaceReason(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </section>

        {error && <div className="alert rej" role="alert">{error}</div>}
        {!preview ? <EmptyState size="compact" title={loading ? 'Đang kiểm tra dữ liệu…' : 'Chưa xem trước được dữ liệu'} /> : (
          <>
            {preview.round_errors.length > 0 && <div className="alert rej" role="alert"><ul className="eqa-list">{preview.round_errors.map((m) => <li key={m}>{m}</li>)}</ul></div>}

            <EqaResultsSummary totals={{ ...preview.counts, acceptPct: preview.counts.accept_pct }}
              description="Theo báo cáo PDF" loading={loading} />

            <section className="eqa-import-block" aria-label="Ánh xạ xét nghiệm">
              <h3>Ánh xạ sang xét nghiệm trong danh mục</h3>
              {preview.blocking > 0 && <div className="alert rej" role="alert">Còn {preview.blocking} lỗi cần xử lý trước khi nhập.</div>}
              <div className="eqa-table-wrap eqa-map-table-wrap">
                <table className="eqa-table eqa-center-rest">
                  <thead><tr><th>Mã thông số</th><th>Máy</th><th className="num">Dòng</th><th>Xét nghiệm trong danh mục</th></tr></thead>
                  <tbody>
                    {preview.pairs.map((pair) => {
                      const key = eqaPairKey(pair.code, pair.instrument);
                      const value = mappings[key]?.testId ?? pair.test_id ?? '';
                      return (
                        <tr key={key} className={value ? undefined : 'is-warn'}>
                          <td><b className="eqa-strong">{pair.code}</b></td>
                          <td>{pair.instrument}</td>
                          <td className="num">{pair.rows}</td>
                          <td>
                            <SearchSelect ariaLabel={`Xét nghiệm cho ${pair.code} trên ${pair.instrument}`}
                              placeholder="Gõ tên, mã hoặc máy…" value={value}
                              options={testOptions} suggestedValues={pair.suggestions}
                              onChange={(testId) => setMappings((m) => ({ ...m, [key]: { code: pair.code, instrument: pair.instrument, testId } }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {errorRows.length > 0 && (
              <section className="eqa-import-block" aria-label="Dòng lỗi">
                <h3>Dòng lỗi ({errorRows.length})</h3>
                <div className="eqa-table-wrap">
                  <table className="eqa-table eqa-center-rest">
                    <thead><tr><th>Vị trí</th><th>Mã thông số</th><th>Máy</th><th>Lỗi</th></tr></thead>
                    <tbody>{errorRows.slice(0, ERROR_ROW_LIMIT).map((r) => <tr key={r.ref}><td>{r.ref}</td><td>{r.code || '—'}</td><td>{r.instrument || '—'}</td><td className="eqa-wrap">{r.errors.join('; ')}</td></tr>)}</tbody>
                  </table>
                </div>
                {errorRows.length > ERROR_ROW_LIMIT && <p className="eqa-note">Hiển thị {ERROR_ROW_LIMIT} dòng lỗi đầu tiên.</p>}
              </section>
            )}

            {warningRows.length > 0 && (
              <details className="eqa-import-block eqa-details">
                <summary>{warningRows.length} dòng cần đối chiếu với báo cáo gốc (không chặn ghi)</summary>
                <ul className="eqa-list">{warningRows.map((r) => <li key={r.ref}>{r.ref} · {r.code} · {r.instrument}: {r.warnings.join('; ')}</li>)}</ul>
              </details>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

interface EqaBatchItem { key: string; source: EqaParsedSource; sourceName: string }
type EqaBatchState = 'checking' | 'ready' | 'append' | 'review' | 'error' | 'done';

/** Nhiều đợt một lần. Main xem trước từng đợt với ánh xạ đã lưu của chương
 * trình; đợt không lỗi chặn, không cần lý do nhập lại thì nhập hàng loạt. Đợt
 * cần ánh xạ hay lý do mở bước xem trước riêng — ánh xạ ghi ở đó được lưu và
 * các đợt sau tự dùng, nên danh sách kiểm lại sau mỗi lần nhập. */
function EqaImportBatch({ items, onClose, onBack }: { items: readonly EqaBatchItem[]; onClose: () => void; onBack: () => void }) {
  const { preview: runPreview, importRound } = useEqaStore(useShallow((s) => ({ preview: s.preview, importRound: s.importRound })));
  const [previews, setPreviews] = useState<Record<string, IpcResult<EqaImportPreview> | { ok: false; error: { message: string } }>>({});
  const [done, setDone] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [check, setCheck] = useState(0);

  const inputOf = (item: EqaBatchItem): EqaImportInput => ({ round: item.source.round, rows: item.source.rows, source: 'pdf', sourceName: item.sourceName, sourceFiles: item.source.files, mappings: [] });

  useEffect(() => {
    let alive = true;
    setPreviews({});
    void Promise.all(items.filter((item) => !done[item.key]).map(async (item) => {
      const result = await runPreview(inputOf(item)).catch((e: unknown) => ({ ok: false as const, error: { message: e instanceof Error ? e.message : 'Không xem trước được.' } }));
      if (alive) setPreviews((m) => ({ ...m, [item.key]: result }));
    }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kiểm lại khi `check` tăng, không theo từng lần đổi `done`
  }, [items, runPreview, check]);

  const stateOf = (item: EqaBatchItem): EqaBatchState => {
    if (done[item.key]) return 'done';
    if (failed[item.key]) return 'error';
    const result = previews[item.key];
    if (!result) return 'checking';
    if (!result.ok || item.source.errors.length) return 'error';
    const p = result.data;
    if (p.blocking > 0 || p.existing?.needs_reason) return 'review';
    return p.existing ? 'append' : 'ready';
  };
  const readyItems = items.filter((item) => ['ready', 'append'].includes(stateOf(item)));
  const pending = items.filter((item) => stateOf(item) !== 'done').length;
  // Đã ghi ít nhất một đợt thì không cho quay lại chọn máy: danh sách dựng lại
  // sẽ quên đợt vừa ghi, hiện "Cần xem trước" và dễ dẫn tới nhập lại trùng phiên bản.
  const anyImported = Object.keys(done).length > 0;

  async function importReady() {
    setBusy(true);
    for (const [n, item] of readyItems.entries()) {
      setProgress(`Đang ghi đợt ${n + 1}/${readyItems.length}…`);
      const result = previews[item.key];
      const existing = result?.ok ? result.data.existing : null;
      try {
        const saved = await importRound({ ...inputOf(item), expectedVersion: existing?.row_version });
        if (saved.ok) setDone((m) => ({ ...m, [item.key]: saved.data.round.id }));
        else setFailed((m) => ({ ...m, [item.key]: saved.error.message }));
      } catch (e) {
        setFailed((m) => ({ ...m, [item.key]: e instanceof Error ? e.message : 'Không ghi được đợt.' }));
      }
    }
    setProgress(''); setBusy(false); setCheck((n) => n + 1);
  }

  const current = items.find((item) => item.key === reviewing);
  if (current) {
    return <EqaImportReview source={current.source} sourceName={current.sourceName} backLabel="Quay lại danh sách đợt" onClose={onClose}
      onBack={() => { setReviewing(null); setCheck((n) => n + 1); }}
      onImported={(roundId) => { setDone((m) => ({ ...m, [current.key]: roundId })); setReviewing(null); setCheck((n) => n + 1); }} />;
  }

  const label: Record<EqaBatchState, ReactNode> = {
    checking: <span className="tag none">Đang kiểm…</span>, ready: <span className="tag ok">Sẵn sàng</span>,
    append: <span className="tag ok">Bổ sung máy</span>, review: <span className="tag warn">Cần xem trước</span>,
    error: <span className="tag rej">Có lỗi</span>, done: <span className="tag ok">Đã nhập</span>,
  };
  const reasonOf = (item: EqaBatchItem): string => {
    if (failed[item.key]) return failed[item.key];
    const result = previews[item.key];
    if (item.source.errors.length) return item.source.errors.join(' ');
    if (!result) return '';
    if (!result.ok) return result.error.message;
    const p = result.data;
    if (p.existing?.unchanged) return 'Trùng khớp kết quả đang lưu; không tạo phiên bản mới.';
    if (p.existing?.needs_reason) return `Đợt đã có kết quả của ${p.existing.replaces.join(', ')}; cần lý do nhập lại.`;
    if (p.blocking > 0) return `${p.blocking} lỗi chặn (thường là chưa ánh xạ xét nghiệm).`;
    return `${p.counts.ok} chấp nhận · ${p.counts.warn} cảnh báo · ${p.counts.rej} không chấp nhận`;
  };

  return (
    <Modal title={TITLE} size="xl" busy={busy} onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" disabled={busy || anyImported} onClick={onBack}
          title={anyImported ? 'Đã ghi đợt trong danh sách này; đóng hộp thoại để chọn tệp mới.' : undefined}>Quay lại chọn máy</button>
        {pending === 0
          ? <button type="button" className="btn teal" onClick={onClose}>Xong</button>
          : <button type="button" className="btn teal" disabled={busy || !readyItems.length} onClick={() => void importReady()}>
            {busy ? progress : `Nhập ${readyItems.length} đợt sẵn sàng`}</button>}
      </>}>
      <div className="eqa-import-review">
        <p className="eqa-note" role="status">{items.length} đợt · đã nhập {items.length - pending}. Đợt "Cần xem trước" thường là lần đầu gặp mã thông số: ánh xạ một lần, các đợt còn lại của chương trình tự dùng lại.</p>
        <div className="eqa-table-wrap">
          <table className="eqa-table">
            <thead><tr><th>Đợt</th><th>File</th><th>Trạng thái</th><th>Chi tiết</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {items.map((item) => {
                const state = stateOf(item);
                return <tr key={item.key} className={state === 'error' ? 'is-rej' : state === 'review' ? 'is-warn' : undefined}>
                  <td><b className="eqa-strong">{roundLabel(item.source.round)}</b><span className="eqa-sub">{item.source.round.program}</span></td>
                  <td className="eqa-wrap">{item.sourceName}</td>
                  <td>{label[state]}</td>
                  <td className="eqa-wrap">{reasonOf(item)}</td>
                  <td>{state !== 'done' && state !== 'checking' && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setReviewing(item.key)}>Xem trước</button>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}


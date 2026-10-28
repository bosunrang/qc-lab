// Nhập báo cáo PDF của trung tâm ngoại kiểm (docs/EQA-PLAN-2026-10-28.md, E-11
// đến E-13). Hai bước, mỗi bước một modal có chân modal chuẩn:
//   1. Chọn file: mỗi file là một máy (nhóm thiết bị) của một đợt; người dùng
//      chọn máy của PXN cho từng file và kiểm năm (báo cáo không ghi năm).
//   2. Xem trước: main kiểm từng dòng, ánh xạ, đối chiếu z với báo cáo, tính
//      z và xếp loại; người dùng ánh xạ cặp mã thông số × máy rồi ghi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { readEqaPdfFiles } from '../../lib/eqa-file';
import type { EqaImportInput, EqaImportPreview, Instrument } from '../../../shared/qc-api';
import { eqaNormalize } from '../../../main/domain/eqa/evaluation';
import { eqaPairKey, mergeEqaSources, type EqaParsedSource } from '../../../main/domain/eqa/import';
import type { EqaPdfReport } from '../../../main/domain/eqa/pdf-report';
import { pctText, roundLabel, StatCard } from './shared';

const TITLE = 'Nhập báo cáo PDF của trung tâm ngoại kiểm';
const ERROR_ROW_LIMIT = 50;
/** Lỗi/cảnh báo về năm của bộ đọc đã được người dùng xử lý ở bước chọn file. */
const YEAR_NOTICE = /không xác định được năm|không ghi năm/;

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
  const [year, setYear] = useState('');
  const [fileError, setFileError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<EqaParsedSource | null>(null);

  async function pick(files: FileList | null) {
    const list = files ? [...files] : [];
    if (!list.length) return;
    setParsing(true); setFileError(''); setReports([]);
    try {
      const read = await readEqaPdfFiles(list);
      setReports(read);
      setInstrumentFor(Object.fromEntries(read.map((report, i) => [i, suggestInstrument(report.instrumentGroup, instruments)])));
      setYear(String(read.find((r) => r.round.year)?.round.year ?? ''));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Không đọc được file.');
    } finally { setParsing(false); }
  }

  // Mỗi file một máy, máy không trùng nhau, năm hợp lệ.
  const yearNumber = Number(year);
  const yearValid = Number.isInteger(yearNumber) && yearNumber >= 2000 && yearNumber <= 2100;
  const chosen = reports.map((_, i) => instrumentFor[i] ?? '');
  const duplicateInstrument = chosen.some((id, i) => id && chosen.indexOf(id) !== i);
  const readErrors = reports.flatMap((r) => r.errors.filter((e) => !YEAR_NOTICE.test(e)));
  const ready = reports.length > 0 && yearValid && chosen.every(Boolean) && !duplicateInstrument;

  function startReview() {
    const named = reports.map((report, i): EqaParsedSource => {
      const instrument = instruments.find((item) => item.id === chosen[i]);
      return {
        round: { ...report.round, year: yearNumber },
        rows: report.rows.map((row) => ({ ...row, instrument: instrument?.name ?? row.instrument })),
        errors: report.errors.filter((e) => !YEAR_NOTICE.test(e)),
        warnings: (report.warnings ?? []).filter((w) => !YEAR_NOTICE.test(w)),
      };
    });
    setReview(mergeEqaSources(named, reports.map((r) => r.fileName)));
  }

  if (review) {
    return <EqaImportReview source={review} sourceName={reports.map((r) => r.fileName).join(', ')}
      onClose={onClose} onBack={() => setReview(null)} onImported={onImported} />;
  }

  return (
    <Modal title={TITLE} size="xl" onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>Đóng</button>
        <button type="button" className="btn teal" disabled={!ready} onClick={startReview}>Xem trước</button>
      </>}>
      <div className="eqa-import-pick">
        <div className="field">
          <label htmlFor="eqaFile">Báo cáo PDF "Bản phân tích kết quả ngoại kiểm tra" (chọn được nhiều file của cùng một đợt, mỗi máy một file)</label>
          <input id="eqaFile" type="file" accept=".pdf" multiple onChange={(e) => void pick(e.target.files)} />
        </div>
        {parsing && <p className="eqa-note" role="status">Đang đọc báo cáo…</p>}
        {fileError && <div className="alert rej eqa-pre" role="alert">{fileError}</div>}
        {reports.length > 0 && (
          <>
            <div className="eqa-import-grid">
              <div className="field">
                <label htmlFor="eqaYear">Năm của đợt ngoại kiểm</label>
                <input id="eqaYear" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <p className="eqa-note">Báo cáo không ghi năm; năm được điền theo ngày tạo file PDF. Sửa lại nếu đợt thuộc năm khác.</p>
            </div>
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>File</th><th>Nhóm thiết bị trên báo cáo</th><th>Chương trình · đợt</th><th className="num">Thông số</th><th>Máy của PXN</th><th>Đọc file</th></tr></thead>
                <tbody>
                  {reports.map((report, index) => (
                    <tr key={report.fileName + index}>
                      <td className="eqa-wrap">{report.fileName}</td>
                      <td>{report.instrumentGroup || '—'}</td>
                      <td>{report.round.programCode || report.round.program || '—'} · {report.round.round || '—'}</td>
                      <td className="num">{report.rows.length}</td>
                      <td>
                        <select aria-label={`Máy của PXN cho ${report.fileName}`} value={instrumentFor[index] ?? ''} onChange={(e) => setInstrumentFor((m) => ({ ...m, [index]: e.target.value }))}>
                          <option value="">— Chọn máy —</option>
                          {instruments.filter((i) => i.active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </td>
                      <td>{report.errors.some((e) => !YEAR_NOTICE.test(e)) ? <span className="tag rej">Có lỗi</span> : <span className="tag ok">Đọc được</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {duplicateInstrument && <div className="alert warn">Hai file đang chọn cùng một máy. Mỗi báo cáo PDF là kết quả của một máy.</div>}
            {readErrors.length > 0 && <div className="alert rej eqa-pre" role="alert">{readErrors.join('\n')}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

function EqaImportReview({ source, sourceName, onClose, onBack, onImported }: {
  source: EqaParsedSource; sourceName: string; onClose: () => void; onBack: () => void; onImported: (roundId: string) => void;
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
      .map((t) => ({ id: t.id, label: `${t.name} · ${instrumentName.get(t.instrument_id) ?? 'Chưa gắn máy'}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [tests, instruments]);

  const input = (withReason: boolean): EqaImportInput => ({
    round: source.round, rows: source.rows, source: 'pdf', sourceName,
    mappings: Object.values(mappings).filter((m) => m.testId),
    ...(withReason ? { replaceReason, expectedVersion: preview?.existing?.row_version } : {}),
  });
  // Chỉ lựa chọn ánh xạ làm thay đổi kết quả xem trước; lý do gõ tay thì không.
  const previewKey = JSON.stringify(mappings);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void runPreview(input(false)).then((result) => {
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
    // `input` dựng lại mỗi lần vẽ; khoá theo nội dung lựa chọn.
  }, [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsReplaceReason = !!preview?.existing?.needs_reason && replaceReason.trim().length < 10;
  const errorRows = preview?.rows.filter((r) => r.errors.length) ?? [];
  const warningRows = preview?.rows.filter((r) => r.warnings.length) ?? [];
  const canImport = !!preview && !loading && !busy && preview.blocking === 0 && !needsReplaceReason && source.errors.length === 0;

  async function submit() {
    setBusy(true); setError('');
    const result = await importRound(input(true));
    setBusy(false);
    if (result.ok) onImported(result.data.round.id); else setError(result.error.message);
  }

  return (
    <Modal title={TITLE} size="xl" onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" onClick={onBack}>Quay lại chọn máy</button>
        <button type="button" className="btn teal" disabled={!canImport} onClick={() => void submit()}>{busy ? 'Đang ghi…' : preview?.existing?.needs_reason ? 'Nhập lại đợt này' : preview?.existing ? 'Bổ sung vào đợt' : 'Ghi đợt ngoại kiểm'}</button>
      </>}>
      <div className="eqa-import-review">
        <section className="eqa-import-block" aria-label="Thông tin đợt trong báo cáo">
          <h3>{source.round.program || 'Chưa có tên chương trình'} · {roundLabel(source.round)}</h3>
          <dl className="eqa-facts">
            {([
              ['Đơn vị tổ chức', source.round.provider], ['Mã chương trình', source.round.programCode], ['Mã đơn vị', source.round.unitCode],
              ['Mã báo cáo', source.round.reportCode], ['Số kết quả', String(source.rows.length)], ['File', sourceName],
            ] as [string, string][]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="hint-inline">Chưa ghi nhận.</span>}</dd></div>)}
          </dl>
          {source.errors.length > 0 && <div className="alert rej eqa-pre" role="alert">{source.errors.join('\n')}</div>}
          {!!source.warnings?.length && <div className="alert warn eqa-pre">{source.warnings.join('\n')}</div>}
          {preview?.existing && (
            <div className="eqa-replace">
              {preview.existing.needs_reason ? (
                <div className="alert warn">
                  {preview.existing.status === 'cancelled'
                    ? `Đợt này đã có trong app nhưng đã huỷ. Nhập lại sẽ mở lại đợt với phiên bản ${preview.existing.version + 1}.`
                    : `Đợt này đã có kết quả của ${preview.existing.replaces.join(', ')}. Nhập lại thay kết quả của máy đó bằng phiên bản ${preview.existing.version + 1}; phiên bản cũ vẫn được giữ trong CSDL.`}
                </div>
              ) : (
                <div className="alert info">Đợt này đã có trong app (đang có: {preview.existing.instruments.join(', ') || 'chưa có máy nào'}). Lần nhập này bổ sung máy mới, kết quả của các máy đã có giữ nguyên.</div>
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

            <div className="eqa-stats is-five">
              <StatCard tone="neutral" label="Kết quả" value={preview.counts.total} />
              <StatCard tone="success" label="Chấp nhận" value={preview.counts.ok} />
              <StatCard tone="warning" label="Cảnh báo" value={preview.counts.warn} />
              <StatCard tone="danger" label="Không chấp nhận" value={preview.counts.rej} detail={`PT score ${pctText(preview.counts.pt_score)}`} />
              <StatCard tone={preview.blocking ? 'danger' : 'success'} label="Lỗi chặn" value={preview.blocking} detail={preview.blocking ? 'Phải xử lý trước khi ghi' : 'Có thể ghi'} />
            </div>

            <section className="eqa-import-block" aria-label="Ánh xạ xét nghiệm">
              <h3>Ánh xạ sang xét nghiệm trong danh mục</h3>
              <p className="eqa-note">Mỗi cặp mã thông số × máy ứng với một xét nghiệm (thông số trên một máy) của Cấu hình chung. Ánh xạ được lưu để dùng lại cho các đợt sau của chương trình.</p>
              <div className="eqa-table-wrap">
                <table className="eqa-table">
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
                            <select aria-label={`Xét nghiệm cho ${pair.code} trên ${pair.instrument}`} value={value}
                              onChange={(e) => setMappings((m) => ({ ...m, [key]: { code: pair.code, instrument: pair.instrument, testId: e.target.value } }))}>
                              <option value="">— Chọn xét nghiệm —</option>
                              {pair.suggestions.length > 0 && <optgroup label="Gợi ý">{testOptions.filter((o) => pair.suggestions.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>}
                              <optgroup label="Tất cả xét nghiệm">{testOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
                            </select>
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
                  <table className="eqa-table">
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

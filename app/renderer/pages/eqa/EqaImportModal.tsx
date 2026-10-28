// Nhập một kỳ ngoại kiểm: chọn file → main xem trước (kiểm dòng, ánh xạ,
// chiều dữ liệu, z, xếp loại) → người dùng ánh xạ cặp mã thông số × máy và
// xác nhận đảo cột có lý do → ghi. Dữ liệu của công cụ cũ có nhiều kỳ: chọn
// từng kỳ để xem trước và nhập lần lượt; ánh xạ đã lưu tự dùng cho kỳ sau.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useManageStore } from '../../store/manage-store';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { readEqaExcelFiles, readLegacyEqaFile } from '../../lib/eqa-file';
import type { EqaImportInput, EqaImportPreview } from '../../../shared/qc-api';
import { eqaNormalize } from '../../../main/domain/eqa/evaluation';
import { eqaPairKey, type EqaParsedSource } from '../../../main/domain/eqa/import';
import { pctText, roundLabel, StatCard } from './shared';

export type EqaImportMode = 'excel' | 'legacy';

const ERROR_ROW_LIMIT = 50;

export function EqaImportModal({ mode, onClose, onImported }: { mode: EqaImportMode; onClose: () => void; onImported: (roundId: string) => void }) {
  const rounds = useEqaStore((s) => s.rounds);
  const [sources, setSources] = useState<EqaParsedSource[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [fileError, setFileError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [imported, setImported] = useState<Record<number, string>>({});

  async function pick(files: FileList | null) {
    const list = files ? [...files] : [];
    if (!list.length) return;
    setParsing(true); setFileError(''); setSources([]); setActive(null); setImported({});
    try {
      if (mode === 'excel') {
        const merged = await readEqaExcelFiles(list);
        setSources([merged]); setActive(0);
        setSourceName(list.map((f) => f.name).join(', '));
        if (merged.errors.length) setFileError(merged.errors.join('\n'));
      } else {
        const legacy = await readLegacyEqaFile(list[0]);
        setSources(legacy.sources); setSourceName(list[0].name);
        if (legacy.error) setFileError(legacy.error);
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Không đọc được file.');
    } finally { setParsing(false); }
  }

  /** Kỳ cùng chương trình/năm/đợt đã có trong app (để báo trước khi nhập lại). */
  const existingOf = (source: EqaParsedSource) => rounds.find((r) => eqaNormalize(r.program_name) === eqaNormalize(source.round.program)
    && r.year === source.round.year && eqaNormalize(r.round) === eqaNormalize(source.round.round));

  const current = active === null ? null : sources[active] ?? null;
  const title = mode === 'excel' ? 'Nhập kỳ ngoại kiểm từ Excel' : 'Nhập dữ liệu từ công cụ phân tích ngoại kiểm cũ';

  // Mỗi bước là một modal riêng có chân modal chuẩn: chọn file, rồi xem trước một kỳ.
  if (current) {
    return (
      <EqaImportReview key={active} title={title} source={current} mode={mode} sourceName={sourceName} onClose={onClose}
        onBack={mode === 'legacy' ? () => setActive(null) : onClose}
        backLabel={mode === 'legacy' ? 'Về danh sách kỳ' : 'Huỷ'}
        onImported={(roundId) => {
          if (mode === 'legacy' && active !== null) { setImported((m) => ({ ...m, [active]: roundId })); setActive(null); }
          onImported(roundId);
        }} />
    );
  }

  return (
    <Modal title={title} size="xl" onClose={onClose} footer={<button type="button" className="btn ghost" onClick={onClose}>Đóng</button>}>
      <div className="eqa-import-pick">
          <div className="field">
            <label htmlFor="eqaFile">{mode === 'excel' ? 'File Excel theo mẫu Mau_nhap_du_lieu_EQA.xlsx (chọn được nhiều file của cùng một kỳ)' : 'File phan_tich_ngoai_kiem.html hoặc file sao lưu EQA_du_lieu_*.json'}</label>
            <input id="eqaFile" type="file" accept={mode === 'excel' ? '.xlsx' : '.html,.htm,.json'} multiple={mode === 'excel'} onChange={(e) => void pick(e.target.files)} />
          </div>
          {parsing && <p className="eqa-note" role="status">Đang đọc file…</p>}
          {fileError && <div className="alert rej eqa-pre" role="alert">{fileError}</div>}
          {mode === 'legacy' && sources.length > 0 && (
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>Đợt / năm</th><th>Chương trình</th><th>Đơn vị tổ chức</th><th className="num">Kết quả</th><th>Trong app</th><th aria-label="Thao tác" /></tr></thead>
                <tbody>
                  {sources.map((source, index) => {
                    const existing = existingOf(source);
                    return (
                      <tr key={`${source.round.round}-${index}`}>
                        <td><b className="eqa-strong">{roundLabel(source.round)}</b></td>
                        <td>{source.round.program}</td>
                        <td>{source.round.provider || '—'}</td>
                        <td className="num">{source.rows.length}</td>
                        <td>{imported[index] ? <span className="tag ok">Vừa nhập</span> : existing ? <span className="tag none">Đã có · phiên bản {existing.version}</span> : <span className="tag warn">Chưa nhập</span>}</td>
                        <td><button type="button" className="btn ghost sm" onClick={() => setActive(index)}>Xem trước</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </Modal>
  );
}

function EqaImportReview({ title, source, mode, sourceName, onClose, onBack, backLabel, onImported }: {
  title: string; source: EqaParsedSource; mode: EqaImportMode; sourceName: string;
  onClose: () => void; onBack: () => void; backLabel: string; onImported: (roundId: string) => void;
}) {
  const { preview: runPreview, importRound } = useEqaStore(useShallow((s) => ({ preview: s.preview, importRound: s.importRound })));
  const { tests, instruments } = useManageStore(useShallow((s) => ({ tests: s.tests, instruments: s.instruments })));
  const [mappings, setMappings] = useState<Record<string, { code: string; instrument: string; testId: string }>>({});
  const [swapOn, setSwapOn] = useState<Record<string, string>>({});
  const [swapReason, setSwapReason] = useState<Record<string, string>>({});
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

  const input = (withReasons: boolean): EqaImportInput => ({
    round: source.round, rows: source.rows, source: mode === 'legacy' ? 'html-import' : 'excel', sourceName,
    mappings: Object.values(mappings).filter((m) => m.testId),
    swaps: Object.entries(swapOn).map(([, instrument]) => ({ instrument, reason: withReasons ? swapReason[eqaNormalize(instrument)] ?? '' : '' })),
    ...(withReasons ? { replaceReason, expectedVersion: preview?.existing?.row_version } : {}),
  });
  // Chỉ lựa chọn ánh xạ/đảo cột làm thay đổi kết quả xem trước; lý do gõ tay thì không.
  const previewKey = JSON.stringify([mappings, Object.keys(swapOn).sort()]);

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

  const flagged = preview?.swaps.filter((s) => s.flagged) ?? [];
  const missingSwapReason = flagged.some((s) => swapOn[eqaNormalize(s.instrument)] && (swapReason[eqaNormalize(s.instrument)] ?? '').trim().length < 10);
  const needsReplaceReason = !!preview?.existing && replaceReason.trim().length < 10;
  const errorRows = preview?.rows.filter((r) => r.errors.length) ?? [];
  const warningRows = preview?.rows.filter((r) => r.warnings.length) ?? [];
  const canImport = !!preview && !loading && !busy && preview.blocking === 0 && !missingSwapReason && !needsReplaceReason;

  async function submit() {
    setBusy(true); setError('');
    const result = await importRound(input(true));
    setBusy(false);
    if (result.ok) onImported(result.data.round.id); else setError(result.error.message);
  }

  return (
    <Modal title={title} size="xl" onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" onClick={onBack}>{backLabel}</button>
        <button type="button" className="btn teal" disabled={!canImport} onClick={() => void submit()}>{busy ? 'Đang ghi…' : preview?.existing ? 'Nhập lại kỳ này' : 'Ghi kỳ ngoại kiểm'}</button>
      </>}>
    <div className="eqa-import-review">
      <section className="eqa-import-block" aria-label="Thông tin kỳ trong file">
        <h3>{source.round.program || 'Chưa có tên chương trình'} · {roundLabel(source.round)}</h3>
        <dl className="eqa-facts">
          {([
            ['Đơn vị tổ chức', source.round.provider], ['Mã chương trình', source.round.programCode], ['Mã đơn vị', source.round.unitCode],
            ['Mã báo cáo', source.round.reportCode], ['Số dòng kết quả', String(source.rows.length)], ['Nguồn', sourceName],
          ] as [string, string][]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="hint-inline">Chưa ghi nhận.</span>}</dd></div>)}
        </dl>
        {source.errors.length > 0 && <div className="alert rej eqa-pre" role="alert">{source.errors.join('\n')}</div>}
        {preview?.existing && (
          <div className="eqa-replace">
            <div className="alert warn">Kỳ này đã có trong app (phiên bản {preview.existing.version}{preview.existing.status === 'cancelled' ? ', đã huỷ' : ''}). Nhập lại tạo phiên bản {preview.existing.version + 1}; phiên bản cũ vẫn được giữ trong CSDL.</div>
            <div className="field">
              <label htmlFor="eqaReplaceReason">Lý do nhập lại (ít nhất 10 ký tự)</label>
              <input id="eqaReplaceReason" value={replaceReason} onChange={(e) => setReplaceReason(e.target.value)} />
            </div>
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

          {flagged.length > 0 && (
            <section className="eqa-import-block" aria-label="Dữ liệu có thể đảo cột">
              <h3>Dữ liệu có thể đảo cột</h3>
              <p className="eqa-note">z app tính ngược dấu với z nhà cung cấp ở đa số dòng của máy: cột kết quả PXN và giá trị ấn định có thể đã bị đổi chỗ khi nhập. Đối chiếu báo cáo gốc; chỉ đảo lại khi đã xác nhận, kèm lý do.</p>
              {flagged.map((s) => {
                const key = eqaNormalize(s.instrument);
                return (
                  <div className="eqa-swap" key={key}>
                    <label className="eqa-toggle"><input type="checkbox" checked={!!swapOn[key]} onChange={(e) => setSwapOn((m) => { const next = { ...m }; if (e.target.checked) next[key] = s.instrument; else delete next[key]; return next; })} />
                      Đảo lại cột cho máy <b>{s.instrument}</b> ({s.swapped_rows}/{s.rows} dòng ngược dấu)</label>
                    {swapOn[key] && (
                      <div className="field">
                        <label htmlFor={`eqaSwap-${key}`}>Lý do đảo cột (ít nhất 10 ký tự)</label>
                        <input id={`eqaSwap-${key}`} value={swapReason[key] ?? ''} onChange={(e) => setSwapReason((m) => ({ ...m, [key]: e.target.value }))} placeholder="Ví dụ: đối chiếu báo cáo gốc, file nhập đổi chỗ hai cột" />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <section className="eqa-import-block" aria-label="Ánh xạ xét nghiệm">
            <h3>Ánh xạ sang xét nghiệm trong danh mục</h3>
            <p className="eqa-note">Mỗi cặp mã thông số × máy trong file ứng với một xét nghiệm (thông số trên một máy) của Cấu hình chung. Ánh xạ được lưu để dùng lại cho các kỳ sau của chương trình.</p>
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>Mã thông số</th><th>Máy trong file</th><th className="num">Dòng</th><th>Xét nghiệm trong danh mục</th></tr></thead>
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

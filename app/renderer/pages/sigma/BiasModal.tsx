// Hộp thoại Bias% cho Six Sigma (docs/SIGMA-REVIEW-2026-11-17.md): nhập tay
// từng vòng EQA/EQC hoặc lấy từ kết quả ngoại kiểm đã nhập trong app. Sigma
// dùng trung bình có dấu; RMS chỉ hiện để tham khảo cho ngân sách MU.
import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { RowActionButton } from '../../components/RowActionButton';
import { infoDialog, errorDialog } from '../../state/dialog-store';
import { parseEqaDraft, type EqaDraftRow } from '../../lib/sigma-workflow';
import { vnDate } from '../../lib/format';
import { eqaRoundBias, eqaRoundsStats } from '../../../main/domain/sigma-metrics';
import { SIGMA_EQA_BIAS_RULES, SIGMA_EQA_EXCLUSION_LABEL } from '../../../main/domain/sigma-eqa-bias';
import type { SigmaEqaBiasView, SigmaEqaRound } from '../../../shared/qc-api';
import { AsyncButton } from '../../components/AsyncButton';

const EMPTY: EqaDraftRow[] = [{ lab: '', target: '' }, { lab: '', target: '' }, { lab: '', target: '' }];

export function BiasModal({ initialRounds, initialWindowMonths, source, onClose, onSubmit }: {
  initialRounds: SigmaEqaRound[];
  initialWindowMonths?: number;
  /** Mức mở hộp thoại để xem căn cứ cũ; mẫu mới được lấy chung theo xét nghiệm và kỳ. */
  source: { testId: string; period: string; level: number };
  onClose: () => void;
  onSubmit: (rounds: Array<{ lab: number; target: number; eqaResultId?: string; label?: string }>, windowMonths: number) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [monthsDraft, setMonthsDraft] = useState(String(initialWindowMonths ?? SIGMA_EQA_BIAS_RULES.windowMonths));
  const [loadedWindowMonths, setLoadedWindowMonths] = useState(initialWindowMonths ?? SIGMA_EQA_BIAS_RULES.windowMonths);
  const [loadingSource, setLoadingSource] = useState(false);
  const sourceRevision = useRef(0);
  const windowMonths = Number(monthsDraft);
  const validMonths = monthsDraft.trim() !== '' && Number.isSafeInteger(windowMonths) && windowMonths >= 1;
  const [rounds, setRounds] = useState<EqaDraftRow[]>(() => initialRounds.length
    ? initialRounds.map((round) => ({ lab: round.lab != null ? String(round.lab) : '', target: round.target != null ? String(round.target) : '',
      ...(round.eqaResultId ? { eqaResultId: round.eqaResultId, label: round.label ?? '' } : {}) }))
    : EMPTY);
  const [selection, setSelection] = useState<SigmaEqaBiasView | null>(null);
  // Một lần áp dụng chỉ dùng một nguồn: toàn bộ mẫu ngoại kiểm hợp lệ, hoặc vòng nhập tay (SB-4b).
  const fromEqa = rounds.some(r => r.eqaResultId);
  const sourceOutdated = fromEqa && loadedWindowMonths !== windowMonths;
  const { parsedRounds, hasIncompleteRound } = parseEqaDraft(rounds);
  // Xem trước dùng đúng công thức main dùng khi lưu (SB-1).
  const eqa = eqaRoundsStats(parsedRounds.map((round) => eqaRoundBias(round.lab, round.target)));

  async function loadFromEqa() {
    if (!validMonths) return;
    const revision = ++sourceRevision.current;
    setLoadingSource(true);
    try {
      const view = await window.qcApi.getSigmaEqaBias(source.testId, source.period, source.level, windowMonths);
      if (revision !== sourceRevision.current) return;
      if (!view) { await errorDialog('Không đọc được kết quả ngoại kiểm cho kỳ này.', { title: 'Chưa lấy được Bias' }); return; }
      setSelection(view);
      setLoadedWindowMonths(view.windowMonths);
      setRounds(view.included.map((s) => ({ lab: String(s.result), target: String(s.assigned), eqaResultId: s.resultId, label: s.label })));
    } catch (e) {
      if (revision === sourceRevision.current) await errorDialog(e instanceof Error ? e.message : 'Không đọc được kết quả ngoại kiểm.', { title: 'Chưa lấy được Bias' });
    } finally { if (revision === sourceRevision.current) setLoadingSource(false); }
  }

  // Dòng lấy từ ngoại kiểm chỉ đọc; chỉ dòng nhập tay sửa được.
  const change = (i: number, key: 'lab' | 'target', value: string) => setRounds((r) => r.map((x, j) => (j === i
    ? { lab: key === 'lab' ? value : x.lab, target: key === 'target' ? value : x.target } : x)));

  function switchToManual() {
    sourceRevision.current++;
    setLoadingSource(false); setSelection(null); setRounds(EMPTY);
  }

  async function submit() {
    if (!validMonths || sourceOutdated || loadingSource) return;
    if (hasIncompleteRound) {
      await infoDialog('Mỗi vòng đã nhập cần đủ KQ PXN và Target EQA hợp lệ (Target khác 0).', { title: 'Chưa thể áp dụng Bias%', type: 'warn' });
      return;
    }
    if (!parsedRounds.length) {
      await infoDialog('Nhập ít nhất 1 vòng EQA/EQC.', { title: 'Chưa thể áp dụng Bias%', type: 'warn' });
      return;
    }
    const result = await onSubmit(parsedRounds, windowMonths);
    if (!result.ok) await errorDialog(result.error?.message || 'Lỗi không xác định.', { title: 'Không thể áp dụng Bias%' });
  }

  return (
    <Modal title="Bias% cho Six Sigma" onClose={onClose} size="lg"
      footer={<><button className="btn ghost" onClick={onClose}>Huỷ</button><AsyncButton className="btn teal" disabled={!validMonths || sourceOutdated || loadingSource} onClick={submit}>Áp dụng Bias%</AsyncButton></>}>
      <div className="sg-eqa-source">
        <div className="field sg-eqa-window"><label htmlFor="sgEqaWindowMonths">Số tháng</label><input id="sgEqaWindowMonths" type="number" min="1" step="1" value={monthsDraft} aria-invalid={!validMonths || undefined}
          onChange={e => { setMonthsDraft(e.target.value); sourceRevision.current++; setLoadingSource(false); setSelection(null); }} /></div>
        <AsyncButton className="btn ghost sm" disabled={!validMonths} onClick={loadFromEqa}>Lấy từ ngoại kiểm</AsyncButton>
        <span className="hint-inline">Tối thiểu 1 tháng, tính đến hết tháng Sigma. Lấy tất cả mẫu hợp lệ của cùng xét nghiệm và máy.</span>
      </div>
      {!validMonths && <p className="alert warn">Nhập số tháng là số nguyên từ 1 trở lên.</p>}
      {validMonths && sourceOutdated && <p className="alert warn">Số tháng đã đổi. Bấm Lấy từ ngoại kiểm để cập nhật mẫu trước khi áp dụng.</p>}
      <p className="hint-inline">{fromEqa
        ? 'Mẫu ngoại kiểm: áp dụng một Bias% chung cho tất cả mức QC của kỳ này, dùng đủ mọi mẫu hợp lệ. CV và TEa giữ riêng từng mức; các kỳ khác không đổi.'
        : `Vòng nhập tay chỉ áp dụng cho mức ${source.level}.`}</p>
      {selection && (
        <div className="sg-eqa-selection">
          <p className="hint-inline">Báo cáo từ {vnDate(selection.window.start)} tới {vnDate(selection.window.end)} · {selection.included.length} mẫu dùng trong {new Set(selection.included.map(s => s.reportDate.slice(0, 7))).size}/{selection.windowMonths} tháng · {selection.excluded.length} mẫu loại.</p>
          {!selection.included.length && <div className="alert warn">Không có mẫu ngoại kiểm hợp lệ trong khoảng này; chưa đủ căn cứ áp dụng Bias chung.</div>}
          {selection.excluded.length > 0 && <details>
            <summary>Mẫu bị loại ({selection.excluded.length})</summary>
            <ul className="sg-eqa-excluded">{selection.excluded.map((s) => <li key={s.resultId}>{s.label} · {vnDate(s.reportDate)} · {SIGMA_EQA_EXCLUSION_LABEL[s.reason]}</li>)}</ul>
          </details>}
        </div>
      )}
      <div className="sg-eqa-table-wrap">
        <table className="sg-eqa-table">
          <thead><tr><th>#</th><th>Nguồn</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th>Thao tác</th></tr></thead>
          <tbody>
            {rounds.map((v, i) => {
              const lab = Number(v.lab), target = Number(v.target);
              const bias = v.lab.trim() !== '' && v.target.trim() !== '' && Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? (lab - target) / Math.abs(target) * 100 : null;
              return (
                <tr key={i}>
                  <td className="sg-eqa-index">{i + 1}</td>
                  <td className="sg-eqa-label">{v.eqaResultId ? v.label : 'Nhập tay'}</td>
                  <td><input type="number" step="any" aria-label={`KQ PXN vòng ${i + 1}`} value={v.lab} readOnly={!!v.eqaResultId} onChange={(e) => change(i, 'lab', e.target.value)} /></td>
                  <td><input type="number" step="any" aria-label={`Target EQA vòng ${i + 1}`} value={v.target} readOnly={!!v.eqaResultId} onChange={(e) => change(i, 'target', e.target.value)} /></td>
                  <td className="sg-eqa-bias" style={{ color: bias != null ? (Math.abs(bias) > 10 ? 'var(--danger-text)' : 'var(--accent)') : undefined }}>{bias != null ? `${bias.toFixed(2)}%` : '—'}</td>
                  <td>{v.eqaResultId ? '—' : <RowActionButton kind="delete" label={`Xoá vòng EQA ${i + 1}`} className="sg-eqa-del" onClick={() => setRounds((r) => r.filter((_, j) => j !== i))} disabled={rounds.length <= 1} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {fromEqa
        ? <button type="button" className="btn ghost sm sg-eqa-add" onClick={switchToManual}>Bỏ mẫu ngoại kiểm, nhập tay</button>
        : <button type="button" className="btn ghost sm sg-eqa-add" onClick={() => setRounds((r) => [...r, { lab: '', target: '' }])}>+ Thêm vòng</button>}
      <div className={`sg-eqa-summary${parsedRounds.length ? '' : ' is-empty'}`}>
        {eqa ? (
          <>
            <div><span>Số vòng/mẫu hợp lệ</span><b>{eqa.n}</b></div>
            <div><span>Bias dùng tính Sigma (TB có dấu)</span><b className="sg-eqa-average">{eqa.mean.toFixed(3)}</b></div>
            {eqa.biasSem != null && <div><span>Sai số chuẩn của Bias</span><b>{eqa.biasSem.toFixed(3)}</b></div>}
            {eqa.n > 1 && <div><span>Bias RMS (chỉ dùng cho MU)</span><b>{eqa.rms.toFixed(3)}</b></div>}
            {eqa.mixedSigns && <div className="sg-eqa-warning">Bias đổi dấu giữa các vòng: sai số hệ thống không ổn định, xem lại trước khi dùng.</div>}
            {eqa.n < SIGMA_EQA_BIAS_RULES.minSamples && <div className="sg-eqa-warning">Chưa đủ {SIGMA_EQA_BIAS_RULES.minSamples} vòng/mẫu; ước lượng Bias còn dao động lớn.</div>}
          </>
        ) : <span className="sg-eqa-empty">Nhập đủ KQ PXN và Target EQA cho ít nhất 1 vòng, hoặc lấy từ ngoại kiểm.</span>}
      </div>
    </Modal>
  );
}

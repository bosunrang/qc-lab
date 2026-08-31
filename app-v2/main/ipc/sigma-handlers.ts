// IPC handler cho trang Six Sigma. Moi ky (period) luu CV/Bias/u(cal) da
// duoc ky thuat vien REVIEW thu cong (khong tu dong suy tu diem QC - dung
// chinh sach da chot: CV/Bias la gia tri da duoc xem xet, khong phai
// trung binh tho). sigma/MU tinh SONG lai tu du lieu da luu, khong cache
// cung, de doi TEa/CV/Bias sau nay luon phan anh dung.
import type { Db } from '../db/open-database';
import { sigmaMetric, uncertaintyBudget, type SigmaMetricResult, type UncertaintyBudgetResult } from '../domain/sigma-metrics';
import { cleanId, cleanText, finiteNumber } from '../domain/text-utils';
import { type Actor, type IpcResult, writeAudit } from './shared';

const PERIOD_RE = /^\d{4}-\d{2}$/;

export interface SigmaLevelInput { level: number; cv?: unknown; biasEqa?: unknown; uCal?: unknown; muBiasMode?: 'include' | 'exclude' }
export interface SigmaPeriodInput { testId: unknown; period: unknown; tea?: unknown; teaSource?: unknown; levels: SigmaLevelInput[] }

export interface SigmaLevelResult {
  level: number; cv: number | null; biasEqa: number | null; uCal: number | null;
  sigma: SigmaMetricResult | null; mu: UncertaintyBudgetResult | null;
}
export interface SigmaPeriodView { id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[] }

interface StoredLevel { level: number; cv: number | null; biasEqa: number | null; uCal: number | null; muBiasMode: 'include' | 'exclude' }

function computeLevel(stored: StoredLevel, tea: number | null): SigmaLevelResult {
  const sigma = tea != null && stored.cv != null ? sigmaMetric(tea, stored.biasEqa || 0, stored.cv) : null;
  const mu = stored.cv != null
    ? uncertaintyBudget({ cv: stored.cv, bias: stored.biasEqa, includeBias: stored.muBiasMode !== 'exclude', uCal: stored.uCal, tea: tea ?? undefined })
    : null;
  return { level: stored.level, cv: stored.cv, biasEqa: stored.biasEqa, uCal: stored.uCal, sigma, mu };
}

export function createSigmaHandlers(db: Db) {
  function listPeriods(testId: string): SigmaPeriodView[] {
    const rows = db.prepare('SELECT * FROM sigma_data WHERE test_id=? ORDER BY period DESC').all(testId) as {
      id: string; test_id: string; period: string; tea: number | null; tea_source: string; lv_json: string;
    }[];
    return rows.map(r => {
      const stored: StoredLevel[] = JSON.parse(r.lv_json || '[]');
      return { id: r.id, testId: r.test_id, period: r.period, tea: r.tea, teaSource: r.tea_source, levels: stored.map(s => computeLevel(s, r.tea)) };
    });
  }

  function savePeriod(input: SigmaPeriodInput, actor: Actor): IpcResult<SigmaPeriodView> {
    const testId = cleanId(input.testId);
    const test = db.prepare('SELECT id, name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay xet nghiem.' } };
    const period = cleanText(input.period, 7).trim();
    if (!PERIOD_RE.test(period)) return { ok: false, error: { code: 'invalid-period', message: 'Ky phai co dinh dang YYYY-MM.' } };
    if (!Array.isArray(input.levels) || !input.levels.length) return { ok: false, error: { code: 'missing-levels', message: 'Can it nhat 1 muc du lieu.' } };
    const tea = input.tea == null || input.tea === '' ? null : finiteNumber(input.tea, NaN);
    if (tea != null && (!Number.isFinite(tea) || tea <= 0)) return { ok: false, error: { code: 'invalid-tea', message: 'TEa phai la so duong.' } };
    const stored: StoredLevel[] = input.levels.map(lv => ({
      level: Math.round(finiteNumber(lv.level, 1)),
      cv: lv.cv == null || lv.cv === '' ? null : finiteNumber(lv.cv, NaN),
      biasEqa: lv.biasEqa == null || lv.biasEqa === '' ? null : finiteNumber(lv.biasEqa, NaN),
      uCal: lv.uCal == null || lv.uCal === '' ? null : finiteNumber(lv.uCal, NaN),
      muBiasMode: lv.muBiasMode === 'exclude' ? 'exclude' : 'include',
    }));
    const teaSource = cleanText(input.teaSource, 200).trim();
    const id = `${testId}:${period}`;
    const existing = db.prepare('SELECT id FROM sigma_data WHERE id=?').get(id);
    if (existing) {
      db.prepare('UPDATE sigma_data SET tea=?, tea_source=?, lv_json=? WHERE id=?').run(tea, teaSource, JSON.stringify(stored), id);
    } else {
      db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)').run(id, testId, period, tea, teaSource, JSON.stringify(stored));
    }
    writeAudit(db, actor, existing ? 'Sua ky Six Sigma' : 'Them ky Six Sigma', `Ky ${period} cua xet nghiem "${test.name}"`, test.name);
    return { ok: true, data: { id, testId, period, tea, teaSource, levels: stored.map(s => computeLevel(s, tea)) } };
  }

  return { listPeriods, savePeriod };
}

export type SigmaHandlers = ReturnType<typeof createSigmaHandlers>;

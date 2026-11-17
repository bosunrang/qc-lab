// Trang Phân tích ngoại kiểm (docs/EQA-PLAN-2026-10-28.md).
// `#/eqa` là tổng quan; `#/eqa?view=lich&schedule=…` định vị một lịch theo hạn nộp;
// `#/eqa?id=…` là một kỳ; `#/eqa?test=…` là chuỗi của một xét nghiệm. Dùng tham số truy vấn như
// trang Khắc phục sự cố để không phải đổi bảng route dùng chung `PAGE_DEFS`.
import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEqaStore } from '../store/eqa-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useCatalog } from '../lib/useCatalog';
import { PageHeader } from '../components/PageHeader';
import { EqaOverview } from './eqa/EqaOverview';
import { EqaRoundDetail } from './eqa/EqaRoundDetail';
import { EqaSchedule } from './eqa/EqaSchedule';
import { EqaTestDetail } from './eqa/EqaTestDetail';
import { EqaReports } from './eqa/EqaReports';
import { EqaCorrective } from './eqa/EqaCorrective';
import { eqaContextParams, type EqaNavigationContext } from './eqa/useEqaScope';

export function EqaPage() {
  const load = useEqaStore((s) => s.load);
  const [params, setParams] = useSearchParams();
  const id = params.get('id') || '';
  const testId = params.get('test') || '';
  const location = useLocation();
  const navigate = useNavigate();
  // Chuỗi xét nghiệm mở từ tổng quan hoặc từ một kỳ: quay lại đúng nơi đã mở;
  // mở thẳng bằng đường dẫn thì về tổng quan.
  const back = () => { if (location.key !== 'default') navigate(-1); else setParams(eqaContextParams(params)); };
  const openTest = (test: string, context?: EqaNavigationContext, replace = false) => {
    const query = eqaContextParams(params, context);
    query.set('test', test);
    setParams(query, { replace });
  };
  const openRound = (roundId: string, resultId?: string) => {
    const query = eqaContextParams(params, { resultId });
    query.set('id', roundId);
    setParams(query);
  };
  const switchView = (next: 'overview' | 'schedule' | 'reports' | 'corrective' = 'overview') => {
    const query = eqaContextParams(params);
    for (const key of ['reportRound', 'reportMachine', 'fixRound', 'fixMachine']) if (params.has(key)) query.set(key, params.get(key)!);
    query.delete('view');
    if (next !== 'overview') query.set('view', next === 'schedule' ? 'lich' : next === 'corrective' ? 'khacphuc' : 'baocao');
    setParams(query);
  };
  const view = params.get('view') === 'lich' ? 'schedule' : params.get('view') === 'baocao' ? 'reports' : params.get('view') === 'khacphuc' ? 'corrective' : 'overview';

  useEffect(() => { void load(); }, [load]);
  useCatalog(['tests', 'instruments']);
  // Tên xét nghiệm/máy hiển thị trong danh sách đọc từ danh mục.
  useStoreInvalidation(['eqa_rounds', 'eqa_schedule', 'eqa_programs', 'tests', 'instruments'], undefined, load);

  return (
    <div className={`eqa-page${testId ? ' is-test-detail' : ''}`}>
      <PageHeader title="Phân tích ngoại kiểm" subtitle="Nhập kết quả ngoại kiểm, đánh giá z-score và đối chiếu đánh giá của nhà cung cấp" />
      {testId
        ? <EqaTestDetail testId={testId} onBack={back} onOpenTest={openTest} onOpenRound={openRound} />
        : id
        ? <EqaRoundDetail key={id} id={id} focusedResultId={params.get('point') ?? undefined} onBack={back} onOpenTest={openTest} />
        : <>
          <div className="dayseg eqa-view-switch" role="group" aria-label="Chế độ xem ngoại kiểm">
            <button type="button" aria-pressed={view === 'overview'} className={view === 'overview' ? 'on' : ''} onClick={() => switchView()}>Tổng quan</button>
            <button type="button" aria-pressed={view === 'schedule'} className={view === 'schedule' ? 'on' : ''} onClick={() => switchView('schedule')}>Lịch</button>
            <button type="button" aria-pressed={view === 'reports'} className={view === 'reports' ? 'on' : ''} onClick={() => switchView('reports')}>Báo cáo</button>
            <button type="button" aria-pressed={view === 'corrective'} className={view === 'corrective' ? 'on' : ''} onClick={() => switchView('corrective')}>Khắc phục</button>
          </div>
          {view === 'schedule'
            ? <EqaSchedule targetScheduleId={params.get('schedule') || ''} onOpenRound={openRound} />
            : view === 'reports' ? <EqaReports />
            : view === 'corrective' ? <EqaCorrective />
            : <EqaOverview onOpen={openRound} onOpenSchedule={() => switchView('schedule')} onOpenTest={openTest} />}
        </>}
    </div>
  );
}

// Trang Phân tích ngoại kiểm (docs/EQA-PLAN-2026-10-28.md).
// `#/eqa` là tổng quan; `#/eqa?view=lich` là lịch đợt và hạn nộp;
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
  const switchView = (schedule = false) => {
    const query = eqaContextParams(params);
    if (schedule) query.set('view', 'lich');
    setParams(query);
  };
  const view = params.get('view') === 'lich' ? 'schedule' : 'overview';

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
          <div className="dayseg eqa-view-switch" role="tablist" aria-label="Chế độ xem ngoại kiểm">
            <button type="button" role="tab" aria-selected={view === 'overview'} className={view === 'overview' ? 'on' : ''} onClick={() => switchView()}>Tổng quan</button>
            <button type="button" role="tab" aria-selected={view === 'schedule'} className={view === 'schedule' ? 'on' : ''} onClick={() => switchView(true)}>Lịch</button>
          </div>
          {view === 'schedule'
            ? <EqaSchedule onOpenRound={openRound} />
            : <EqaOverview onOpen={openRound} onOpenSchedule={() => switchView(true)} onOpenTest={openTest} />}
        </>}
    </div>
  );
}

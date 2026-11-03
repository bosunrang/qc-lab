// Trang Phân tích ngoại kiểm (docs/EQA-PLAN-2026-10-28.md).
// `#/eqa` là danh sách kỳ; `#/eqa?view=lich` là lịch đợt và hạn nộp;
// `#/eqa?id=…` là một kỳ. Dùng tham số truy vấn như
// trang Khắc phục sự cố để không phải đổi bảng route dùng chung `PAGE_DEFS`.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEqaStore } from '../store/eqa-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useCatalog } from '../lib/useCatalog';
import { PageHeader } from '../components/PageHeader';
import { EqaOverview } from './eqa/EqaOverview';
import { EqaRoundDetail } from './eqa/EqaRoundDetail';
import { EqaSchedule } from './eqa/EqaSchedule';

export function EqaPage() {
  const load = useEqaStore((s) => s.load);
  const [params, setParams] = useSearchParams();
  const id = params.get('id') || '';
  const view = params.get('view') === 'lich' ? 'schedule' : 'overview';

  useEffect(() => { void load(); }, [load]);
  useCatalog(['tests', 'instruments']);
  // Tên xét nghiệm/máy hiển thị trong danh sách đọc từ danh mục.
  useStoreInvalidation(['eqa_rounds', 'eqa_schedule', 'eqa_programs', 'tests', 'instruments'], undefined, load);

  return (
    <div className="eqa-page">
      <PageHeader title="Phân tích ngoại kiểm" subtitle="Nhập kết quả ngoại kiểm, đánh giá z-score và đối chiếu đánh giá của nhà cung cấp" />
      {id
        ? <EqaRoundDetail key={id} id={id} onBack={() => setParams({})} />
        : <>
          <div className="dayseg eqa-view-switch" role="tablist" aria-label="Chế độ xem ngoại kiểm">
            <button type="button" role="tab" aria-selected={view === 'overview'} className={view === 'overview' ? 'on' : ''} onClick={() => setParams({})}>Tổng quan</button>
            <button type="button" role="tab" aria-selected={view === 'schedule'} className={view === 'schedule' ? 'on' : ''} onClick={() => setParams({ view: 'lich' })}>Lịch</button>
          </div>
          {view === 'schedule'
            ? <EqaSchedule />
            : <EqaOverview onOpen={(roundId) => setParams({ id: roundId })} onOpenSchedule={() => setParams({ view: 'lich' })} />}
        </>}
    </div>
  );
}

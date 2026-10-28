// Trang Phân tích ngoại kiểm (docs/EQA-PLAN-2026-10-28.md, giai đoạn 1).
// `#/eqa` là danh sách kỳ; `#/eqa?id=…` là một kỳ. Dùng tham số truy vấn như
// trang Khắc phục sự cố để không phải đổi bảng route dùng chung `PAGE_DEFS`.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEqaStore } from '../store/eqa-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useCatalog } from '../lib/useCatalog';
import { PageHeader } from '../components/PageHeader';
import { EqaOverview } from './eqa/EqaOverview';
import { EqaRoundDetail } from './eqa/EqaRoundDetail';

export function EqaPage() {
  const load = useEqaStore((s) => s.load);
  const [params, setParams] = useSearchParams();
  const id = params.get('id') || '';

  useEffect(() => { void load(); }, [load]);
  useCatalog(['tests', 'instruments']);
  // Tên xét nghiệm/máy hiển thị trong danh sách đọc từ danh mục.
  useStoreInvalidation(['eqa_rounds', 'tests', 'instruments'], undefined, load);

  return (
    <div className="eqa-page">
      <PageHeader title="Phân tích ngoại kiểm" subtitle="Nhập kết quả ngoại kiểm, đánh giá z-score và đối chiếu đánh giá của nhà cung cấp" />
      {id
        ? <EqaRoundDetail key={id} id={id} onBack={() => setParams({})} />
        : <EqaOverview onOpen={(roundId) => setParams({ id: roundId })} />}
    </div>
  );
}

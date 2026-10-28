// Trang Khắc phục sự cố (hồ sơ NCE protocol 4, docs/NCE-REDESIGN-2026-10-12.md).
// `#/actions` là tổng quan (hàng chờ + danh sách); `#/actions?id=…` là một hồ
// sơ. Dùng tham số truy vấn thay vì route con để không phải đổi bảng route
// dùng chung `PAGE_DEFS`.
import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useNceStore } from '../store/nce-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useCatalog } from '../lib/useCatalog';
import { PageHeader } from '../components/PageHeader';
import { NceOverview } from './actions/NceOverview';
import { DossierPage } from './actions/DossierPage';

export function ActionsPage() {
  const load = useNceStore((s) => s.load);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // Tổng quan từng điều hướng bằng `state.recordId`; vẫn nhận để liên kết cũ không gãy.
  const legacyId = (location.state as { recordId?: string } | null)?.recordId ?? '';
  const id = params.get('id') || legacyId;

  useEffect(() => { void load(); }, [load]);
  useCatalog(['tests']);
  useStoreInvalidation(['nce_records', 'qc_points', 'users'], undefined, load);

  const open = (recordId: string) => setParams({ id: recordId });
  const back = () => setParams({}, { replace: false, state: null });

  return (
    <div className="nce-page">
      <PageHeader title="Khắc phục sự cố" subtitle="Ghi nhận sự cố, xử lý và theo dõi hồ sơ theo từng bước" />
      {id ? <DossierPage key={id} id={id} onBack={back} /> : <NceOverview onOpen={open} />}
    </div>
  );
}

// Zustand store cho trang Khắc phục sự cố (NCE protocol 4). Mọi hàm ghi trả
// `IpcResult<NceDossierView>` để trang hiển thị đúng lỗi của chính thao tác
// và nhận ngay hồ sơ mới (kèm `row_version` cho lần sửa kế tiếp).
//
// Không tự nạp lại danh sách sau khi ghi (kế hoạch kiến trúc D.1): main báo
// `nce_records` sau commit và trang nạp lại qua `useStoreInvalidation`.
import { create } from 'zustand';
import type { IpcResult, NceDossierView, NceQueueRowView, NceRecordRow, NceReleasePreview, NceRunKeyView, NceUserOption, QcApi } from '../../shared/qc-api';

type Input<K extends keyof QcApi> = Parameters<QcApi[K]>[0] extends { data: infer D } ? D : never;
type Write = IpcResult<NceDossierView>;

interface NceState {
  records: NceRecordRow[];
  queue: NceQueueRowView[];
  users: NceUserOption[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  get: (id: string) => Promise<NceDossierView | null>;
  previewRelease: (id: string, rerun: NceRunKeyView, lotChangeNote?: string) => Promise<IpcResult<NceReleasePreview>>;
  create: (data: Input<'createNce'>) => Promise<Write>;
  attachRun: (data: Input<'attachNceRun'>) => Promise<Write>;
  update: (data: Input<'updateNce'>) => Promise<Write>;
  addAction: (data: Input<'addNceAction'>) => Promise<Write>;
  updateAction: (data: Input<'updateNceAction'>) => Promise<Write>;
  completeAction: (data: Input<'completeNceAction'>) => Promise<Write>;
  cancelAction: (data: Input<'cancelNceAction'>) => Promise<Write>;
  recordTechnicalAssessment: (data: Input<'recordNceTechnicalAssessment'>) => Promise<Write>;
  recordPatientImpact: (data: Input<'recordNcePatientImpact'>) => Promise<Write>;
  release: (data: Input<'releaseNce'>) => Promise<Write>;
  reviewEffectiveness: (data: Input<'reviewNceEffectiveness'>) => Promise<Write>;
  submit: (data: Input<'submitNce'>) => Promise<Write>;
  approve: (data: Input<'approveNce'>) => Promise<Write>;
  returnForRevision: (data: Input<'returnNce'>) => Promise<Write>;
  cancel: (data: Input<'cancelNce'>) => Promise<Write>;
}

export const useNceStore = create<NceState>((set) => ({
  records: [],
  queue: [],
  users: [],
  loading: true,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const [records, queue, users] = await Promise.all([window.qcApi.listNce(), window.qcApi.listNceQueue(), window.qcApi.listNceUsers()]);
      set({ records, queue, users, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Không tải được danh sách sự cố.' });
    }
  },
  get: (id) => window.qcApi.getNce(id),
  previewRelease: (id, rerun, lotChangeNote) => window.qcApi.previewNceRelease({ data: { id, rerun, lotChangeNote } }),
  create: (data) => window.qcApi.createNce({ data }),
  attachRun: (data) => window.qcApi.attachNceRun({ data }),
  update: (data) => window.qcApi.updateNce({ data }),
  addAction: (data) => window.qcApi.addNceAction({ data }),
  updateAction: (data) => window.qcApi.updateNceAction({ data }),
  completeAction: (data) => window.qcApi.completeNceAction({ data }),
  cancelAction: (data) => window.qcApi.cancelNceAction({ data }),
  recordTechnicalAssessment: (data) => window.qcApi.recordNceTechnicalAssessment({ data }),
  recordPatientImpact: (data) => window.qcApi.recordNcePatientImpact({ data }),
  release: (data) => window.qcApi.releaseNce({ data }),
  reviewEffectiveness: (data) => window.qcApi.reviewNceEffectiveness({ data }),
  submit: (data) => window.qcApi.submitNce({ data }),
  approve: (data) => window.qcApi.approveNce({ data }),
  returnForRevision: (data) => window.qcApi.returnNce({ data }),
  cancel: (data) => window.qcApi.cancelNce({ data }),
}));

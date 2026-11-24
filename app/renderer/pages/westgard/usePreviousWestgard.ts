import { useEffect, useMemo, useReducer, useState } from 'react';
import type { ArchivedBlock } from '../../../shared/qc-api';

const EMPTY_LEVELS: number[] = [];
const EMPTY_BLOCKS: ArchivedBlock[] = [];
type HistoryRequest = { testId: string; revision: number };

export function usePreviousWestgard(testId: string, active: boolean, requested: boolean) {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const [availability, setAvailability] = useState<{ request: HistoryRequest; levels: number[]; failed: boolean }>();
  const [history, setHistory] = useState<{ request: HistoryRequest; blocks: ArchivedBlock[]; failed: boolean }>();
  // Quay lại xét nghiệm sau khi xem xét nghiệm khác phải lấy lượt đọc mới,
  // vì thông báo cập nhật ở máy trạm khi đó chỉ theo xét nghiệm đang mở.
  const request = useMemo(() => ({ testId, revision }), [testId, revision]);

  useEffect(() => {
    if (!active || !testId || availability?.request === request) return;
    let live = true;
    window.qcApi.listPreviousLotLevels(testId).then(levels => {
      if (live) setAvailability({ request, levels, failed: false });
    }).catch(() => {
      if (live) setAvailability({ request, levels: [], failed: true });
    });
    return () => { live = false; };
  }, [testId, active, availability, request]);

  // Có thể chuyển xét nghiệm hoặc đóng lô cũ ngay khi máy chủ đang trả kết quả.
  // Chỉ dữ liệu của yêu cầu còn hiệu lực được dùng cho bảng và xuất báo cáo.
  useEffect(() => {
    if (!requested || !testId || history?.request === request) return;
    let live = true;
    window.qcApi.listPreviousLotBlocks(testId).then(blocks => {
      if (live) setHistory({ request, blocks, failed: false });
    }).catch(() => {
      if (live) setHistory({ request, blocks: [], failed: true });
    });
    return () => { live = false; };
  }, [testId, requested, history, request]);

  return {
    levels: availability?.request === request ? availability.levels : EMPTY_LEVELS,
    availabilityError: availability?.request === request && availability.failed,
    blocks: history?.request === request ? history.blocks : EMPTY_BLOCKS,
    loading: requested && history?.request !== request,
    error: requested && history?.request === request && history.failed,
    refresh,
  };
}

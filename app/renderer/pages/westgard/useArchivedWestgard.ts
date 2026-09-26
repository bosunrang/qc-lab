// Trạng thái và dữ liệu của tab "Nhóm lô đã dừng/lưu trữ" trên trang Phân
// tích Westgard: danh sách nhóm, ô tìm, xét nghiệm từng dùng nhóm đang chọn
// và các khối Westgard lịch sử. Tách khỏi `WestgardPage.tsx` ngày 2026-09-26
// (kế hoạch kiến trúc D.7).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import type { ArchivedBlock, Instrument, LotGroup, QcLot, Test } from '../../../shared/qc-api';

export function useArchivedWestgard({ active, lotGroups, lots, tests, instruments }: {
  /** Tab đang mở; tab đóng thì không nạp lại khi dữ liệu đổi. */
  active: boolean;
  lotGroups: LotGroup[];
  lots: QcLot[];
  tests: Test[];
  instruments: Instrument[];
}) {
  const [archivedGroupId, setArchivedGroupId] = useState('');
  const [archivedTestId, setArchivedTestId] = useState('');
  const [archivedQuery, setArchivedQuery] = useState('');
  const [archivedTests, setArchivedTests] = useState<{ id: string; label: string }[]>([]);
  const [archivedBlocks, setArchivedBlocks] = useState<ArchivedBlock[]>([]);
  const [archivedTestsLoading, setArchivedTestsLoading] = useState(false);
  const [archivedBlocksLoading, setArchivedBlocksLoading] = useState(false);
  const [archivedRefresh, setArchivedRefresh] = useState(0);
  const loadedArchivedGroupRef = useRef('');

  const archivedGroups = useMemo(
    () => lotGroups.filter((g) => g.active === 0 || g.status === 'stopped'),
    [lotGroups],
  );
  const archivedNeedle = archivedQuery.trim().toLocaleLowerCase('vi');
  // Tìm nhóm theo tên nhóm hoặc số lô. Nếu không khớp nhóm nào (ví dụ
  // người dùng đang tìm tên xét nghiệm), vẫn giữ toàn bộ danh sách để ô chọn
  // xét nghiệm tự xử lý phần lọc thay vì biến màn hình thành "không có dữ liệu".
  const archivedGroupOptions = useMemo(() => {
    if (!archivedNeedle) return archivedGroups;
    const matched = archivedGroups.filter((group) => [
      group.name,
      ...group.lotIds.map((id) => lots.find((lot) => lot.id === id)?.lot_no || ''),
    ].join(' ').toLocaleLowerCase('vi').includes(archivedNeedle));
    return matched.length ? matched : archivedGroups;
  }, [archivedGroups, archivedNeedle, lots]);

  // Cùng quy ước thứ tự với danh mục/Mean-SD: listTests() đã giữ thứ tự tạo
  // xét nghiệm (Na/K/Cl), còn IPC archived chỉ có nhiệm vụ lọc tập hợp hợp lệ.
  const archivedOrderedTests = useMemo(() => {
    const position = new Map(tests.map((test, index) => [test.id, index]));
    return [...archivedTests].sort((a, b) =>
      (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      || a.label.localeCompare(b.label, 'vi'),
    );
  }, [archivedTests, tests]);
  const archivedMatchedTests = useMemo(() => {
    if (!archivedNeedle) return archivedOrderedTests;
    return archivedOrderedTests.filter((item) => {
      const test = tests.find((candidate) => candidate.id === item.id);
      const instrument = test ? instruments.find((item) => item.id === test.instrument_id)?.name || '' : '';
      // Không dùng lô hiện hành ở đây vì tab này phải chỉ dựa vào lô lịch sử
      // của nhóm đang chọn.
      return `${item.label} ${instrument}`.toLocaleLowerCase('vi').includes(archivedNeedle);
    });
  }, [archivedNeedle, archivedOrderedTests, tests, instruments]);
  const archivedTestOptions = archivedMatchedTests.length ? archivedMatchedTests : archivedOrderedTests;
  const archivedGroup = archivedGroups.find((group) => group.id === archivedGroupId);
  const archivedStatusLabel = archivedGroup?.active === 0 ? 'Đã lưu trữ' : 'Đã dừng';

  // Tab lịch sử phải có một lựa chọn dùng được ngay khi mở.
  // Không ràng buộc theo chuỗi tìm kiếm rỗng để người dùng vẫn tự đổi nhóm.
  useEffect(() => {
    if (!active || !archivedGroupOptions.length) return;
    if (archivedGroupOptions.some((group) => group.id === archivedGroupId)) return;
    setArchivedGroupId(archivedGroupOptions[0].id);
  }, [active, archivedGroupId, archivedGroupOptions]);

  // Nhóm lô đã dừng/lưu trữ: nạp danh sách xét nghiệm THẬT SỰ có lô của
  // nhóm này (không phải mọi xét nghiệm trong hệ thống), rồi phân tích
  // Phân tích Westgard cho xét nghiệm và nhóm đang chọn.
  useEffect(() => {
    setArchivedBlocks([]);
    const groupChanged = loadedArchivedGroupRef.current !== archivedGroupId;
    loadedArchivedGroupRef.current = archivedGroupId;
    if (groupChanged) {
      setArchivedTests([]);
      setArchivedTestId('');
    }
    if (!archivedGroupId) { setArchivedTests([]); return; }
    let live = true;
    setArchivedTestsLoading(true);
    // Dữ liệu CHỈ ĐỌC của nhóm lô đã lưu trữ: không đổi trong lúc xem, và
    // có vòng đời gắn với lựa chọn trong tab này (kèm cờ huỷ) — giữ ở
    // component thay vì store.
    window.qcApi.listArchivedGroupTests(archivedGroupId).then((items) => {
      if (!live) return;
      setArchivedTests(items);
    }).catch(() => {
      if (live) setArchivedTests([]);
    }).finally(() => { if (live) setArchivedTestsLoading(false); });
    return () => { live = false; };
  }, [archivedGroupId, archivedRefresh]);
  // Khi đổi nhóm/lọc, giữ lựa chọn đang hợp lệ; nếu không còn phù hợp thì
  // chọn ngay xét nghiệm đầu tiên. Đây là điểm bản mới từng thiếu nên thẻ
  // lịch sử chỉ hiện hai combobox rỗng như ảnh người dùng gửi.
  useEffect(() => {
    if (!archivedOrderedTests.length) {
      if (archivedTestId) setArchivedTestId('');
      return;
    }
    const selectable = archivedMatchedTests.length ? archivedMatchedTests : archivedOrderedTests;
    if (!selectable.some((test) => test.id === archivedTestId)) setArchivedTestId(selectable[0].id);
  }, [archivedOrderedTests, archivedMatchedTests, archivedTestId]);
  useEffect(() => {
    if (!archivedGroupId || !archivedTestId) { setArchivedBlocks([]); return; }
    let live = true;
    setArchivedBlocksLoading(true);
    window.qcApi.listArchivedBlocks(archivedTestId, archivedGroupId).then((blocks) => {
      if (live) setArchivedBlocks(blocks);
    }).catch(() => {
      if (live) setArchivedBlocks([]);
    }).finally(() => { if (live) setArchivedBlocksLoading(false); });
    return () => { live = false; };
  }, [archivedGroupId, archivedTestId, archivedRefresh]);

  // Tab lưu trữ không dùng `analysisByLevel`, nên phải có nhịp nạp lại riêng
  // khi điểm QC, lô hoặc Mean/SD của xét nghiệm đang xem vừa thay đổi.
  useStoreInvalidation(['tests', 'test_levels', 'qc_points', 'qc_lots', 'lot_groups', 'actions', 'app_meta', 'qc_panels', 'qc_panel_tests', 'lot_transitions'], archivedTestId || undefined, () => {
    if (active && archivedGroupId) setArchivedRefresh((revision) => revision + 1);
  });

  const archivedDecimals = tests.find((t) => t.id === archivedTestId)?.decimal_places ?? 2;
  const archivedTestPickerLabel = (item: { id: string; label: string }) => {
    const instrumentName = tests.find((test) => test.id === item.id)?.instrument_id;
    const instrument = instruments.find((candidate) => candidate.id === instrumentName)?.name;
    return instrument ? `${item.label} · ${instrument}` : item.label;
  };

  return {
    archivedGroups, archivedGroupOptions, archivedGroupId, setArchivedGroupId,
    archivedQuery, setArchivedQuery,
    archivedTests, archivedOrderedTests, archivedMatchedTests, archivedTestOptions, archivedTestId, setArchivedTestId, archivedTestPickerLabel,
    archivedBlocks, archivedTestsLoading, archivedBlocksLoading, archivedStatusLabel, archivedDecimals,
  };
}

export type ArchivedWestgardState = ReturnType<typeof useArchivedWestgard>;

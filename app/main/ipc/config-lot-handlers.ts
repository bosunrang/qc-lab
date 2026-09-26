// Cấu hình chung — lô QC, nhóm lô (dừng, kích hoạt, Mean/SD dự kiến) và hồ
// sơ chuyển tiếp lô kèm cascade khi chấp nhận. Tách khỏi `config-handlers.ts`
// ngày 2026-09-26 (kế hoạch kiến trúc C.1); tách thuần, không đổi hành vi.
import type { Db } from '../db/sqlite-like';
// Kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung, không khai lại: trước
// 2026-09-10 các hàm này khai `IpcResult<unknown>` nên renderer tin vào
// một hình dạng mà không gì bảo đảm.
import type { LotGroup, LotTransition, PlannedTarget, QcLot } from '../../shared/qc-api';
import { cleanId, cleanText, uid, sameText } from '../domain/text-utils';
import { validateTestLevel, validateLot, validateLotGroup, validateLotTransition, type LotInput, type LotGroupInput, type LotTransitionInput, type PreparedLotTransition } from '../domain/manage-validation';
import { isPeriodLocked } from '../db/period-locks';
import { type IpcResult, nowIso } from './shared';
import { writeCommand } from './write-command';
import { ymOfDate } from '../domain/period-lock-validation';
import { isLotGroupInUse } from '../db/lot-groups';
import { activationCandidates, applyLotGroupActivation, replacedGroupsOf } from '../db/lot-activation';
import { applyLotTransitionCascade } from '../db/lot-transition';

export function createLotConfigHandlers(db: Db) {
  const lotGroupInUse = (lotIds: string[]): boolean => isLotGroupInUse(db, lotIds);

  // ── Mean/SD "Dự kiến" ────────────────────────────────────────────────────
  // Nhập sẵn Mean/SD cho lô của một nhóm lô CHƯA dùng, mức QC vẫn chạy lô cũ
  // như thường; tới lúc thật sự bắt đầu dùng thì bấm "Kích hoạt nhóm lô" ở
  // tab Lô & Nhóm QC, khi đó `activateLotGroup()` mới áp số này vào
  // `test_levels`. Khác "Lưu và chuyển lô" (đổi lô NGAY) và khác hồ sơ
  // Chuyển tiếp lô (có chạy song song + cổng chấp nhận, dành cho việc thay lô
  // đang vận hành): đây là đường chuẩn bị trước cho một nhóm lô mới tinh.
  function groupOfLot(lotId: string): string {
    return (db.prepare('SELECT group_id FROM qc_lots WHERE id=?').get(lotId) as { group_id: string | null } | undefined)?.group_id || '';
  }

  function listPlannedTargets(): PlannedTarget[] {
    return db.prepare('SELECT * FROM planned_targets ORDER BY test_id, level').all() as PlannedTarget[];
  }

  const savePlannedTargets = writeCommand(db, 'savePlannedTargets', 'admin', (
    w,
    input: { items?: { testId: unknown; level: unknown; qcLotId: unknown; mean: unknown; sd: unknown; low: unknown; high: unknown }[];
      remove?: { testId: unknown; level: unknown; qcLotId: unknown }[] },
  ): IpcResult<{ saved: number; removed: number }> => {
    const actor = w.actor;
    const items = Array.isArray(input.items) ? input.items : [];
    const remove = Array.isArray(input.remove) ? input.remove : [];
    if (!items.length && !remove.length) {
      return { ok: false, error: { code: 'empty', message: 'Chưa chọn xét nghiệm nào để lưu Mean/SD dự kiến.' } };
    }
    // Validate TOÀN BỘ trước khi ghi dòng nào: một hàng sai không được để lại
    // nửa số đã lưu, nửa chưa.
    const prepared: { id: string; testId: string; level: number; lotId: string; lotNo: string;
      mean: number; sd: number; low: number | null; high: number | null }[] = [];
    for (const item of items) {
      const testId = cleanId(item.testId);
      const test = db.prepare('SELECT id,name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
      if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
      const result = validateTestLevel({ level: item.level, mean: item.mean, sd: item.sd, low: item.low, high: item.high, qcLotId: item.qcLotId });
      if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
      const { level, mean, sd, low, high, qcLotId } = result.data;
      if (!qcLotId || mean == null || sd == null) {
        return { ok: false, error: { code: 'missing-target', message: 'Mean/SD dự kiến phải có đủ lô QC, Mean và SD.' } };
      }
      const lot = db.prepare('SELECT id, lot_no, level, depleted FROM qc_lots WHERE id=?').get(qcLotId) as
        { id: string; lot_no: string; level: number; depleted: number } | undefined;
      if (!lot) return { ok: false, error: { code: 'missing-lot', message: 'Không tìm thấy lô QC đã chọn.' } };
      if (lot.level !== level) {
        return { ok: false, error: { code: 'wrong-lot-level', message: `Lô QC đã chọn thuộc Mức ${lot.level}, không thể gán cho Mức ${level}.` } };
      }
      if (lot.depleted) return { ok: false, error: { code: 'depleted-lot', message: 'Lô QC đã hết dùng, không thể đặt Mean/SD dự kiến.' } };
      // Lô ĐANG DÙNG thì không có gì để "dự kiến" — lưu vào đây sẽ tạo hai
      // nguồn sự thật cho cùng một lô đang vận hành.
      const live = db.prepare('SELECT qc_lot_id FROM test_levels WHERE test_id=? AND level=?').get(testId, level) as { qc_lot_id: string | null } | undefined;
      if (live && live.qc_lot_id === qcLotId) {
        return { ok: false, error: { code: 'planned-current-lot', message: `"${test.name}" đang dùng chính lô ${lot.lot_no} ở Mức ${level} — hãy lưu thẳng Mean/SD thay vì đặt dự kiến.` } };
      }
      prepared.push({ id: `${testId}:${level}:${qcLotId}`, testId, level, lotId: qcLotId, lotNo: lot.lot_no, mean, sd, low, high });
    }

    const at = nowIso();
    const removedIds = remove
      .map((item) => ({ testId: cleanId(item.testId), level: Number(item.level), lotId: cleanId(item.qcLotId) }))
      .filter((key) => key.testId && key.lotId && Number.isFinite(key.level))
      .map((key) => `${key.testId}:${key.level}:${key.lotId}`);
    // Chỉ bỏ các mục không còn tồn tại và không lưu gì mới: không có gì để ghi.
    const present = removedIds.filter((id) => db.prepare('SELECT 1 FROM planned_targets WHERE id=?').get(id));
    if (!prepared.length && !present.length) return w.noChange({ saved: 0, removed: 0 });
    const removed = w.commit((tx) => {
      let count = 0;
      for (const id of removedIds) {
        count += db.prepare('DELETE FROM planned_targets WHERE id=?').run(id).changes ? 1 : 0;
      }
      for (const row of prepared) {
        db.prepare(`INSERT INTO planned_targets(id,test_id,level,qc_lot_id,mean,sd,low,high,saved_at,saved_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET mean=excluded.mean, sd=excluded.sd, low=excluded.low, high=excluded.high,
            saved_at=excluded.saved_at, saved_by=excluded.saved_by`)
          .run(row.id, row.testId, row.level, row.lotId, row.mean, row.sd, row.low, row.high, at, actor.username || actor.name || '');
      }
      for (const groupId of new Set(prepared.map((row) => groupOfLot(row.lotId)).filter(Boolean))) {
        const lotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(groupId) as { id: string }[]).map((r) => r.id);
        if (!lotGroupInUse(lotIds)) db.prepare("UPDATE lot_groups SET status='planned', stopped_at='' WHERE id=?").run(groupId);
      }
      const lotNos = [...new Set(prepared.map((row) => row.lotNo))].join(', ');
      tx.audit('Lưu Mean/SD dự kiến',
        `${prepared.length} mức QC${lotNos ? ` cho lô ${lotNos}` : ''}${count ? `, bỏ ${count} mục dự kiến` : ''} — chưa áp vào cấu hình đang chạy`,
        'Mean/SD dự kiến');
      tx.changed(['planned_targets', 'lot_groups'], [...new Set(prepared.map((row) => row.testId))]);
      return count;
    });
    return { ok: true, data: { saved: prepared.length, removed } };
  });

  // ---- Lô QC ("Lô & nhóm lô QC") ----
  function listLots() {
    return db.prepare('SELECT * FROM qc_lots ORDER BY lot_no').all();
  }

  /** Kế hoạch đổi số lô: ĐẾM điểm QC sẽ bị viết lại + soi kỳ đã khoá, KHÔNG
   * ghi gì. Điểm QC lưu số lô dạng CHUỖI TĨNH chụp lúc nhập (`qc_points.lot`,
   * xem `entry-handlers.ts`), không tham chiếu `qc_lots.id` —
   * nên đổi `lot_no` mà không cập nhật lại điểm cũ sẽ khiến chúng "biến mất"
   * khỏi mọi bộ lọc theo lô (Nhập QC/Westgard/Sigma): không khớp lô hiện tại
   * (chuỗi đã đổi) mà cũng không hiện ở "lô cũ" (không có hồ sơ chuyển tiếp
   * nào giữa 2 TÊN GỌI của cùng một lô). Đây là VIẾT LẠI HÀNG LOẠT bản ghi
   * lịch sử, nên người dùng phải thấy con số TRƯỚC khi làm. */
  function previewLotRename(input: { id: string; lotNo: unknown }): IpcResult<
    { rename: null } | { rename: { oldLotNo: string; newLotNo: string; affected: number; lockedCount: number; lockedPeriods: string[] } }
  > {
    const existing = db.prepare('SELECT lot_no, level FROM qc_lots WHERE id=?').get(input.id) as
      { lot_no: string; level: number } | undefined;
    if (!existing) return { ok: true, data: { rename: null } };
    const newLotNo = cleanText(input.lotNo, 120).trim();
    if (!newLotNo || newLotNo === existing.lot_no) return { ok: true, data: { rename: null } };
    // Quét MỌI xét nghiệm: một lô có thể dùng chung qua Panel QC, và có thể
    // còn nằm trong lịch sử của xét nghiệm giờ đã gắn lô khác.
    const rows = db.prepare('SELECT date FROM qc_points WHERE level=? AND lot=?')
      .all(existing.level, existing.lot_no) as { date: string }[];
    const lockedPeriods = [...new Set(rows.map(row => ymOfDate(row.date)))].filter(ym => isPeriodLocked(db, ym)).sort();
    const lockedCount = rows.filter(row => lockedPeriods.includes(ymOfDate(row.date))).length;
    return { ok: true, data: { rename: { oldLotNo: existing.lot_no, newLotNo, affected: rows.length, lockedCount, lockedPeriods } } };
  }

  const saveLot = writeCommand(db, 'saveLot', 'admin', (w, input: { id?: string; data: LotInput }): IpcResult<QcLot> => {
    const id = input.id || '';
    const result = validateLot(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { groupId, lotNo, level, description, supplier, program, exp, opened, active, depleted, note } = result.data;
    let before: { lot_no: string; level: number; group_id: string | null } | undefined;
    if (id) {
      before = db.prepare('SELECT lot_no, level, group_id FROM qc_lots WHERE id=?').get(id) as { lot_no: string; level: number; group_id: string | null } | undefined;
      if (!before) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy lô QC cần cập nhật.' } };
      // Đổi mức của lô đang gán Mean/SD cho xét nghiệm — chặn TRƯỚC cổng
      // trùng số lô để người dùng nhận đúng hướng dẫn gỡ liên kết trước.
      if (before.level !== level && db.prepare('SELECT 1 FROM test_levels WHERE qc_lot_id=? LIMIT 1').get(id)) {
        return { ok: false, error: { code: 'level-in-use', message: 'Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô trong Mean/SD trước.' } };
      }
    }
    const sameLevelLots = db.prepare('SELECT id, lot_no FROM qc_lots WHERE level=?').all(level) as { id: string; lot_no: string }[];
    if (sameLevelLots.some(row => row.id !== id && sameText(row.lot_no, lotNo))) {
      return { ok: false, error: { code: 'duplicate-lot', message: 'Số lô QC này đã tồn tại ở cùng mức QC.' } };
    }
    if (id) {
      // Đổi số lô thì ghi lại nhãn lô trên MỌI điểm QC cũ của lô đó, trong
      // CÙNG transaction với việc sửa cấu hình — nửa vời (đổi cấu hình mà
      // không đổi điểm, hoặc ngược lại) là trạng thái không thể tự phục hồi.
      const renaming = !!before?.lot_no && before.lot_no !== lotNo;
      let renamed = 0;
      w.commit((tx) => {
        // KHÔNG gửi `groupId` nghĩa là "giữ nguyên nhóm", không phải "gỡ khỏi
        // nhóm" — cùng ngữ nghĩa `prepareLabProfile(existing)` dùng cho logo.
        // Form "Sửa lô QC" không có ô chọn nhóm (membership do modal Nhóm lô
        // QC quản lý), nên nó không gửi trường này; trước bản sửa, mỗi lần
        // sửa một lô là `group_id` bị ghi NULL và lô LẶNG LẼ rơi khỏi nhóm.
        // Hậu quả không dừng ở thẻ nhóm lô thiếu một lô: mức QC gắn lô đó lập
        // tức hết "đang vận hành", nên biến mất khỏi Tổng quan/Westgard và
        // ngừng được đánh giá ở Nhập QC. Đo được: nhóm 2 lô còn 1 lô sau khi
        // chỉ sửa mỗi ô Nhà cung cấp.
        db.prepare(`UPDATE qc_lots SET group_id=?,lot_no=?,level=?,description=?,supplier=?,program=?,exp=?,opened=?,active=?,depleted=?,note=? WHERE id=?`)
          .run(groupId || before?.group_id || null, lotNo, level, description, supplier, program, exp, opened, active ? 1 : 0, depleted ? 1 : 0, note, id);
        if (renaming) {
          renamed = Number(db.prepare('UPDATE qc_points SET lot=? WHERE level=? AND lot=?')
            .run(lotNo, before!.level, before!.lot_no).changes || 0);
        }
        tx.audit('Sửa lô QC',
          renaming ? `Đổi số lô "${before!.lot_no}" → "${lotNo}" mức ${level}, cập nhật ${renamed} điểm QC`
            : `Cập nhật lô "${lotNo}" mức ${level}`, lotNo);
        tx.changed(renaming ? ['qc_lots', 'qc_points'] : ['qc_lots']);
      });
      return { ok: true, data: db.prepare('SELECT * FROM qc_lots WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    const savedLot = w.commit((tx) => {
      db.prepare(`INSERT INTO qc_lots(id,group_id,lot_no,level,description,supplier,program,exp,opened,active,depleted,note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(newId, groupId || null, lotNo, level, description, supplier, program, exp, opened, active ? 1 : 0, depleted ? 1 : 0, note);
      tx.audit('Thêm lô QC', `Tạo lô "${lotNo}" mức ${level}`, lotNo);
      tx.changed(['qc_lots']);
      return db.prepare('SELECT * FROM qc_lots WHERE id=?').get(newId);
    });
    return { ok: true, data: savedLot };
  });

  // ---- Nhóm lô QC ----

  function listLotGroups() {
    const groups = db.prepare('SELECT * FROM lot_groups ORDER BY name').all() as (Omit<LotGroup, 'lotIds' | 'inUse'> & { archived_lot_ids_json: string })[];
    return groups.map(g => {
      const liveLotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(g.id) as { id: string }[]).map(r => r.id);
      // Nhóm "Đã lưu trữ" hiện lotIds từ ẢNH CHỤP đã chốt lúc lưu trữ (giữ
      // NGUYÊN mọi thành viên cũ, kể cả lô không hề chuyển tiếp — xem
      // schema.ts's comment ở cột `archived_lot_ids_json`), không phải từ
      // group_id SỐNG của qc_lots — lô không chuyển tiếp đã thật sự đổi
      // sang group_id của nhóm ĐANG hoạt động rồi, live-derive sẽ chỉ còn
      // đúng 1 lô dù tên nhóm vẫn ngụ ý đủ 2+.
      let lotIds = liveLotIds;
      if (g.archived_lot_ids_json) {
        try {
          const parsed = JSON.parse(g.archived_lot_ids_json);
          if (Array.isArray(parsed)) lotIds = parsed;
        } catch { /* JSON hỏng thì rơi về danh sách sống */ }
      }
      return { ...g, lotIds, inUse: lotGroupInUse(liveLotIds) };
    });
  }

  const saveLotGroup = writeCommand(db, 'saveLotGroup', 'admin', (w, input: { id?: string; data: LotGroupInput }): IpcResult<LotGroup> => {
    const id = input.id || '';
    const lotRows = db.prepare('SELECT id, lot_no FROM qc_lots').all() as { id: string; lot_no: string }[];
    const lotNoById = new Map(lotRows.map(row => [row.id, row.lot_no]));
    const requestedLotIds = Array.isArray(input.data.lotIds)
      ? [...new Set(input.data.lotIds.map(cleanId).filter(Boolean))]
      : [];
    // Tên trống tự ghép từ số lô theo đúng thứ tự người dùng chọn, ví dụ
    // 1101/1102.
    const fallbackName = requestedLotIds.map(lotId => lotNoById.get(lotId)).filter(Boolean).join('/');
    const result = validateLotGroup(input.data, fallbackName);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, manufacturer, material, catalog, note, active, status, lotIds } = result.data;
    const knownLots = new Set(lotRows.map(r => r.id));
    const validLotIds = lotIds.filter(l => knownLots.has(l));
    if (validLotIds.length < 2) return { ok: false, error: { code: 'not-enough-lots', message: 'Nhóm lô QC cần ít nhất 2 lô hợp lệ.' } };
    const otherGroups = (db.prepare('SELECT id, name FROM lot_groups WHERE id!=?').all(id || '') as { id: string; name: string }[]);
    const validLotIdSet = new Set(validLotIds);
    const sameLotSet = (otherId: string) => {
      const otherLotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(otherId) as { id: string }[]).map(r => r.id);
      return otherLotIds.length === validLotIdSet.size && otherLotIds.every(l => validLotIdSet.has(l));
    };
    if (otherGroups.some(group => sameText(group.name, name) || sameLotSet(group.id))) {
      return { ok: false, error: { code: 'duplicate-group', message: 'Nhóm lô này đã tồn tại hoặc trùng danh sách lô.' } };
    }
    let groupId = id;
    if (id && !db.prepare('SELECT id FROM lot_groups WHERE id=?').get(id)) {
      return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô cần cập nhật.' } };
    }
    if (!id) groupId = cleanId(uid());
    // Hàng nhóm và việc gỡ/gán lại TẤT CẢ lô là một lần lưu nghiệp vụ. Nếu
    // lỗi ở giữa, rollback nguyên khối để không còn nhóm có danh sách thành
    // viên dở dang hoặc lô bị gỡ khỏi nhóm cũ mà chưa vào nhóm mới.
    try {
      w.commit((tx) => {
        if (id) {
          db.prepare('UPDATE lot_groups SET name=?,manufacturer=?,material=?,catalog=?,note=?,active=?,status=? WHERE id=?')
            .run(name, manufacturer, material, catalog, note, active ? 1 : 0, status, id);
        } else {
          db.prepare('INSERT INTO lot_groups(id,name,manufacturer,material,catalog,note,active,status) VALUES (?,?,?,?,?,?,?,?)')
            .run(groupId, name, manufacturer, material, catalog, note, active ? 1 : 0, status);
        }
        // Gỡ các lô KHÔNG còn thuộc nhóm này nữa, rồi gán lại đúng danh sách mới —
        // 1 lô chỉ thuộc 1 nhóm tại 1 thời điểm (qc_lots.group_id, không phải bảng
        // junction nhiều-nhiều).
        db.prepare('UPDATE qc_lots SET group_id=NULL WHERE group_id=?').run(groupId);
        for (const lotId of validLotIds) db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(groupId, lotId);
        tx.audit(id ? 'Sửa nhóm lô QC' : 'Thêm nhóm lô QC', `Nhóm "${name}" (${validLotIds.length} lô)`, name);
        tx.changed(['lot_groups', 'qc_lots']);
      });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Lưu nhóm lô QC thất bại.' } };
    }
    // Ép về đúng kiểu hợp đồng thay vì `as object`: spread một `object` cho ra
    // `{}` nên TypeScript không còn thấy field nào, và hợp đồng
    // `IpcResult<LotGroup>` trở thành vô nghĩa.
    const groupRow = db.prepare('SELECT * FROM lot_groups WHERE id=?').get(groupId) as Omit<LotGroup, 'lotIds' | 'inUse'>;
    return { ok: true, data: { ...groupRow, lotIds: validLotIds, inUse: lotGroupInUse(validLotIds) } };
  });

  // ---- Chuyển tiếp lô ----
  function listLotTransitions() {
    return db.prepare('SELECT * FROM lot_transitions ORDER BY start_date DESC').all();
  }

  const LOT_TRANSITION_STATUS_TEXT: Record<string, string> = {
    planned: 'Dự kiến', active: 'Đang chạy song song', accepted: 'Chấp nhận lô mới', rejected: 'Không chấp nhận',
  };


  const createLotTransition = writeCommand(db, 'createLotTransition', 'admin', (w, input: { id?: string; data: LotTransitionInput & { criteria?: { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[] } }): IpcResult<LotTransition> => {
    const actor = w.actor;
    const result = validateLotTransition(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { panelId, fromLotId, toLotId, startDate, note } = result.data;
    const panel = db.prepare('SELECT id, name FROM qc_panels WHERE id=?').get(panelId) as { id: string; name: string } | undefined;
    if (!panel) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy Panel QC.' } };
    const fromLot = db.prepare('SELECT id, lot_no, level, group_id, opened, exp FROM qc_lots WHERE id=?').get(fromLotId) as { id: string; lot_no: string; level: number; group_id: string | null; opened: string; exp: string } | undefined;
    const toLot = db.prepare('SELECT id, lot_no, level, opened, exp FROM qc_lots WHERE id=?').get(toLotId) as { id: string; lot_no: string; level: number; opened: string; exp: string } | undefined;
    if (!fromLot || !toLot) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy lô QC đã chọn.' } };
    if (fromLot.level !== toLot.level) return { ok: false, error: { code: 'different-levels', message: 'Lô cũ và lô mới phải cùng mức QC để chuyển tiếp.' } };

    const existing = input.id ? db.prepare('SELECT * FROM lot_transitions WHERE id=?').get(input.id) as
      { id: string; status: string; approved_at: string; approved_by: string } | undefined : undefined;
    if (input.id && !existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ chuyển lô.' } };
    // `status` thiếu (không phải chuỗi) khi SỬA thì giữ nguyên trạng thái cũ
    // (không âm thầm lùi về 'planned') — modal thật luôn gửi kèm giá trị
    // <select> hiện tại nên trường hợp này chỉ xảy ra với caller lập trình
    // quên truyền, an toàn hơn là coi đó là ý định lùi trạng thái.
    const status = typeof input.data.status === 'string' && input.data.status
      ? result.data.status
      : existing ? (existing.status as PreparedLotTransition['status']) : 'planned';
    if (existing && existing.status === 'accepted' && status !== 'accepted') {
      return { ok: false, error: { code: 'accepted-immutable', message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không thể đổi ngược trạng thái.' } };
    }
    const dup = db.prepare('SELECT id FROM lot_transitions WHERE panel_id=? AND from_lot_id=? AND to_lot_id=? AND id!=?')
      .get(panelId, fromLotId, toLotId, input.id || '');
    if (dup) return { ok: false, error: { code: 'duplicate-transition', message: 'Chuyển tiếp lô này đã tồn tại.' } };

    const finalChanged = (status === 'accepted' || status === 'rejected') && (!existing || existing.status !== status);
    const criteria = input.data.criteria || [];

    if (status === 'accepted' && finalChanged) {
      const panelTests = db.prepare(`SELECT t.id, t.name FROM tests t
        JOIN qc_panel_tests pt ON pt.test_id=t.id WHERE pt.panel_id=?
        ORDER BY pt.position, pt.rowid`).all(panelId) as { id: string; name: string }[];
      const rows = panelTests
        .map((t) => ({ t, level: db.prepare('SELECT level FROM test_levels WHERE test_id=? AND qc_lot_id=?').get(t.id, fromLotId) as { level: number } | undefined }))
        .filter((row) => row.level);
      if (!rows.length) return { ok: false, error: { code: 'no-target-tests', message: 'Panel đã chọn không có xét nghiệm nào đang sử dụng lô cũ. Hãy kiểm tra lại Panel và lô chuyển tiếp.' } };
      // Mean có thể bằng 0 hoặc âm (ví dụ Base excess); chỉ SD bắt buộc >0.
      // Mean chỉ cần là số hữu hạn (`Number.isFinite`), không kiểm
      // `mean > 0`. Điều kiện cũ làm hồ sơ hợp lệ không thể được chấp nhận.
      const missing = rows.filter((row) => !criteria.some((c) => c.testId === row.t.id
        && c.level === row.level!.level && Number.isFinite(Number(c.mean))
        && Number.isFinite(Number(c.sd)) && Number(c.sd) > 0));
      if (missing.length) {
        return { ok: false, error: { code: 'missing-target', message: `Chưa thể chấp nhận lô mới: ${missing.map((row) => row.t.name).join(', ')} chưa có Mean/SD hợp lệ cho lô ${toLot.lot_no}. Hãy điền đủ ở bảng Mean/SD phía trên rồi lưu lại.` } };
      }
    }

    const at = nowIso();
    const criteriaJson = JSON.stringify(criteria);

    const approvedAt = finalChanged ? at : existing?.approved_at || '';
    const approvedBy = finalChanged ? actor.username : existing?.approved_by || '';

    // Hồ sơ, cascade chuyển lô và HAI dòng nhật ký là một đơn vị. Trước đây
    // nhật ký ghi sau COMMIT: lỗi ở bước đó để lại chuyển lô đã áp dụng mà
    // không có dấu vết, rồi ROLLBACK chạy khi không còn transaction.
    const cascade = status === 'accepted' && finalChanged;
    const id = w.commit((tx) => {
      let savedId = input.id || '';
      if (existing) {
        db.prepare('UPDATE lot_transitions SET panel_id=?, from_lot_id=?, to_lot_id=?, start_date=?, status=?, note=?, criteria_json=?, approved_at=?, approved_by=? WHERE id=?')
          .run(panelId, fromLotId, toLotId, startDate, status, note, criteriaJson, approvedAt, approvedBy, savedId);
      } else {
        savedId = cleanId(uid());
        db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,start_date,status,note,criteria_json,approved_at,approved_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(savedId, panelId, fromLotId, toLotId, startDate, status, note, criteriaJson, approvedAt, approvedBy);
      }
      if (cascade) applyLotTransitionCascade(db, { fromLot, toLot, startDate, criteria, at });
      const detail = `${panel.name}: ${fromLot.lot_no} → ${toLot.lot_no} · ${LOT_TRANSITION_STATUS_TEXT[status]}`;
      tx.audit(existing ? 'Sửa hồ sơ chuyển lô' : 'Thêm hồ sơ chuyển lô', detail, panel.name);
      if (cascade) tx.audit('Áp dụng chuyển tiếp lô', `${panel.name} · ${fromLot.lot_no} → ${toLot.lot_no} · ${criteria.length} xét nghiệm`, panel.name);
      tx.changed(cascade ? ['lot_transitions', 'qc_lots', 'lot_groups', 'test_levels', 'tests'] : ['lot_transitions']);
      return savedId;
    });
    return { ok: true, data: db.prepare('SELECT * FROM lot_transitions WHERE id=?').get(id) };
  });

  /** Chặn xoá lô đang được gán Mean/SD cho một mức QC, hoặc lô đã đi qua một
   * hồ sơ chuyển tiếp ĐÃ KẾT LUẬN (`accepted`, tức đã áp vào cấu hình/Mean-SD)
   * — xoá thẳng sẽ để lại mức QC trỏ vào lô không còn tồn tại. Xoá được thì dọn luôn các hồ sơ chuyển lô còn dở dang trỏ tới nó. */
  const removeLot = writeCommand(db, 'removeLot', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, lot_no FROM qc_lots WHERE id=?').get(id) as { id: string; lot_no: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy lô QC.' } };
    const usedByLevel = (db.prepare('SELECT COUNT(*) as c FROM test_levels WHERE qc_lot_id=?').get(id) as { c: number }).c;
    if (usedByLevel) {
      return { ok: false, error: { code: 'used-by-assay', message: 'Lô QC này đang được gắn với xét nghiệm. Hãy đổi lô trong xét nghiệm trước.' } };
    }
    const accepted = (db.prepare("SELECT COUNT(*) as c FROM lot_transitions WHERE (from_lot_id=? OR to_lot_id=?) AND status='accepted'").get(id, id) as { c: number }).c;
    if (accepted) {
      return { ok: false, error: { code: 'used-by-accepted-transition', message: 'Lô QC này có hồ sơ chuyển tiếp đã kết luận (đã áp vào cấu hình/Mean-SD). Không thể xoá lô trực tiếp — nếu thực sự cần, hãy xử lý hồ sơ chuyển tiếp đó trước.' } };
    }
    try {
      w.commit((tx) => {
        db.prepare('DELETE FROM lot_transitions WHERE from_lot_id=? OR to_lot_id=?').run(id, id);
        db.prepare('DELETE FROM qc_lots WHERE id=?').run(id);
        tx.audit('Xoá lô QC', `Xoá lô "${existing.lot_no}"`, existing.lot_no);
        tx.changed(['qc_lots', 'lot_groups', 'lot_transitions']);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá lô QC thất bại.' } };
    }
    return { ok: true, data: { id } };
  });

  /** Xoá NHÓM lô nhưng GIỮ NGUYÊN các lô bên trong (chỉ gỡ `group_id`) —
   * đúng như hộp xác nhận báo: "Các lô QC bên trong vẫn được giữ nguyên." */
  const removeLotGroup = writeCommand(db, 'removeLotGroup', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM lot_groups WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const usedByLevel = (db.prepare('SELECT COUNT(*) as c FROM test_levels WHERE qc_lot_id IN (SELECT id FROM qc_lots WHERE group_id=?)').get(id) as { c: number }).c;
    if (usedByLevel) {
      return { ok: false, error: { code: 'used-by-assay', message: 'Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xoá nhóm.' } };
    }
    try {
      w.commit((tx) => {
        db.prepare('UPDATE qc_lots SET group_id=NULL WHERE group_id=?').run(id);
        db.prepare('DELETE FROM lot_groups WHERE id=?').run(id);
        tx.audit('Xoá nhóm lô QC', `Xoá nhóm "${existing.name}" (các lô bên trong được giữ lại)`, existing.name);
        tx.changed(['qc_lots', 'lot_groups']);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá nhóm lô thất bại.' } };
    }
    return { ok: true, data: { id } };
  });

  /** Dừng một nhóm lô đang chạy. CHỈ đổi trạng thái; chiều ngược lại nằm ở
   * `activateLotGroup()` bên dưới và áp lại Mean/SD đã lưu của nhóm. */
  const stopLotGroup = writeCommand(db, 'stopLotGroup', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name, status FROM lot_groups WHERE id=?').get(id) as { id: string; name: string; status: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const lotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(id) as { id: string }[]).map(r => r.id);
    if (existing.status === 'stopped' || existing.status === 'planned' || !lotGroupInUse(lotIds)) {
      return { ok: false, error: { code: 'not-stoppable', message: 'Chỉ dừng được nhóm lô đang chạy.' } };
    }
    w.commit((tx) => {
      db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(nowIso(), id);
      tx.audit('Dừng nhóm lô QC', `Dừng nhóm "${existing.name}"`, existing.name);
      tx.changed(['lot_groups']);
    });
    return { ok: true, data: { id } };
  });


  const activateLotGroup = writeCommand(db, 'activateLotGroup', 'admin', (w, input: { id: unknown }): IpcResult<{ status: 'applied' | 'already-active' | 'unready'; applied: number; stoppedGroups: string[] }> => {
    const id = String(input.id || '');
    const group = db.prepare('SELECT id, name FROM lot_groups WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!group) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const lots = db.prepare('SELECT id, lot_no, level, opened FROM qc_lots WHERE group_id=?').all(id) as
      { id: string; lot_no: string; level: number; opened: string }[];
    if (!lots.length) return { ok: false, error: { code: 'empty-group', message: 'Nhóm lô này chưa có lô QC nào.' } };

    const candidates = activationCandidates(db, lots);

    if (!candidates.length) {
      // Không có gì mới để áp: nếu nhóm đang thực sự được dùng (có mức nào
      // trỏ vào lô của nó) thì chỉ cần gỡ nhãn "đã dừng".
      if (!lotGroupInUse(lots.map(lot => lot.id))) {
        return { ok: false, error: { code: 'unready', message: 'Chưa mức QC nào có Mean/SD đã lưu cho lô của nhóm này. Hãy nhập Mean/SD cho lô mới trước khi kích hoạt.' } };
      }
      w.commit((tx) => {
        db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=?").run(id);
        tx.audit('Kích hoạt nhóm lô QC', `Nhóm "${group.name}" đã đang được dùng, không có mức nào cần áp thêm`, group.name);
        tx.changed(['lot_groups']);
      });
      return { ok: true, data: { status: 'already-active', applied: 0, stoppedGroups: [] } };
    }

    // Nhóm lô nào đang giữ các mức bị thay thế thì bị DỪNG — nhưng chỉ khi
    // nó KHÔNG CÒN mức QC nào dùng nữa (kiểm lại SAU khi đã áp, bên trong
    // transaction). Dừng ngay mà không kiểm thì: nếu chỉ một phần xét nghiệm
    // có Mean/SD cho lô mới thì nhóm cũ vẫn bị gắn "Đã dừng" trong khi những
    // xét nghiệm ở lại vẫn dùng lô của nó — mà nhóm `stopped` bị loại khỏi
    // "mức QC đang vận hành", nên các xét nghiệm đó BIẾN MẤT khỏi thẻ Nhập QC
    // và Westgard (dựng lại được: 3 xét nghiệm dùng nhóm A, chỉ 1 có số cho
    // nhóm B, kích hoạt B → 2 xét nghiệm còn lại mất sạch mức QC).
    const replacedGroupIds = replacedGroupsOf(db, candidates, id);
    const at = nowIso();
    const stoppedIds = w.commit((tx) => {
      const stopped = applyLotGroupActivation(db, { groupId: id, lots, candidates, replacedGroupIds, at });
      tx.audit('Kích hoạt nhóm lô QC',
        `Nhóm "${group.name}": áp Mean/SD cho ${candidates.length} mức QC`
        + (stopped.size ? `, dừng ${stopped.size} nhóm lô bị thay thế` : ''), group.name);
      tx.changed(['lot_groups', 'qc_lots', 'test_levels', 'tests', 'planned_targets']);
      return stopped;
    });
    return { ok: true, data: { status: 'applied', applied: candidates.length, stoppedGroups: [...stoppedIds] } };
  });

  /** Xoá hồ sơ chuyển lô. Hồ sơ ĐÃ KẾT LUẬN không xoá được: kết luận là bản
   * ghi đã áp vào cấu hình, xoá đi thì mất dấu vết vì sao Mean/SD đổi. */

  function lotLabel(lotId: string): string {
    const lot = db.prepare('SELECT lot_no, level FROM qc_lots WHERE id=?').get(lotId) as { lot_no: string; level: number } | undefined;
    return lot ? `${lot.lot_no} · Mức ${lot.level}` : 'Chưa chọn lô';
  }

  const removeLotTransition = writeCommand(db, 'removeLotTransition', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, status, from_lot_id, to_lot_id FROM lot_transitions WHERE id=?').get(id) as
      { id: string; status: string; from_lot_id: string; to_lot_id: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ chuyển lô.' } };
    if (existing.status === 'accepted') {
      return { ok: false, error: { code: 'accepted-applied', message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công.' } };
    }
    const detail = `${lotLabel(existing.from_lot_id)} → ${lotLabel(existing.to_lot_id)}`;
    w.commit((tx) => {
      db.prepare('DELETE FROM lot_transitions WHERE id=?').run(id);
      tx.audit('Xoá hồ sơ chuyển lô', detail, 'Chuyển tiếp lô');
      tx.changed(['lot_transitions']);
    });
    return { ok: true, data: { id } };
  });

  return { listPlannedTargets, savePlannedTargets, listLots, previewLotRename, saveLot, listLotGroups, saveLotGroup, listLotTransitions, createLotTransition, removeLot, removeLotGroup, stopLotGroup, activateLotGroup, removeLotTransition };
}

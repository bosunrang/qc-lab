// IPC handler cho module thí điểm "Cấu hình chung": máy xét nghiệm, xét
// nghiệm, mức QC. Renderer KHÔNG bao giờ chạm SQLite trực tiếp — chỉ gọi các
// hàm named ở đây qua preload/ipcMain. Mỗi thao tác ghi chạy trong 1
// transaction + ghi 1 dòng audit.
import type { Db } from '../db/sqlite-like';
// Kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung, không khai lại: trước
// 2026-09-10 các hàm này khai `IpcResult<unknown>` nên renderer tin vào
// một hình dạng mà không gì bảo đảm.
import type { Instrument, LotGroup, LotTransition, PlannedTarget, QcLot, QcPanel, TeaRef, Test, TestLevel } from '../../shared/qc-api';

import { cleanId, cleanText, uid, sameText } from '../domain/text-utils';
import {
  validateInstrument, validateTest, validateTestLevel, appendMeanSdHistory,
  validateLot, validateLotGroup, validatePanel, validateLotTransition,
  type InstrumentInput, type TestInput, type PreparedTest, type TestLevelInput,
  type LotInput, type LotGroupInput, type PanelInput, type LotTransitionInput, type PreparedLotTransition,
} from '../domain/manage-validation';
import { validateTeaRef, TEA_LAB_SOURCE_LABELS, type TeaRefInput } from '../domain/tea-ref-validation';
import { parseRuleScopes, serializeRuleScopes, parseRuleActions, effectiveRuleConfigList, type RuleScopesMap } from '../domain/rule-config';
import { WG_RULE_REGISTRY, isAllowedRuleScope, type RuleScope } from '../domain/westgard-rules';
import { readGlobalRules } from '../db/rule-settings';
import { countOperationalLevels, listOperationalLevels } from '../db/operational-levels';
import { isPeriodLocked } from '../db/period-locks';
import { isoLocalDate } from '../domain/local-date';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireAdmin, withTransaction } from './shared';
import { ymOfDate } from '../domain/period-lock-validation';

export function createConfigHandlers(db: Db) {
  const inTransaction = <T>(work: () => T): T => withTransaction(db, work);

  function listInstruments() {
    return db.prepare('SELECT * FROM instruments ORDER BY name').all();
  }

  function saveInstrument(input: { id?: string; data: InstrumentInput }, actor: Actor): IpcResult<Instrument> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const existingNames = (db.prepare('SELECT name FROM instruments WHERE id != ?').all(id) as { name: string }[]).map(r => r.name);
    const result = validateInstrument(input.data, existingNames);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, manufacturer, model, serial, section, active } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id FROM instruments WHERE id=?').get(id);
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm cần cập nhật.' } };
      const saved = inTransaction(() => {
        db.prepare('UPDATE instruments SET name=?,manufacturer=?,model=?,serial=?,section=?,active=? WHERE id=?')
          .run(name, manufacturer, model, serial, section, active ? 1 : 0, id);
        writeAudit(db, actor, 'Sửa máy xét nghiệm', `Cập nhật máy "${name}"`, name);
        return db.prepare('SELECT * FROM instruments WHERE id=?').get(id);
      });
      notifyChanged(['instruments']);
      return { ok: true, data: saved };
    }
    const newId = cleanId(uid());
    const saved = inTransaction(() => {
      db.prepare('INSERT INTO instruments(id,name,manufacturer,model,serial,section,active) VALUES (?,?,?,?,?,?,?)')
        .run(newId, name, manufacturer, model, serial, section, active ? 1 : 0);
      writeAudit(db, actor, 'Thêm máy xét nghiệm', `Tạo máy "${name}"`, name);
      return db.prepare('SELECT * FROM instruments WHERE id=?').get(newId);
    });
    notifyChanged(['instruments']);
    return { ok: true, data: saved };
  }

  function removeInstrument(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM instruments WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm.' } };
    const testCount = (db.prepare('SELECT COUNT(*) AS n FROM tests WHERE instrument_id=?').get(id) as { n: number }).n;
    if (testCount > 0) return { ok: false, error: { code: 'in-use', message: `Không thể xoá — máy này đang gắn với ${testCount} xét nghiệm. Xoá/chuyển các xét nghiệm đó trước.` } };
    const panelCount = (db.prepare('SELECT COUNT(*) AS n FROM qc_panels WHERE instrument_id=?').get(id) as { n: number }).n;
    if (panelCount > 0) return { ok: false, error: { code: 'in-use', message: `Không thể xoá — máy này đang gắn với ${panelCount} Panel QC. Xoá/chuyển các Panel QC đó trước.` } };
    inTransaction(() => {
      db.prepare('DELETE FROM instruments WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá máy xét nghiệm', `Xoá "${existing.name}"`, existing.name);
    });
    notifyChanged(['instruments']);
    return { ok: true, data: { id } };
  }

  // hệ thống KHÔNG sắp xếp `state.tests` ở đâu cả (`manageAssaysModel()`/
  // `PanelModal.tsx`'s `allTests` chỉ `.filter()`/`.map()` thẳng lên mảng) —
  // thứ tự hiển thị (danh mục xét nghiệm, danh sách chọn trong Panel QC...)
  // LÀ thứ tự tạo (xét nghiệm thêm trước nằm trước). `ORDER BY name` trước
  // đây tự sắp lại theo alphabet, sai với hành vi hệ thống. `rowid` (ngầm định
  // của SQLite cho bảng có PK dạng TEXT) chính là thứ tự chèn.
  function listTests() {
    return db.prepare('SELECT * FROM tests ORDER BY rowid').all();
  }

  /** Form danh mục mới cho phép gán một analyte vào nhiều máy. Mỗi máy vẫn
   * là một hàng `tests` riêng để Mean/SD, lô, điểm QC và Westgard không bị
   * trộn; `analyte_id` chỉ gom các hàng đó thành một mục ở giao diện. */
  function saveTestAssignments(input: { id?: string; data: TestInput }, actor: Actor): IpcResult<Test> {
    const instrumentIds = [...new Set((Array.isArray(input.data.instrumentIds) ? input.data.instrumentIds : [])
      .map(cleanId).filter(Boolean))];
    if (!instrumentIds.length) return { ok: false, error: { code: 'missing-instrument', message: 'Chọn ít nhất một máy xét nghiệm.' } };

    const instruments = db.prepare('SELECT id, section FROM instruments').all() as { id: string; section: string }[];
    const instrumentById = new Map(instruments.map(row => [row.id, row]));
    if (instrumentIds.some(instrumentId => !instrumentById.has(instrumentId))) {
      return { ok: false, error: { code: 'missing-instrument', message: 'Có máy xét nghiệm đã chọn không còn tồn tại.' } };
    }

    const assignmentIds = [...new Set((Array.isArray(input.data.assignmentIds) ? input.data.assignmentIds : [])
      .map(cleanId).filter(Boolean))];
    if (input.id && !assignmentIds.includes(input.id)) assignmentIds.push(input.id);
    // Nếu người dùng bấm "Thêm" rồi chọn một analyte đã có trên máy khác,
    // tự nối vào đúng danh mục hiện hữu thay vì tạo một nhóm trùng tên.
    if (!input.id && !assignmentIds.length) {
      const name = cleanText(input.data.name).trim();
      const unit = cleanText(input.data.unit).trim();
      const teaRefKey = cleanText(input.data.teaRefKey, 80).trim();
      const catalogMatches = db.prepare('SELECT id, name, unit, tea_ref_key FROM tests').all() as
        { id: string; name: string; unit: string; tea_ref_key: string }[];
      for (const row of catalogMatches) {
        const matchesCatalog = teaRefKey
          ? row.tea_ref_key === teaRefKey
          : sameText(row.name, name) && sameText(row.unit, unit);
        if (matchesCatalog) assignmentIds.push(row.id);
      }
    }
    const existingAssignments = assignmentIds.length
      ? db.prepare(`SELECT * FROM tests WHERE id IN (${assignmentIds.map(() => '?').join(',')})`).all(...assignmentIds) as Record<string, unknown>[]
      : [];
    if (input.id && !existingAssignments.some(row => row.id === input.id)) {
      return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm cần cập nhật.' } };
    }

    // Máy đã có dữ liệu luôn được giữ lại. Việc gỡ một cấu hình máy phải đi
    // qua thao tác xoá có xác thực và cổng kỳ khoá, không được âm thầm xoá
    // điểm QC chỉ vì bỏ dấu tick trong một form cấu hình chung.
    const targetInstrumentIds = [...new Set([
      ...existingAssignments.map(row => String(row.instrument_id || '')),
      ...instrumentIds,
    ].filter(Boolean))];
    const managedIds = new Set(existingAssignments.map(row => String(row.id)));
    const prepared: { instrumentId: string; section: string; data: PreparedTest }[] = [];
    for (const instrumentId of targetInstrumentIds) {
      const duplicateRows = db.prepare('SELECT id, name, tea_ref_key FROM tests WHERE instrument_id=?').all(instrumentId) as
        { id: string; name: string; tea_ref_key: string }[];
      const outsideGroup = duplicateRows.filter(row => !managedIds.has(row.id));
      const result = validateTest({ ...input.data, instrumentId, section: instrumentById.get(instrumentId)?.section || '' },
        new Set(instrumentById.keys()), outsideGroup.map(row => row.name), outsideGroup.map(row => row.tea_ref_key).filter(Boolean));
      if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
      prepared.push({ instrumentId, section: instrumentById.get(instrumentId)?.section || '', data: result.data });
    }

    const firstExisting = existingAssignments[0];
    const analyteId = cleanId(input.data.analyteId)
      || cleanId(firstExisting?.analyte_id)
      || cleanId(input.data.teaRefKey)
      || cleanId(uid());
    const savedIds: string[] = [];
    const preserveExisting = input.data.preserveExistingAssignments === true;
    const saved = inTransaction(() => {
      for (const item of prepared) {
        const current = existingAssignments.find(row => row.instrument_id === item.instrumentId);
        const d = item.data;
        if (current) {
          const currentId = String(current.id);
          if (!preserveExisting) {
            db.prepare(`UPDATE tests SET analyte_id=?,name=?,instrument_id=?,unit=?,decimal_places=?,tea=?,section=?,
              tea_source=?,tea_ref_key=?,method=?,reagent=?,cusum_on=?,cusum_k=?,cusum_h=?,active=? WHERE id=?`)
              .run(analyteId, d.name, item.instrumentId, d.unit, d.decimalPlaces, d.tea, item.section,
                d.teaSource, d.teaRefKey, d.method, d.reagent, d.cusumOn ? 1 : 0, d.cusumK, d.cusumH, d.active ? 1 : 0, currentId);
          }
          savedIds.push(currentId);
        } else {
          const newId = cleanId(uid());
          db.prepare(`INSERT INTO tests(id,analyte_id,name,instrument_id,unit,decimal_places,tea,section,tea_source,tea_ref_key,method,reagent,cusum_on,cusum_k,cusum_h,active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(newId, analyteId, d.name, item.instrumentId, d.unit, d.decimalPlaces, d.tea, item.section,
              d.teaSource, d.teaRefKey, d.method, d.reagent, d.cusumOn ? 1 : 0, d.cusumK, d.cusumH, d.active ? 1 : 0);
          db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,1)').run(`${newId}:1`, newId);
          savedIds.push(newId);
        }
      }
      const action = preserveExisting ? 'Gán thêm máy xét nghiệm' : existingAssignments.length ? 'Sửa xét nghiệm' : 'Thêm xét nghiệm';
      const detail = preserveExisting
        ? `Gán thêm máy cho xét nghiệm "${prepared[0].data.name}"`
        : `${existingAssignments.length ? 'Cập nhật' : 'Tạo'} xét nghiệm "${prepared[0].data.name}" trên ${savedIds.length} máy`;
      writeAudit(db, actor, action, detail, prepared[0].data.name);
      const representativeId = input.id && savedIds.includes(input.id) ? input.id : savedIds[0];
      return db.prepare('SELECT * FROM tests WHERE id=?').get(representativeId) as Test;
    });
    notifyChanged(['tests', 'test_levels'], savedIds);
    return { ok: true, data: { ...saved, assignment_ids: savedIds } };
  }

  function saveTest(input: { id?: string; data: TestInput }, actor: Actor): IpcResult<Test> {
    const denied = requireAdmin(actor); if (denied) return denied;
    if (Array.isArray(input.data.instrumentIds)) return saveTestAssignments(input, actor);
    const id = input.id || '';
    const knownInstrumentIds = new Set((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map(r => r.id));
    const instrumentId = cleanId(input.data.instrumentId);
    const existingTests = db.prepare('SELECT name, tea_ref_key FROM tests WHERE id != ? AND instrument_id=?').all(id, instrumentId) as
      { name: string; tea_ref_key: string }[];
    const result = validateTest(input.data, knownInstrumentIds,
      existingTests.map(row => row.name), existingTests.map(row => row.tea_ref_key).filter(Boolean));
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, unit, decimalPlaces, tea, section, teaSource, teaRefKey, method, reagent, cusumOn, cusumK, cusumH, active } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id, instrument_id FROM tests WHERE id=?').get(id) as
        { id: string; instrument_id: string } | undefined;
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm cần cập nhật.' } };
      let removedPanelMemberships = 0;
      try {
        inTransaction(() => {
          db.prepare(`UPDATE tests SET name=?,instrument_id=?,unit=?,decimal_places=?,tea=?,section=?,
            tea_source=?,tea_ref_key=?,method=?,reagent=?,cusum_on=?,cusum_k=?,cusum_h=?,active=? WHERE id=?`)
            .run(name, result.data.instrumentId, unit, decimalPlaces, tea, section,
              teaSource, teaRefKey, method, reagent, cusumOn ? 1 : 0, cusumK, cusumH, active ? 1 : 0, id);
          if (existing.instrument_id !== result.data.instrumentId) {
            removedPanelMemberships = Number(db.prepare(`DELETE FROM qc_panel_tests
              WHERE test_id=? AND panel_id IN (SELECT id FROM qc_panels WHERE instrument_id!=?)`)
              .run(id, result.data.instrumentId).changes);
          }
          writeAudit(db, actor, 'Sửa xét nghiệm', `Cập nhật xét nghiệm "${name}"`, name);
        });
      } catch (e) {
        return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Cập nhật xét nghiệm thất bại.' } };
      }
      notifyChanged(removedPanelMemberships ? ['tests', 'qc_panels', 'qc_panel_tests'] : ['tests'], [id]);
      return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    try {
      inTransaction(() => {
        db.prepare(`INSERT INTO tests(id,name,instrument_id,unit,decimal_places,tea,section,tea_source,tea_ref_key,method,reagent,cusum_on,cusum_k,cusum_h,active)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(newId, name, result.data.instrumentId, unit, decimalPlaces, tea, section, teaSource, teaRefKey, method, reagent, cusumOn ? 1 : 0, cusumK, cusumH, active ? 1 : 0);
        db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,1)').run(`${newId}:1`, newId);
        writeAudit(db, actor, 'Thêm xét nghiệm', `Tạo xét nghiệm "${name}"`, name);
      });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Tạo xét nghiệm thất bại.' } };
    }
    notifyChanged(['tests'], [newId]);
    return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(newId) };
  }

  /** Mọi mức đã khai của xét nghiệm, kèm cờ `operational` = mức có thuộc
   * THIẾT KẾ QC ĐANG VẬN HÀNH không (`operational-levels.ts`, nguồn dùng
   * chung với Nhập QC và Phân tích Westgard).
   *
   * Cờ này tồn tại vì trang Six Sigma từng đếm mức bằng chính danh sách thô
   * này — không cổng nhóm lô nào — rồi lấy con số đó chọn bảng Westgard Sigma
   * Rules. Một mức gắn lô thuộc nhóm ĐÃ DỪNG vẫn được đếm, nên cùng một xét
   * nghiệm mà thẻ Sigma nói 2 mức còn thẻ Westgard nói 1 mức. Danh sách vẫn
   * trả VỀ ĐỦ (Bảng Mean/SD và Lịch sử cần thấy cả mức đã dừng); chỗ nào cần
   * "thiết kế QC đang chạy" thì lọc theo cờ. */
  function listTestLevels(testId: string) {
    const rows = db.prepare('SELECT * FROM test_levels WHERE test_id=? ORDER BY level').all(testId) as unknown as (Record<string, unknown> & { level: number })[];
    const operational = new Set(listOperationalLevels(db, testId).map((row) => row.level));
    return rows.map((row) => ({ ...row, operational: operational.has(row.level) ? 1 : 0 })) as unknown as TestLevel[];
  }


  function syncLotGroupStatusAfterMove(fromLotId: string, toLotId: string, at: string): void {
    const groupIdOf = (lotId: string) => (db.prepare('SELECT group_id FROM qc_lots WHERE id=?').get(lotId) as { group_id: string | null } | undefined)?.group_id || '';
    const fromGroup = groupIdOf(fromLotId);
    const toGroup = groupIdOf(toLotId);
    if (fromGroup && fromGroup !== toGroup) {
      const remaining = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(fromGroup) as { id: string }[]).map((r) => r.id);
      if (!lotGroupInUse(remaining)) db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(at, fromGroup);
    }
    if (toGroup) db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=? AND status<>''").run(toGroup);
  }

  function saveTestLevel(input: { testId: string; data: TestLevelInput }, actor: Actor): IpcResult<TestLevel> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const testId = cleanId(input.testId);
    const test = db.prepare('SELECT id,name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const result = validateTestLevel(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { level, mean, sd, low, high, qcLotId } = result.data;
    const selectedLot = qcLotId ? db.prepare('SELECT id, lot_no, level, depleted, opened, exp FROM qc_lots WHERE id=?').get(qcLotId) as
      { id: string; lot_no: string; level: number; depleted: number; opened: string; exp: string } | undefined : undefined;
    if (qcLotId) {
      if (!selectedLot) return { ok: false, error: { code: 'missing-lot', message: 'Không tìm thấy lô QC đã chọn.' } };
      if (selectedLot.level !== level) {
        return { ok: false, error: { code: 'wrong-lot-level', message: `Lô QC đã chọn thuộc Mức ${selectedLot.level}, không thể gán cho Mức ${level}.` } };
      }
      // `targetRowState()` hệ thống khoá toàn bộ hàng của lô đã hết dùng.
      if (selectedLot.depleted) return { ok: false, error: { code: 'depleted-lot', message: 'Lô QC đã hết dùng, không thể gán Mean/SD mới.' } };
    }
    const levelId = `${testId}:${level}`;
    const existing = db.prepare('SELECT id, mean, sd, low, high, qc_lot_id, mfg_mean, mfg_sd, applied, mean_sd_history_json, mean_sd_effective_from FROM test_levels WHERE id=?').get(levelId) as
      { id: string; mean: number | null; sd: number | null; low: number | null; high: number | null; qc_lot_id: string | null; mfg_mean: number | null; mfg_sd: number | null; applied: 'mfg' | 'lab'; mean_sd_history_json: string; mean_sd_effective_from: string } | undefined;
    // UPSERT theo (testId, level): mọi xét nghiệm luôn có sẵn Mức 1 tự tạo
    // lúc thêm xét nghiệm (không có Mean/SD) — lưu lại Mean/SD cho MỘT mức
    // đã tồn tại là cập nhật, không phải tạo mới; mức KHÁC chưa có thì tạo mới.
    // Trang "Lịch sử dữ liệu" đọc `mean_sd_history_json` — chốt giá trị CŨ
    // vào lịch sử trước khi ghi đè, không âm thầm mất dấu vết thay đổi target.
    const today = isoLocalDate();
    const saved = inTransaction(() => {
      if (existing) {
        const lotChanged = existing.qc_lot_id !== (qcLotId || null);
        const changed = lotChanged || existing.mean !== mean || existing.sd !== sd || existing.low !== low || existing.high !== high;
        const oldLot = existing.qc_lot_id ? db.prepare('SELECT lot_no, opened, exp FROM qc_lots WHERE id=?').get(existing.qc_lot_id) as
          { lot_no: string; opened: string; exp: string } | undefined : undefined;
        const nextEffectiveFrom = lotChanged
          ? (selectedLot?.opened || today)
          : changed ? today : (existing.mean_sd_effective_from || selectedLot?.opened || today);
        const historyJson = changed
          ? appendMeanSdHistory(existing.mean_sd_history_json, {
            mean: existing.mean, sd: existing.sd, low: existing.low, high: existing.high,
            qcLotId: existing.qc_lot_id || '', lot: oldLot?.lot_no || '',
            effectiveFrom: existing.mean_sd_effective_from || oldLot?.opened || '',
            effectiveTo: lotChanged ? nextEffectiveFrom : today,
            source: existing.applied,
          }, nowIso())
          : existing.mean_sd_history_json;
        // Nếu đang dùng dải NSX, giá trị vừa lưu là mốc để quy trình
        // "Hoàn dải" phục hồi; dải PXN giữ nguyên mốc NSX dự phòng.
        const mfgMean = existing.applied === 'mfg' ? mean : existing.mfg_mean;
        const mfgSd = existing.applied === 'mfg' ? sd : existing.mfg_sd;
        db.prepare('UPDATE test_levels SET mean=?,sd=?,low=?,high=?,qc_lot_id=?,mfg_mean=?,mfg_sd=?,mean_sd_history_json=?,mean_sd_effective_from=? WHERE id=?')
          .run(mean, sd, low, high, qcLotId || null, mfgMean, mfgSd, historyJson, nextEffectiveFrom, levelId);
      } else {
        db.prepare("INSERT INTO test_levels(id,test_id,level,mean,sd,low,high,qc_lot_id,mfg_mean,mfg_sd,applied,mean_sd_effective_from) VALUES (?,?,?,?,?,?,?,?,?,?,'mfg',?)")
          .run(levelId, testId, level, mean, sd, low, high, qcLotId || null, mean, sd, selectedLot?.opened || today);
      }
      // Lô vừa trở thành lô ĐANG DÙNG thì Mean/SD đã nhập sẵn cho đúng lô đó
      // hết nghĩa — giữ lại sẽ thành số mồ côi, và lần kích hoạt nhóm sau đó
      // áp đè một giá trị cũ hơn cả giá trị vừa lưu.
      if (qcLotId) db.prepare('DELETE FROM planned_targets WHERE test_id=? AND level=? AND qc_lot_id=?').run(testId, level, qcLotId);
      if (existing && qcLotId && existing.qc_lot_id && existing.qc_lot_id !== qcLotId) {
        syncLotGroupStatusAfterMove(existing.qc_lot_id, qcLotId, today);
      }
      writeAudit(db, actor, existing ? 'Sửa mức QC' : 'Thêm mức QC', `Mức ${level} của xét nghiệm "${test.name}": Mean=${mean ?? '—'} SD=${sd ?? '—'}`, test.name);
      return db.prepare('SELECT * FROM test_levels WHERE id=?').get(levelId);
    });
    notifyChanged(['test_levels', 'lot_groups', 'planned_targets'], [testId]);
    return { ok: true, data: saved };
  }

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

  function savePlannedTargets(
    input: { items?: { testId: unknown; level: unknown; qcLotId: unknown; mean: unknown; sd: unknown; low: unknown; high: unknown }[];
      remove?: { testId: unknown; level: unknown; qcLotId: unknown }[] },
    actor: Actor,
  ): IpcResult<{ saved: number; removed: number }> {
    const denied = requireAdmin(actor); if (denied) return denied;
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
    const removed = inTransaction(() => {
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
      if (prepared.length || count) {
        const lotNos = [...new Set(prepared.map((row) => row.lotNo))].join(', ');
        writeAudit(db, actor, 'Lưu Mean/SD dự kiến',
          `${prepared.length} mức QC${lotNos ? ` cho lô ${lotNos}` : ''}${count ? `, bỏ ${count} mục dự kiến` : ''} — chưa áp vào cấu hình đang chạy`,
          'Mean/SD dự kiến');
      }
      return count;
    });
    notifyChanged(['planned_targets', 'lot_groups'], [...new Set(prepared.map((row) => row.testId))]);
    return { ok: true, data: { saved: prepared.length, removed } };
  }

  /** Phạm vi áp dụng (within/across) từng luật, theo xét nghiệm — lưu ở
   * `tests.rule_scopes_json` và được Entry/Westgard thực thi. Chuỗi rỗng xoá
   * ghi đè để quay lại phạm vi SOP khuyến nghị. */
  function listRuleScopes(testId: string, levelCount?: number) {
    const row = db.prepare('SELECT rule_scopes_json, rule_actions_json FROM tests WHERE id=?').get(testId) as
      { rule_scopes_json: string; rule_actions_json: string } | undefined;
    // Số mức do MAIN tự đếm, không nhận từ renderer: phạm vi khuyến nghị phụ
    // thuộc số mức ĐANG VẬN HÀNH (`operational-levels.ts`, dùng chung với
    // Entry/Westgard), thứ renderer không có cách nào biết đúng. Tham số chỉ
    // để test bơm số mức giả khi kiểm nhánh sanitize.
    const levels = levelCount ?? countOperationalLevels(db, testId);
    return effectiveRuleConfigList(
      parseRuleScopes(row ? row.rule_scopes_json : null), levels,
      readGlobalRules(db), parseRuleActions(row ? row.rule_actions_json : null),
    );
  }

  function saveRuleScope(testId: string, ruleId: string, scope: RuleScope | '', actor: Actor): IpcResult<{ ruleId: string; scope: RuleScope | '' }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const test = db.prepare('SELECT id, name, rule_scopes_json FROM tests WHERE id=?').get(testId) as { id: string; name: string; rule_scopes_json: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    if (scope !== '' && !isAllowedRuleScope(ruleId, scope)) return { ok: false, error: { code: 'invalid-scope', message: 'Phạm vi này không được hỗ trợ bởi luật Westgard đã chọn.' } };
    const overrides: RuleScopesMap = parseRuleScopes(test.rule_scopes_json);
    if (scope) overrides[ruleId] = scope; else delete overrides[ruleId];
    inTransaction(() => {
      db.prepare('UPDATE tests SET rule_scopes_json=? WHERE id=?').run(serializeRuleScopes(overrides), testId);
      writeAudit(db, actor, 'Sửa phạm vi luật Westgard', `Luật ${ruleId} chuyển thành ${scope ? `phạm vi ${scope}` : 'phạm vi SOP khuyến nghị'}`, test.name);
    });
    notifyChanged(['tests'], [testId]);
    return { ok: true, data: { ruleId, scope } };
  }

  // ---- Lô QC ("Lô & nhóm lô QC") ----
  function listLots() {
    return db.prepare('SELECT * FROM qc_lots ORDER BY lot_no').all();
  }

  /** Kế hoạch đổi số lô: ĐẾM điểm QC sẽ bị viết lại + soi kỳ đã khoá, KHÔNG
   * ghi gì. Điểm QC lưu số lô dạng CHUỖI TĨNH chụp lúc nhập (`qc_points.lot`,
   * xem `entry-handlers.ts` Giai đoạn B2), không tham chiếu `qc_lots.id` —
   * nên đổi `lot_no` mà không cập nhật lại điểm cũ sẽ khiến chúng "biến mất"
   * khỏi mọi bộ lọc theo lô (Nhập QC/Westgard/Sigma): không khớp lô hiện tại
   * (chuỗi đã đổi) mà cũng không hiện ở "lô cũ" (không có hồ sơ chuyển tiếp
   * nào giữa 2 TÊN GỌI của cùng một lô). Đây là VIẾT LẠI HÀNG LOẠT bản ghi
   * lịch sử, nên người dùng phải thấy con số TRƯỚC khi làm — đúng cách hệ thống
   * hỏi trong `saveConfigLot()`. */
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

  function saveLot(input: { id?: string; data: LotInput }, actor: Actor): IpcResult<QcLot> {
    const denied = requireAdmin(actor); if (denied) return denied;
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
      inTransaction(() => {
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
        writeAudit(db, actor, 'Sửa lô QC',
          renaming ? `Đổi số lô "${before!.lot_no}" → "${lotNo}" mức ${level}, cập nhật ${renamed} điểm QC`
            : `Cập nhật lô "${lotNo}" mức ${level}`, lotNo);
      });
      notifyChanged(renaming ? ['qc_lots', 'qc_points'] : ['qc_lots']);
      return { ok: true, data: db.prepare('SELECT * FROM qc_lots WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    const savedLot = inTransaction(() => {
      db.prepare(`INSERT INTO qc_lots(id,group_id,lot_no,level,description,supplier,program,exp,opened,active,depleted,note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(newId, groupId || null, lotNo, level, description, supplier, program, exp, opened, active ? 1 : 0, depleted ? 1 : 0, note);
      writeAudit(db, actor, 'Thêm lô QC', `Tạo lô "${lotNo}" mức ${level}`, lotNo);
      return db.prepare('SELECT * FROM qc_lots WHERE id=?').get(newId);
    });
    notifyChanged(['qc_lots']);
    return { ok: true, data: savedLot };
  }

  // ---- Nhóm lô QC ----

  function lotGroupInUse(lotIds: string[]): boolean {
    if (!lotIds.length) return false;
    const placeholders = lotIds.map(() => '?').join(',');
    return !!db.prepare(`SELECT 1 FROM test_levels WHERE qc_lot_id IN (${placeholders}) LIMIT 1`).get(...lotIds);
  }

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

  function saveLotGroup(input: { id?: string; data: LotGroupInput }, actor: Actor): IpcResult<LotGroup> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const lotRows = db.prepare('SELECT id, lot_no FROM qc_lots').all() as { id: string; lot_no: string }[];
    const lotNoById = new Map(lotRows.map(row => [row.id, row.lot_no]));
    const requestedLotIds = Array.isArray(input.data.lotIds)
      ? [...new Set(input.data.lotIds.map(cleanId).filter(Boolean))]
      : [];
    // `prepareLotGroup()` hệ thống: tên trống tự ghép từ số lô theo đúng thứ
    // tự người dùng chọn, ví dụ 1101/1102.
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
      inTransaction(() => {
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
        writeAudit(db, actor, id ? 'Sửa nhóm lô QC' : 'Thêm nhóm lô QC', `Nhóm "${name}" (${validLotIds.length} lô)`, name);
      });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Lưu nhóm lô QC thất bại.' } };
    }
    notifyChanged(['lot_groups', 'qc_lots']);
    // Ép về đúng kiểu hợp đồng thay vì `as object`: spread một `object` cho ra
    // `{}` nên TypeScript không còn thấy field nào, và hợp đồng
    // `IpcResult<LotGroup>` trở thành vô nghĩa.
    const groupRow = db.prepare('SELECT * FROM lot_groups WHERE id=?').get(groupId) as Omit<LotGroup, 'lotIds' | 'inUse'>;
    return { ok: true, data: { ...groupRow, lotIds: validLotIds, inUse: lotGroupInUse(validLotIds) } };
  }

  function listPanels() {
    const panels = db.prepare('SELECT * FROM qc_panels ORDER BY name').all() as Omit<QcPanel, 'testIds'>[];
    // `ORDER BY` là BẮT BUỘC, không phải trang trí: thiếu nó thì SQLite đọc
    // thẳng từ index khoá chính `(panel_id, test_id)` và trả về theo test_id
    // ngẫu nhiên. `rowid` là chốt phụ cho dòng `position` NULL (backup cũ
    // phục hồi lại) — thứ tự chèn chính là thứ tự trong backup.
    return panels.map(p => ({ ...p, testIds: (db.prepare('SELECT test_id FROM qc_panel_tests WHERE panel_id=? ORDER BY position, rowid').all(p.id) as { test_id: string }[]).map(r => r.test_id) }));
  }

  function savePanel(input: { id?: string; data: PanelInput }, actor: Actor): IpcResult<QcPanel> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const knownInstrumentIds = new Set((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map(r => r.id));
    const result = validatePanel(input.data, knownInstrumentIds);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, instrumentId, note, active, testIds } = result.data;
    // Các cổng còn lại: không lưu Panel QC rỗng xét nghiệm hoặc chứa xét
    // nghiệm KHÁC máy đã chọn (im lặng, không báo).
    if (!testIds.length) return { ok: false, error: { code: 'missing-tests', message: 'Chọn ít nhất một xét nghiệm.' } };
    const testRows = db.prepare(`SELECT id, instrument_id FROM tests WHERE id IN (${testIds.map(() => '?').join(',')})`).all(...testIds) as { id: string; instrument_id: string }[];
    const knownTests = new Set(testRows.map((t) => t.id));
    const validTestIds = testIds.filter((t) => knownTests.has(t));
    if (!validTestIds.length) return { ok: false, error: { code: 'missing-tests', message: 'Chọn ít nhất một xét nghiệm hợp lệ.' } };
    // hệ thống coi MỌI id không tồn tại như một xét nghiệm không thuộc máy đã
    // chọn và từ chối TOÀN BỘ lần lưu. Không được âm thầm bỏ id hỏng rồi lưu
    // phần còn lại: kết quả sẽ khác với lựa chọn mà người dùng vừa xác nhận.
    if (validTestIds.length !== testIds.length) {
      return { ok: false, error: { code: 'wrong-instrument', message: 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.' } };
    }
    if (testRows.some((t) => t.instrument_id !== instrumentId)) {
      return { ok: false, error: { code: 'wrong-instrument', message: 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.' } };
    }
    const sameInstrumentNames = (db.prepare('SELECT name FROM qc_panels WHERE id!=? AND instrument_id=?').all(id || '', instrumentId) as { name: string }[]).map((panel) => panel.name);
    if (sameInstrumentNames.some((existingName) => sameText(existingName, name))) {
      return { ok: false, error: { code: 'duplicate-panel', message: 'Panel QC này đã tồn tại trên máy đã chọn.' } };
    }
    let panelId = id;
    if (id && !db.prepare('SELECT id FROM qc_panels WHERE id=?').get(id)) {
      return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy Panel QC cần cập nhật.' } };
    }
    if (!id) panelId = cleanId(uid());
    // Hàng Panel và toàn bộ bảng nối là MỘT lần lưu nghiệp vụ. Transaction
    // ngăn trạng thái nửa vời nếu một insert bảng nối thất bại sau khi hàng
    // Panel đã cập nhật hoặc sau khi liên kết cũ đã bị xoá.
    try {
      inTransaction(() => {
        if (id) {
          db.prepare('UPDATE qc_panels SET name=?,instrument_id=?,note=?,active=? WHERE id=?').run(name, instrumentId, note, active ? 1 : 0, id);
        } else {
          db.prepare('INSERT INTO qc_panels(id,name,instrument_id,note,active) VALUES (?,?,?,?,?)').run(panelId, name, instrumentId, note, active ? 1 : 0);
        }
        db.prepare('DELETE FROM qc_panel_tests WHERE panel_id=?').run(panelId);
        // Vị trí ghi TƯỜNG MINH theo thứ tự `validTestIds` — thứ tự người dùng
        // tick trong modal. Đừng sắp lại theo tên ở bất kỳ tầng nào.
        validTestIds.forEach((testId, position) => {
          db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id,position) VALUES (?,?,?)').run(panelId, testId, position);
        });
        writeAudit(db, actor, id ? 'Sửa Panel QC' : 'Thêm Panel QC', `Panel "${name}" (${validTestIds.length} xét nghiệm)`, name);
      });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Lưu Panel QC thất bại.' } };
    }
    notifyChanged(['qc_panels', 'qc_panel_tests']);
    const panelRow = db.prepare('SELECT * FROM qc_panels WHERE id=?').get(panelId) as Omit<QcPanel, 'testIds'>;
    return { ok: true, data: { ...panelRow, testIds: validTestIds } };
  }

  // ---- Chuyển tiếp lô ----
  function listLotTransitions() {
    return db.prepare('SELECT * FROM lot_transitions ORDER BY start_date DESC').all();
  }

  const LOT_TRANSITION_STATUS_TEXT: Record<string, string> = {
    planned: 'Dự kiến', active: 'Đang chạy song song', accepted: 'Chấp nhận lô mới', rejected: 'Không chấp nhận',
  };


  function createLotTransition(
    input: { id?: string; data: LotTransitionInput & { criteria?: { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[] } },
    actor: Actor,
  ): IpcResult<LotTransition> {
    const denied = requireAdmin(actor); if (denied) return denied;
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
      // hệ thống kiểm `Number.isFinite(mean)` qua snapshot Mean/SD, không kiểm
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
    const applyCascade = () => {
      for (const item of criteria) {
        const level = db.prepare('SELECT * FROM test_levels WHERE test_id=? AND level=?').get(item.testId, item.level) as
          { id: string; qc_lot_id: string | null; mean: number | null; sd: number | null; low: number | null; high: number | null; applied: 'mfg' | 'lab'; mean_sd_history_json: string | null; mean_sd_effective_from: string } | undefined;
        if (!level || level.qc_lot_id !== fromLotId) continue;
        // Nguồn 'mfg' (NSX) — KHÔNG phải 'lab' (PXN). Mean/SD ứng viên nhập
        // trong modal chuyển lô là số của NHÀ SẢN XUẤT cho lô mới, không đi
        // qua luồng "Xây dựng dải PXN" riêng (`rangeCandidate()`/
        // `applyNewRange()` ở trang Nhập QC & Biểu đồ) — đúng
        // `applyPlannedTarget()` hệ thống luôn ghi `source:'mfg'` cho Mean/SD
        // nhập trong modal chuyển lô. Ghi 'lab' ở đây là bug thật (người
        // dùng phát hiện qua cột "Nguồn" của tab Lịch sử dữ liệu hiện PXN
        // cho lô vừa chuyển tiếp, dù chưa hề qua trang Nhập QC).
        db.prepare('UPDATE test_levels SET qc_lot_id=?, mean=?, sd=?, low=?, high=?, applied=?, mean_sd_history_json=?, mean_sd_effective_from=? WHERE id=?')
          .run(toLotId, item.mean, item.sd, item.low ?? null, item.high ?? null, 'mfg',
            appendMeanSdHistory(level.mean_sd_history_json, {
              mean: level.mean, sd: level.sd, low: level.low, high: level.high,
              qcLotId: level.qc_lot_id || '', lot: fromLot.lot_no,
              effectiveFrom: level.mean_sd_effective_from || fromLot.opened || '',
              effectiveTo: startDate || toLot.opened || at.slice(0, 10), source: level.applied,
            }, at),
            toLot.opened || startDate || at.slice(0, 10), level.id);
      }
      db.prepare('UPDATE qc_lots SET depleted=1 WHERE id=?').run(fromLotId);
      if (fromLot.group_id) {
        const group = db.prepare('SELECT * FROM lot_groups WHERE id=?').get(fromLot.group_id) as
          { id: string; name: string; manufacturer: string; material: string; catalog: string } | undefined;
        if (group) {
          const members = db.prepare('SELECT id, lot_no FROM qc_lots WHERE group_id=?').all(group.id) as { id: string; lot_no: string }[];
          const oldName = members.map((m) => m.lot_no).join('/');
          const autoNamed = !group.name || group.name === oldName;
          const archivedId = cleanId(uid());
          const archivedLotIdsJson = JSON.stringify(members.map((m) => m.id));
          db.prepare(`INSERT INTO lot_groups(id,name,manufacturer,material,catalog,note,active,status,stopped_at,archived_lot_ids_json)
            VALUES (?,?,?,?,?,?,0,'stopped',?,?)`)
            .run(archivedId, group.name, group.manufacturer, group.material, group.catalog,
              `Đã dùng khi chuyển tiếp lô ${fromLot.lot_no} sang ${toLot.lot_no}`, startDate || at, archivedLotIdsJson);
          db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(archivedId, fromLotId);
          db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(group.id, toLotId);
          if (autoNamed) {
            const newName = members.map((m) => (m.id === fromLotId ? toLot.lot_no : m.lot_no)).join('/');
            if (newName !== group.name) db.prepare('UPDATE lot_groups SET name=? WHERE id=?').run(newName, group.id);
          }
        }
      }
    };

    const approvedAt = finalChanged ? at : existing?.approved_at || '';
    const approvedBy = finalChanged ? actor.username : existing?.approved_by || '';

    // Hồ sơ, cascade chuyển lô và HAI dòng nhật ký là một đơn vị. Trước đây
    // nhật ký ghi sau COMMIT: lỗi ở bước đó để lại chuyển lô đã áp dụng mà
    // không có dấu vết, rồi ROLLBACK chạy khi không còn transaction.
    const cascade = status === 'accepted' && finalChanged;
    const id = withTransaction(db, () => {
      let savedId = input.id || '';
      if (existing) {
        db.prepare('UPDATE lot_transitions SET panel_id=?, from_lot_id=?, to_lot_id=?, start_date=?, status=?, note=?, criteria_json=?, approved_at=?, approved_by=? WHERE id=?')
          .run(panelId, fromLotId, toLotId, startDate, status, note, criteriaJson, approvedAt, approvedBy, savedId);
      } else {
        savedId = cleanId(uid());
        db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,start_date,status,note,criteria_json,approved_at,approved_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(savedId, panelId, fromLotId, toLotId, startDate, status, note, criteriaJson, approvedAt, approvedBy);
      }
      if (cascade) applyCascade();
      const detail = `${panel.name}: ${fromLot.lot_no} → ${toLot.lot_no} · ${LOT_TRANSITION_STATUS_TEXT[status]}`;
      writeAudit(db, actor, existing ? 'Sửa hồ sơ chuyển lô' : 'Thêm hồ sơ chuyển lô', detail, panel.name);
      if (cascade) writeAudit(db, actor, 'Áp dụng chuyển tiếp lô', `${panel.name} · ${fromLot.lot_no} → ${toLot.lot_no} · ${criteria.length} xét nghiệm`, panel.name);
      return savedId;
    });
    notifyChanged(cascade ? ['lot_transitions', 'qc_lots', 'lot_groups', 'test_levels', 'tests'] : ['lot_transitions']);
    return { ok: true, data: db.prepare('SELECT * FROM lot_transitions WHERE id=?').get(id) };
  }

  // ---- Bảng TEa tham chiếu ----
  function listTeaRefs() {
    return db.prepare('SELECT * FROM tea_refs ORDER BY name').all();
  }

  /** dd/mm/yyyy — audit log của hồ sơ TEa PXN đọc lại bởi người phụ trách
   * tuân thủ, ISO thô khó đọc hơn hẳn so với các dòng audit khác trong file
   * này (phần lớn không có ngày trong `detail`). */
  function dmy(value: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
  }

  function saveTeaRef(input: { id?: string; data: TeaRefInput }, actor: Actor): IpcResult<TeaRef> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const result = validateTeaRef(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, unit, section, labValue, labSource, reference, reason, effectiveDate, approvedDate, nextReviewDate, preparedBy, approvedBy } = result.data;
    const sourcesJson = JSON.stringify({ reference, reason, effectiveDate, approvedDate, approvedBy });
    const sourceLabel = TEA_LAB_SOURCE_LABELS[labSource] || labSource;
    const detailOf = (before: number | null) =>
      `${name} · ${before ?? '—'}% → ${labValue}% · ${sourceLabel} · ${reference} · Hiệu lực ${dmy(effectiveDate)}`
      + ` · Xây dựng: ${preparedBy} · Phê duyệt: ${approvedBy} (${dmy(approvedDate)})`
      + `${nextReviewDate ? ' · Xem xét lại ' + dmy(nextReviewDate) : ''} · Lý do: ${reason}`;
    if (id) {
      const existing = db.prepare('SELECT id, lab FROM tea_refs WHERE id=?').get(id) as { id: string; lab: number | null } | undefined;
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa cần cập nhật.' } };
      const saved = inTransaction(() => {
        db.prepare(`UPDATE tea_refs SET name=?,unit=?,section=?,lab=?,lab_source=?,lab_prepared_by=?,lab_next_review_date=?,sources_json=? WHERE id=?`)
          .run(name, unit, section, labValue, labSource, preparedBy, nextReviewDate, sourcesJson, id);
        writeAudit(db, actor, existing.lab == null ? 'Thiết lập TEa chuẩn hóa' : 'Cập nhật TEa chuẩn hóa', detailOf(existing.lab), name);
        return db.prepare('SELECT * FROM tea_refs WHERE id=?').get(id);
      });
      notifyChanged(['tea_refs']);
      return { ok: true, data: saved };
    }
    const newId = cleanId(uid());
    const saved = inTransaction(() => {
      db.prepare(`INSERT INTO tea_refs(id,name,unit,section,lab,lab_source,lab_prepared_by,lab_next_review_date,sources_json)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(newId, name, unit, section, labValue, labSource, preparedBy, nextReviewDate, sourcesJson);
      writeAudit(db, actor, 'Thiết lập TEa chuẩn hóa', detailOf(null), name);
      return db.prepare('SELECT * FROM tea_refs WHERE id=?').get(newId);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: saved };
  }


  function setTeaRefValue(
    input: { analyteId: unknown; field: unknown; value: unknown; name?: unknown; unit?: unknown; section?: unknown },
    actor: Actor,
  ): IpcResult<{ analyteId: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const analyteId = cleanId(String(input.analyteId || ''));
    const field = String(input.field || '');
    if (!analyteId) return { ok: false, error: { code: 'invalid-analyte', message: 'Thiếu mã analyte.' } };
    if (field !== 'clia' && field !== 'ricos') return { ok: false, error: { code: 'invalid-field', message: 'Chỉ sửa được TEa CLIA% hoặc Ricos%.' } };
    const raw = String(input.value ?? '').trim();
    let value: number | null = null;
    if (raw !== '') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: { code: 'invalid-value', message: 'TEa phải là số lớn hơn 0.' } };
      }
      value = parsed;
    }
    const name = String(input.name || analyteId);
    const existing = db.prepare('SELECT * FROM tea_refs WHERE analyte_id=?').get(analyteId) as
      { id: string; clia: number | null; ricos: number | null; lab: number | null; clia_absolute: number | null } | undefined;
    if (!existing && value == null) return { ok: true, data: { analyteId } };
    const label = field === 'clia' ? 'CLIA' : 'Ricos';
    inTransaction(() => {
      if (existing) {
        db.prepare(`UPDATE tea_refs SET ${field}=? WHERE id=?`).run(value, existing.id);
        const after = db.prepare('SELECT clia, ricos, lab, clia_absolute FROM tea_refs WHERE id=?').get(existing.id) as
          { clia: number | null; ricos: number | null; lab: number | null; clia_absolute: number | null };
        if (after.clia == null && after.ricos == null && after.lab == null && after.clia_absolute == null) db.prepare('DELETE FROM tea_refs WHERE id=?').run(existing.id);
      } else {
        const newId = cleanId(uid());
        db.prepare(`INSERT INTO tea_refs(id,analyte_id,name,unit,section,${field}) VALUES (?,?,?,?,?,?)`)
          .run(newId, analyteId, name, String(input.unit || ''), String(input.section || ''), value);
      }
      writeAudit(db, actor, 'Sửa bảng TEa tham chiếu',
        value == null ? `Bỏ ghi đè TEa ${label} của "${name}"` : `Đặt TEa ${label} của "${name}" = ${value}%`, name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { analyteId } };
  }


  function addTeaAnalyte(
    input: { name: unknown; abbreviation?: unknown; matrix?: unknown; unit?: unknown; section?: unknown; clia?: unknown; ricos?: unknown; cliaRule?: unknown; cliaAbsolute?: unknown; cliaAbsoluteUnit?: unknown },
    actor: Actor,
  ): IpcResult<{ analyteId: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const name = cleanText(input.name, 120).trim();
    if (!name) return { ok: false, error: { code: 'missing-name', message: 'Nhập tên xét nghiệm.' } };
    const num = (value: unknown): number | null => {
      const raw = String(value ?? '').trim();
      if (raw === '') return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    // Khoá analyte suy từ tên (bỏ dấu, gạch nối) — cùng quy ước
    // `teaAnalyteKey()` hệ thống để hồ sơ PXN và ghi đè CLIA/Ricos khớp nhau.
    const analyteId = cleanId(name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || uid());
    const existing = db.prepare('SELECT id FROM tea_refs WHERE analyte_id=?').get(analyteId) as { id: string } | undefined;
    if (existing) return { ok: false, error: { code: 'duplicate', message: `Đã có xét nghiệm tham chiếu "${name}".` } };
    const cliaRule = ['percent', 'absolute', 'greater-of'].includes(String(input.cliaRule || '')) ? String(input.cliaRule) : '';
    const cliaAbsolute = num(input.cliaAbsolute);
    if (cliaRule === 'absolute' && cliaAbsolute == null) return { ok: false, error: { code: 'missing-clia-absolute', message: 'Nhập giới hạn CLIA tuyệt đối khi chọn quy tắc tuyệt đối.' } };
    inTransaction(() => {
      db.prepare(`INSERT INTO tea_refs(id,analyte_id,name,abbreviation,matrix,unit,section,clia,ricos,clia_rule,clia_absolute,clia_absolute_unit)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        cleanId(uid()), analyteId, name, cleanText(input.abbreviation, 40).trim(), cleanText(input.matrix, 80).trim(),
        cleanText(input.unit, 40).trim(), cleanText(input.section, 80).trim(), num(input.clia), num(input.ricos), cliaRule, cliaAbsolute,
        cleanText(input.cliaAbsoluteUnit, 40).trim() || cleanText(input.unit, 40).trim(),
      );
      writeAudit(db, actor, 'Thêm xét nghiệm tham chiếu', `Thêm "${name}" vào bảng TEa tham chiếu`, name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { analyteId } };
  }

  /** Bỏ MỌI ghi đè CLIA/Ricos của 1 analyte (nút "Khôi phục" hệ thống) — giữ
   * lại hồ sơ TEa PXN nếu có, chỉ trả 2 giá trị tham chiếu về mặc định. */
  function restoreTeaRefDefaults(input: { analyteId: unknown }, actor: Actor): IpcResult<{ analyteId: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const analyteId = cleanId(String(input.analyteId || ''));
    const existing = db.prepare('SELECT id, name, lab FROM tea_refs WHERE analyte_id=?').get(analyteId) as
      { id: string; name: string; lab: number | null } | undefined;
    if (!existing) return { ok: true, data: { analyteId } };
    inTransaction(() => {
      if (existing.lab == null) db.prepare('DELETE FROM tea_refs WHERE id=?').run(existing.id);
      else db.prepare('UPDATE tea_refs SET clia=NULL, ricos=NULL, clia_rule=\'\', clia_absolute=NULL, clia_absolute_unit=\'\' WHERE id=?').run(existing.id);
      writeAudit(db, actor, 'Khôi phục TEa tham chiếu', `Bỏ ghi đè CLIA/Ricos của "${existing.name}"`, existing.name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { analyteId } };
  }

  function removeTeaRef(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM tea_refs WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa.' } };
    inTransaction(() => {
      db.prepare('DELETE FROM tea_refs WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá hồ sơ TEa', `Xoá "${existing.name}"`, existing.name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { id } };
  }


  function removeTeaLabProfile(input: { id: unknown }, actor: Actor): IpcResult<{ id: string; removedRecord: boolean }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name, clia, ricos, clia_absolute, abbreviation, matrix, lab FROM tea_refs WHERE id=?').get(id) as
      { id: string; name: string; clia: number | null; ricos: number | null; clia_absolute: number | null; abbreviation: string; matrix: string; lab: number | null } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa.' } };
    if (existing.lab == null) return { ok: true, data: { id, removedRecord: false } };
    const isCustomAnalyte = !!(existing.abbreviation || existing.matrix);
    const removedRecord = !isCustomAnalyte && existing.clia == null && existing.ricos == null && existing.clia_absolute == null;
    inTransaction(() => {
      db.prepare(`UPDATE tea_refs SET lab=NULL, lab_source='', lab_prepared_by='', lab_next_review_date='', sources_json='{}' WHERE id=?`).run(id);
      if (removedRecord) db.prepare('DELETE FROM tea_refs WHERE id=?').run(id);
      writeAudit(db, actor, 'Xóa TEa chuẩn hóa', `${existing.name} · ${Number(existing.lab).toFixed(2)}%`, existing.name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { id, removedRecord } };
  }


  /** Chỉ xoá cấu hình xét nghiệm hoàn toàn mới, chưa phát sinh dữ liệu.
   * Điểm QC (kể cả đã huỷ), Mean/SD, lô đang gán, lịch sử Mean/SD, Sigma hay
   * hồ sơ NCE đều là hồ sơ chất lượng phải giữ lại. Khi đã có một trong các
   * dấu vết đó, đường đúng là chuyển xét nghiệm sang `active=0`; tuyệt đối
   * không xoá dữ liệu để làm biến mất lịch sử. */
  function removeTest(input: { id: unknown; ids?: unknown }, actor: Actor): IpcResult<{ id: string; pointsCount: number }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const ids = [...new Set([id, ...(Array.isArray(input.ids) ? input.ids.map(String) : [])].filter(Boolean))];
    const placeholders = ids.map(() => '?').join(',');
    const existingRows = ids.length ? db.prepare(`SELECT id, name FROM tests WHERE id IN (${placeholders})`).all(...ids) as { id: string; name: string }[] : [];
    const existing = existingRows.find(row => row.id === id);
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const existingIds = existingRows.map(row => row.id);
    const existingPlaceholders = existingIds.map(() => '?').join(',');
    const points = db.prepare(`SELECT test_id, date FROM qc_points WHERE test_id IN (${existingPlaceholders})`).all(...existingIds) as { test_id: string; date: string }[];
    const configuredLevels = Number((db.prepare(`SELECT COUNT(*) AS n FROM test_levels WHERE test_id IN (${existingPlaceholders})
      AND (mean IS NOT NULL OR sd IS NOT NULL OR qc_lot_id IS NOT NULL OR TRIM(COALESCE(mean_sd_history_json,'')) NOT IN ('','[]'))`)
      .get(...existingIds) as { n: number }).n);
    const sigmaCount = Number((db.prepare(`SELECT COUNT(*) AS n FROM sigma_data WHERE test_id IN (${existingPlaceholders})`)
      .get(...existingIds) as { n: number }).n);
    const actionCount = Number((db.prepare(`SELECT COUNT(*) AS n FROM actions WHERE test_id IN (${existingPlaceholders})`)
      .get(...existingIds) as { n: number }).n);
    if (points.length || configuredLevels || sigmaCount || actionCount) {
      return {
        ok: false,
        error: {
          code: 'has-history',
          message: `Không thể xoá "${existing.name}" vì đã có dữ liệu QC hoặc lịch sử cấu hình. Hãy chọn “Ngừng sử dụng” để giữ nguyên hồ sơ.`,
        },
      };
    }
    try {
      inTransaction(() => {
        db.prepare(`DELETE FROM test_levels WHERE test_id IN (${existingPlaceholders})`).run(...existingIds);
        db.prepare(`DELETE FROM qc_panel_tests WHERE test_id IN (${existingPlaceholders})`).run(...existingIds);
        db.prepare(`DELETE FROM tests WHERE id IN (${existingPlaceholders})`).run(...existingIds);
        writeAudit(db, actor, 'Xoá xét nghiệm', `Xoá cấu hình chưa phát sinh dữ liệu "${existing.name}" trên ${existingIds.length} máy`, existing.name);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá xét nghiệm thất bại.' } };
    }
    notifyChanged(['tests', 'test_levels', 'qc_panels'], existingIds);
    return { ok: true, data: { id, pointsCount: 0 } };
  }


  function removePanel(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM qc_panels WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy Panel QC.' } };
    const usedByTransition = (db.prepare('SELECT COUNT(*) as c FROM lot_transitions WHERE panel_id=?').get(id) as { c: number }).c;
    if (usedByTransition) {
      return {
        ok: false,
        error: { code: 'used-by-transition', message: 'Panel này đang có lịch sử chuyển tiếp lô. Hãy xóa/chuyển các dòng chuyển tiếp trước.' },
      };
    }
    try {
      inTransaction(() => {
        db.prepare('DELETE FROM qc_panel_tests WHERE panel_id=?').run(id);
        db.prepare('DELETE FROM qc_panels WHERE id=?').run(id);
        writeAudit(db, actor, 'Xoá Panel QC', `Xoá Panel QC "${existing.name}"`, existing.name);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá Panel QC thất bại.' } };
    }
    notifyChanged(['qc_panels']);
    return { ok: true, data: { id } };
  }

  /** Chặn xoá lô đang được gán Mean/SD cho một mức QC, hoặc lô đã đi qua một
   * hồ sơ chuyển tiếp ĐÃ KẾT LUẬN (hệ thống: "đã CHẤP NHẬN", tức đã áp vào
   * cấu hình/Mean-SD) — xoá thẳng sẽ để lại mức QC trỏ vào lô không còn tồn
   * tại. Xoá được thì dọn luôn các hồ sơ chuyển lô còn dở dang trỏ tới nó,
   * đúng như `removeLot()` hệ thống làm. */
  function removeLot(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
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
      inTransaction(() => {
        db.prepare('DELETE FROM lot_transitions WHERE from_lot_id=? OR to_lot_id=?').run(id, id);
        db.prepare('DELETE FROM qc_lots WHERE id=?').run(id);
        writeAudit(db, actor, 'Xoá lô QC', `Xoá lô "${existing.lot_no}"`, existing.lot_no);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá lô QC thất bại.' } };
    }
    notifyChanged(['qc_lots', 'lot_groups', 'lot_transitions']);
    return { ok: true, data: { id } };
  }

  /** Xoá NHÓM lô nhưng GIỮ NGUYÊN các lô bên trong (chỉ gỡ `group_id`) —
   * đúng chi tiết hệ thống hiện trong hộp xác nhận: "Các lô QC bên trong vẫn
   * được giữ nguyên." */
  function removeLotGroup(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM lot_groups WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const usedByLevel = (db.prepare('SELECT COUNT(*) as c FROM test_levels WHERE qc_lot_id IN (SELECT id FROM qc_lots WHERE group_id=?)').get(id) as { c: number }).c;
    if (usedByLevel) {
      return { ok: false, error: { code: 'used-by-assay', message: 'Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xoá nhóm.' } };
    }
    try {
      inTransaction(() => {
        db.prepare('UPDATE qc_lots SET group_id=NULL WHERE group_id=?').run(id);
        db.prepare('DELETE FROM lot_groups WHERE id=?').run(id);
        writeAudit(db, actor, 'Xoá nhóm lô QC', `Xoá nhóm "${existing.name}" (các lô bên trong được giữ lại)`, existing.name);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá nhóm lô thất bại.' } };
    }
    notifyChanged(['qc_lots', 'lot_groups']);
    return { ok: true, data: { id } };
  }

  /** Dừng một nhóm lô đang chạy. CHỈ đổi trạng thái; chiều ngược lại nằm ở
   * `activateLotGroup()` bên dưới và áp lại Mean/SD đã lưu của nhóm. */
  function stopLotGroup(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name, status FROM lot_groups WHERE id=?').get(id) as { id: string; name: string; status: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const lotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(id) as { id: string }[]).map(r => r.id);
    if (existing.status === 'stopped' || existing.status === 'planned' || !lotGroupInUse(lotIds)) {
      return { ok: false, error: { code: 'not-stoppable', message: 'Chỉ dừng được nhóm lô đang chạy.' } };
    }
    inTransaction(() => {
      db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(nowIso(), id);
      writeAudit(db, actor, 'Dừng nhóm lô QC', `Dừng nhóm "${existing.name}"`, existing.name);
    });
    notifyChanged(['lot_groups']);
    return { ok: true, data: { id } };
  }


  function lotTargetSnapshot(level: { qc_lot_id?: string | null; mean: number | null; sd: number | null; low: number | null; high: number | null; mean_sd_history_json?: string | null }, lotId: string) {
    const finite = (value: unknown) => Number.isFinite(Number(value));
    if (level.qc_lot_id === lotId && finite(level.mean) && finite(level.sd)) {
      return { mean: Number(level.mean), sd: Number(level.sd), low: level.low, high: level.high };
    }
    let history: { qcLotId?: string; mean?: number | null; sd?: number | null; low?: number | null; high?: number | null }[] = [];
    try { const parsed = JSON.parse(level.mean_sd_history_json || '[]'); if (Array.isArray(parsed)) history = parsed; } catch { history = []; }
    const found = [...history].reverse().find(entry => entry.qcLotId === lotId && finite(entry.mean) && finite(entry.sd));
    return found ? { mean: Number(found.mean), sd: Number(found.sd), low: found.low ?? null, high: found.high ?? null } : null;
  }


  function activateLotGroup(input: { id: unknown }, actor: Actor): IpcResult<{ status: 'applied' | 'already-active' | 'unready'; applied: number; stoppedGroups: string[] }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const group = db.prepare('SELECT id, name FROM lot_groups WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!group) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const lots = db.prepare('SELECT id, lot_no, level, opened FROM qc_lots WHERE group_id=?').all(id) as
      { id: string; lot_no: string; level: number; opened: string }[];
    if (!lots.length) return { ok: false, error: { code: 'empty-group', message: 'Nhóm lô này chưa có lô QC nào.' } };

    type Candidate = { levelId: string; testId: string; lotId: string; lotNo: string; level: number;
      mean: number; sd: number; low: number | null; high: number | null; prevLotId: string | null;
      prevMean: number | null; prevSd: number | null; prevLow: number | null; prevHigh: number | null;
      prevApplied: 'mfg' | 'lab'; prevEffectiveFrom: string; historyJson: string | null };
    const candidates: Candidate[] = [];
    for (const lot of lots) {
      const levels = db.prepare(`SELECT tl.id, tl.test_id, tl.qc_lot_id, tl.mean, tl.sd, tl.low, tl.high, tl.applied, tl.mean_sd_effective_from, tl.mean_sd_history_json
        FROM test_levels tl WHERE tl.level=?`).all(lot.level) as {
          id: string; test_id: string; qc_lot_id: string | null; mean: number | null; sd: number | null;
          low: number | null; high: number | null; applied: 'mfg' | 'lab'; mean_sd_effective_from: string; mean_sd_history_json: string | null }[];
      for (const level of levels) {
        if (level.qc_lot_id === lot.id) continue; // đã dùng đúng lô này
        // Ưu tiên số ĐÃ NHẬP DỰ KIẾN cho đúng (xét nghiệm, mức, lô) này; chỉ
        // khi không có mới tìm ngược trong lịch sử (nhóm từng dùng rồi quay
        // lại). Ngược thứ tự sẽ áp số CŨ đè lên số người dùng vừa chuẩn bị.
        const plannedRow = db.prepare('SELECT mean, sd, low, high FROM planned_targets WHERE test_id=? AND level=? AND qc_lot_id=?')
          .get(level.test_id, lot.level, lot.id) as { mean: number | null; sd: number | null; low: number | null; high: number | null } | undefined;
        const snapshot = plannedRow && plannedRow.mean != null && plannedRow.sd != null && plannedRow.sd > 0
          ? { mean: plannedRow.mean, sd: plannedRow.sd, low: plannedRow.low, high: plannedRow.high }
          : lotTargetSnapshot(level, lot.id);
        if (!snapshot || !(snapshot.sd > 0)) continue;
        candidates.push({
          levelId: level.id, testId: level.test_id, lotId: lot.id, lotNo: lot.lot_no, level: lot.level,
          mean: snapshot.mean, sd: snapshot.sd, low: snapshot.low, high: snapshot.high,
          prevLotId: level.qc_lot_id, prevMean: level.mean, prevSd: level.sd, prevLow: level.low, prevHigh: level.high,
          prevApplied: level.applied, prevEffectiveFrom: level.mean_sd_effective_from, historyJson: level.mean_sd_history_json,
        });
      }
    }

    if (!candidates.length) {
      // Không có gì mới để áp: nếu nhóm đang thực sự được dùng (có mức nào
      // trỏ vào lô của nó) thì chỉ cần gỡ nhãn "đã dừng".
      if (!lotGroupInUse(lots.map(lot => lot.id))) {
        return { ok: false, error: { code: 'unready', message: 'Chưa mức QC nào có Mean/SD đã lưu cho lô của nhóm này. Hãy nhập Mean/SD cho lô mới trước khi kích hoạt.' } };
      }
      inTransaction(() => {
        db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=?").run(id);
        writeAudit(db, actor, 'Kích hoạt nhóm lô QC', `Nhóm "${group.name}" đã đang được dùng, không có mức nào cần áp thêm`, group.name);
      });
      notifyChanged(['lot_groups']);
      return { ok: true, data: { status: 'already-active', applied: 0, stoppedGroups: [] } };
    }

    // Nhóm lô nào đang giữ các mức bị thay thế thì bị DỪNG — nhưng chỉ khi
    // nó KHÔNG CÒN mức QC nào dùng nữa (kiểm lại SAU khi đã áp, bên trong
    // transaction). hệ thống dừng ngay không kiểm: nếu chỉ một phần xét nghiệm
    // có Mean/SD cho lô mới thì nhóm cũ vẫn bị gắn "Đã dừng" trong khi những
    // xét nghiệm ở lại vẫn dùng lô của nó — mà nhóm `stopped` bị loại khỏi
    // "mức QC đang vận hành", nên các xét nghiệm đó BIẾN MẤT khỏi thẻ Nhập QC
    // và Westgard (dựng lại được: 3 xét nghiệm dùng nhóm A, chỉ 1 có số cho
    // nhóm B, kích hoạt B → 2 xét nghiệm còn lại mất sạch mức QC).
    const replacedGroupIds = new Set<string>();
    for (const candidate of candidates) {
      if (!candidate.prevLotId) continue;
      const owner = db.prepare('SELECT group_id FROM qc_lots WHERE id=?').get(candidate.prevLotId) as { group_id: string | null } | undefined;
      if (owner && owner.group_id && owner.group_id !== id) replacedGroupIds.add(owner.group_id);
    }
    const stoppedIds = new Set<string>();
    const at = nowIso();
    inTransaction(() => {
      for (const candidate of candidates) {
        const oldLot = candidate.prevLotId ? db.prepare('SELECT lot_no, opened FROM qc_lots WHERE id=?').get(candidate.prevLotId) as
          { lot_no: string; opened: string } | undefined : undefined;
        const nextFrom = lots.find((lot) => lot.id === candidate.lotId)?.opened || at.slice(0, 10);
        // `test_levels` KHÔNG có cột `lot` — số lô lấy qua `qc_lot_id`
        // (khác hệ thống, nơi mức QC giữ cả nhãn lô dạng chuỗi).
        // Nguồn 'mfg' (NSX), KHÔNG phải 'lab' — cùng bug/lý do đã sửa ở
        // `createLotTransition`'s cascade: `applyTargetPick()` hệ thống (dùng
        // chung bởi Mean/SD tab VÀ kích hoạt nhóm lô) LUÔN ghi `source:'mfg'`;
        // 'lab' (PXN) chỉ dành riêng cho luồng "Xây dựng dải PXN" ở trang
        // Nhập QC & Biểu đồ (`RangeWorkflowCommand`).
        db.prepare('UPDATE test_levels SET qc_lot_id=?, mean=?, sd=?, low=?, high=?, applied=?, mean_sd_history_json=?, mean_sd_effective_from=? WHERE id=?')
          .run(candidate.lotId, candidate.mean, candidate.sd, candidate.low, candidate.high, 'mfg',
            appendMeanSdHistory(candidate.historyJson,
              { mean: candidate.prevMean, sd: candidate.prevSd, low: candidate.prevLow, high: candidate.prevHigh,
                qcLotId: candidate.prevLotId || '', lot: oldLot?.lot_no || '',
                effectiveFrom: candidate.prevEffectiveFrom || oldLot?.opened || '', effectiveTo: nextFrom,
                source: candidate.prevApplied }, at),
            nextFrom, candidate.levelId);
        // Đã áp rồi thì hàng dự kiến hết vai trò; giữ lại sẽ áp lại đúng số
        // đó ở lần kích hoạt sau, đè lên mọi thay đổi Mean/SD ở giữa.
        db.prepare('DELETE FROM planned_targets WHERE test_id=? AND level=? AND qc_lot_id=?')
          .run(candidate.testId, candidate.level, candidate.lotId);
      }
      for (const groupId of replacedGroupIds) {
        const lotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(groupId) as { id: string }[]).map((r) => r.id);
        if (lotGroupInUse(lotIds)) continue; // còn xét nghiệm khác dùng → vẫn đang chạy
        db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(at, groupId);
        stoppedIds.add(groupId);
      }
      db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=?").run(id);
      writeAudit(db, actor, 'Kích hoạt nhóm lô QC',
        `Nhóm "${group.name}": áp Mean/SD cho ${candidates.length} mức QC`
        + (stoppedIds.size ? `, dừng ${stoppedIds.size} nhóm lô bị thay thế` : ''), group.name);
    });
    notifyChanged(['lot_groups', 'qc_lots', 'test_levels', 'tests', 'planned_targets']);
    return { ok: true, data: { status: 'applied', applied: candidates.length, stoppedGroups: [...stoppedIds] } };
  }

  /** Xoá hồ sơ chuyển lô. Hồ sơ ĐÃ KẾT LUẬN không xoá được: kết luận là bản
   * ghi đã áp vào cấu hình, xoá đi thì mất dấu vết vì sao Mean/SD đổi. */

  function lotLabel(lotId: string): string {
    const lot = db.prepare('SELECT lot_no, level FROM qc_lots WHERE id=?').get(lotId) as { lot_no: string; level: number } | undefined;
    return lot ? `${lot.lot_no} · Mức ${lot.level}` : 'Chưa chọn lô';
  }

  function removeLotTransition(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, status, from_lot_id, to_lot_id FROM lot_transitions WHERE id=?').get(id) as
      { id: string; status: string; from_lot_id: string; to_lot_id: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ chuyển lô.' } };
    if (existing.status === 'accepted') {
      return { ok: false, error: { code: 'accepted-applied', message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công.' } };
    }
    const detail = `${lotLabel(existing.from_lot_id)} → ${lotLabel(existing.to_lot_id)}`;
    inTransaction(() => {
      db.prepare('DELETE FROM lot_transitions WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá hồ sơ chuyển lô', detail, 'Chuyển tiếp lô');
    });
    notifyChanged(['lot_transitions']);
    return { ok: true, data: { id } };
  }

  return {
    listInstruments, saveInstrument, removeInstrument, listTests, saveTest, listTestLevels, saveTestLevel,
    listRuleScopes, saveRuleScope,
    setTeaRefValue, restoreTeaRefDefaults, addTeaAnalyte, removeTest, removePanel, listLots, saveLot, previewLotRename, removeLot, listLotGroups, saveLotGroup, removeLotGroup, stopLotGroup, activateLotGroup, listPanels, savePanel,
    listLotTransitions, createLotTransition, removeLotTransition,
    listTeaRefs, saveTeaRef, removeTeaRef, removeTeaLabProfile,
    listPlannedTargets, savePlannedTargets,
  };
}

export type ConfigHandlers = ReturnType<typeof createConfigHandlers>;



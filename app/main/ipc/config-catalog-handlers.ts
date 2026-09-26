// Cấu hình chung — máy xét nghiệm, xét nghiệm (kể cả gán nhiều máy), mức QC
// với Mean/SD, phạm vi luật Westgard theo xét nghiệm và Panel QC. Tách khỏi
// `config-handlers.ts` ngày 2026-09-26 (kế hoạch kiến trúc C.1); tách thuần,
// không đổi hành vi. Renderer chỉ gọi các hàm này qua bảng thao tác IPC.
import type { Db } from '../db/sqlite-like';
// Kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung, không khai lại: trước
// 2026-09-10 các hàm này khai `IpcResult<unknown>` nên renderer tin vào
// một hình dạng mà không gì bảo đảm.
import type { Instrument, QcPanel, Test, TestLevel } from '../../shared/qc-api';
import { cleanId, cleanText, uid, sameText } from '../domain/text-utils';
import { validateInstrument, validateTest, validateTestLevel, appendMeanSdHistory, validatePanel, type InstrumentInput, type TestInput, type PreparedTest, type TestLevelInput, type PanelInput } from '../domain/manage-validation';
import { parseRuleScopes, serializeRuleScopes, parseRuleActions, effectiveRuleConfigList, type RuleScopesMap } from '../domain/rule-config';
import { WG_RULE_REGISTRY, isAllowedRuleScope, type RuleScope } from '../domain/westgard-rules';
import { readGlobalRules } from '../db/rule-settings';
import { countOperationalLevels, listOperationalLevels } from '../db/operational-levels';
import { isoLocalDate } from '../domain/local-date';
import { type IpcResult, nowIso } from './shared';
import { writeCommand, type WriteSteps } from './write-command';
import { isLotGroupInUse } from '../db/lot-groups';

export function createCatalogConfigHandlers(db: Db) {
  const lotGroupInUse = (lotIds: string[]): boolean => isLotGroupInUse(db, lotIds);

  function listInstruments() {
    return db.prepare('SELECT * FROM instruments ORDER BY name').all();
  }

  const saveInstrument = writeCommand(db, 'saveInstrument', 'admin', (w, input: { id?: string; data: InstrumentInput }): IpcResult<Instrument> => {
    const id = input.id || '';
    const existingNames = (db.prepare('SELECT name FROM instruments WHERE id != ?').all(id) as { name: string }[]).map(r => r.name);
    const result = validateInstrument(input.data, existingNames);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, manufacturer, model, serial, section, active } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id FROM instruments WHERE id=?').get(id);
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm cần cập nhật.' } };
      const saved = w.commit((tx) => {
        db.prepare('UPDATE instruments SET name=?,manufacturer=?,model=?,serial=?,section=?,active=? WHERE id=?')
          .run(name, manufacturer, model, serial, section, active ? 1 : 0, id);
        tx.audit('Sửa máy xét nghiệm', `Cập nhật máy "${name}"`, name);
        tx.changed(['instruments']);
        return db.prepare('SELECT * FROM instruments WHERE id=?').get(id);
      });
      return { ok: true, data: saved };
    }
    const newId = cleanId(uid());
    const saved = w.commit((tx) => {
      db.prepare('INSERT INTO instruments(id,name,manufacturer,model,serial,section,active) VALUES (?,?,?,?,?,?,?)')
        .run(newId, name, manufacturer, model, serial, section, active ? 1 : 0);
      tx.audit('Thêm máy xét nghiệm', `Tạo máy "${name}"`, name);
      tx.changed(['instruments']);
      return db.prepare('SELECT * FROM instruments WHERE id=?').get(newId);
    });
    return { ok: true, data: saved };
  });

  const removeInstrument = writeCommand(db, 'removeInstrument', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM instruments WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm.' } };
    const testCount = (db.prepare('SELECT COUNT(*) AS n FROM tests WHERE instrument_id=?').get(id) as { n: number }).n;
    if (testCount > 0) return { ok: false, error: { code: 'in-use', message: `Không thể xoá — máy này đang gắn với ${testCount} xét nghiệm. Xoá/chuyển các xét nghiệm đó trước.` } };
    const panelCount = (db.prepare('SELECT COUNT(*) AS n FROM qc_panels WHERE instrument_id=?').get(id) as { n: number }).n;
    if (panelCount > 0) return { ok: false, error: { code: 'in-use', message: `Không thể xoá — máy này đang gắn với ${panelCount} Panel QC. Xoá/chuyển các Panel QC đó trước.` } };
    w.commit((tx) => {
      db.prepare('DELETE FROM instruments WHERE id=?').run(id);
      tx.audit('Xoá máy xét nghiệm', `Xoá "${existing.name}"`, existing.name);
      tx.changed(['instruments']);
    });
    return { ok: true, data: { id } };
  });

  // Thứ tự hiển thị xét nghiệm (danh mục xét nghiệm, danh sách chọn trong
  // Panel QC...) LÀ thứ tự tạo (xét nghiệm thêm trước nằm trước). `ORDER BY
  // name` trước đây tự sắp lại theo alphabet, làm mất thứ tự đó. `rowid`
  // (ngầm định của SQLite cho bảng có PK dạng TEXT) chính là thứ tự chèn.
  function listTests() {
    return db.prepare('SELECT * FROM tests ORDER BY rowid').all();
  }

  /** Form danh mục mới cho phép gán một analyte vào nhiều máy. Mỗi máy vẫn
   * là một hàng `tests` riêng để Mean/SD, lô, điểm QC và Westgard không bị
   * trộn; `analyte_id` chỉ gom các hàng đó thành một mục ở giao diện. Gọi từ
   * `saveTest` (đã qua cổng quyền), ghi qua đúng lần ghi `w` của nó. */
  function saveTestAssignments(w: WriteSteps, input: { id?: string; data: TestInput }): IpcResult<Test> {
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
    const saved = w.commit((tx) => {
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
      tx.audit(action, detail, prepared[0].data.name);
      tx.changed(['tests', 'test_levels'], savedIds);
      const representativeId = input.id && savedIds.includes(input.id) ? input.id : savedIds[0];
      return db.prepare('SELECT * FROM tests WHERE id=?').get(representativeId) as Test;
    });
    return { ok: true, data: { ...saved, assignment_ids: savedIds } };
  }

  const saveTest = writeCommand(db, 'saveTest', 'admin', (w, input: { id?: string; data: TestInput }): IpcResult<Test> => {
    if (Array.isArray(input.data.instrumentIds)) return saveTestAssignments(w, input);
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
        w.commit((tx) => {
          db.prepare(`UPDATE tests SET name=?,instrument_id=?,unit=?,decimal_places=?,tea=?,section=?,
            tea_source=?,tea_ref_key=?,method=?,reagent=?,cusum_on=?,cusum_k=?,cusum_h=?,active=? WHERE id=?`)
            .run(name, result.data.instrumentId, unit, decimalPlaces, tea, section,
              teaSource, teaRefKey, method, reagent, cusumOn ? 1 : 0, cusumK, cusumH, active ? 1 : 0, id);
          if (existing.instrument_id !== result.data.instrumentId) {
            removedPanelMemberships = Number(db.prepare(`DELETE FROM qc_panel_tests
              WHERE test_id=? AND panel_id IN (SELECT id FROM qc_panels WHERE instrument_id!=?)`)
              .run(id, result.data.instrumentId).changes);
          }
          tx.audit('Sửa xét nghiệm', `Cập nhật xét nghiệm "${name}"`, name);
          tx.changed(removedPanelMemberships ? ['tests', 'qc_panels', 'qc_panel_tests'] : ['tests'], [id]);
        });
      } catch (e) {
        return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Cập nhật xét nghiệm thất bại.' } };
      }
      return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    try {
      w.commit((tx) => {
        db.prepare(`INSERT INTO tests(id,name,instrument_id,unit,decimal_places,tea,section,tea_source,tea_ref_key,method,reagent,cusum_on,cusum_k,cusum_h,active)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(newId, name, result.data.instrumentId, unit, decimalPlaces, tea, section, teaSource, teaRefKey, method, reagent, cusumOn ? 1 : 0, cusumK, cusumH, active ? 1 : 0);
        db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,1)').run(`${newId}:1`, newId);
        tx.audit('Thêm xét nghiệm', `Tạo xét nghiệm "${name}"`, name);
        tx.changed(['tests'], [newId]);
      });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Tạo xét nghiệm thất bại.' } };
    }
    return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(newId) };
  });

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

  const saveTestLevel = writeCommand(db, 'saveTestLevel', 'admin', (w, input: { testId: string; data: TestLevelInput }): IpcResult<TestLevel> => {
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
      // Lô đã hết dùng bị khoá toàn bộ hàng, không gán Mean/SD mới.
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
    const saved = w.commit((tx) => {
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
      tx.audit(existing ? 'Sửa mức QC' : 'Thêm mức QC', `Mức ${level} của xét nghiệm "${test.name}": Mean=${mean ?? '—'} SD=${sd ?? '—'}`, test.name);
      tx.changed(['test_levels', 'lot_groups', 'planned_targets'], [testId]);
      return db.prepare('SELECT * FROM test_levels WHERE id=?').get(levelId);
    });
    return { ok: true, data: saved };
  });

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

  const saveRuleScope = writeCommand(db, 'saveRuleScope', 'admin', (w, testId: string, ruleId: string, scope: RuleScope | ''): IpcResult<{ ruleId: string; scope: RuleScope | '' }> => {
    const test = db.prepare('SELECT id, name, rule_scopes_json FROM tests WHERE id=?').get(testId) as { id: string; name: string; rule_scopes_json: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    if (scope !== '' && !isAllowedRuleScope(ruleId, scope)) return { ok: false, error: { code: 'invalid-scope', message: 'Phạm vi này không được hỗ trợ bởi luật Westgard đã chọn.' } };
    const overrides: RuleScopesMap = parseRuleScopes(test.rule_scopes_json);
    if (scope) overrides[ruleId] = scope; else delete overrides[ruleId];
    w.commit((tx) => {
      db.prepare('UPDATE tests SET rule_scopes_json=? WHERE id=?').run(serializeRuleScopes(overrides), testId);
      tx.audit('Sửa phạm vi luật Westgard', `Luật ${ruleId} chuyển thành ${scope ? `phạm vi ${scope}` : 'phạm vi SOP khuyến nghị'}`, test.name);
      tx.changed(['tests'], [testId]);
    });
    return { ok: true, data: { ruleId, scope } };
  });

  function listPanels() {
    const panels = db.prepare('SELECT * FROM qc_panels ORDER BY name').all() as Omit<QcPanel, 'testIds'>[];
    // `ORDER BY` là BẮT BUỘC, không phải trang trí: thiếu nó thì SQLite đọc
    // thẳng từ index khoá chính `(panel_id, test_id)` và trả về theo test_id
    // ngẫu nhiên. `rowid` là chốt phụ cho dòng `position` NULL (backup cũ
    // phục hồi lại) — thứ tự chèn chính là thứ tự trong backup.
    return panels.map(p => ({ ...p, testIds: (db.prepare('SELECT test_id FROM qc_panel_tests WHERE panel_id=? ORDER BY position, rowid').all(p.id) as { test_id: string }[]).map(r => r.test_id) }));
  }

  const savePanel = writeCommand(db, 'savePanel', 'admin', (w, input: { id?: string; data: PanelInput }): IpcResult<QcPanel> => {
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
    // MỌI id không tồn tại được coi như một xét nghiệm không thuộc máy đã
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
      w.commit((tx) => {
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
        tx.audit(id ? 'Sửa Panel QC' : 'Thêm Panel QC', `Panel "${name}" (${validTestIds.length} xét nghiệm)`, name);
        tx.changed(['qc_panels', 'qc_panel_tests']);
      });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Lưu Panel QC thất bại.' } };
    }
    const panelRow = db.prepare('SELECT * FROM qc_panels WHERE id=?').get(panelId) as Omit<QcPanel, 'testIds'>;
    return { ok: true, data: { ...panelRow, testIds: validTestIds } };
  });


  /** Chỉ xoá cấu hình xét nghiệm hoàn toàn mới, chưa phát sinh dữ liệu.
   * Điểm QC (kể cả đã huỷ), Mean/SD, lô đang gán, lịch sử Mean/SD, Sigma hay
   * hồ sơ NCE đều là hồ sơ chất lượng phải giữ lại. Khi đã có một trong các
   * dấu vết đó, đường đúng là chuyển xét nghiệm sang `active=0`; tuyệt đối
   * không xoá dữ liệu để làm biến mất lịch sử. */
  const removeTest = writeCommand(db, 'removeTest', 'admin', (w, input: { id: unknown; ids?: unknown }): IpcResult<{ id: string; pointsCount: number }> => {
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
      w.commit((tx) => {
        db.prepare(`DELETE FROM test_levels WHERE test_id IN (${existingPlaceholders})`).run(...existingIds);
        db.prepare(`DELETE FROM qc_panel_tests WHERE test_id IN (${existingPlaceholders})`).run(...existingIds);
        db.prepare(`DELETE FROM tests WHERE id IN (${existingPlaceholders})`).run(...existingIds);
        tx.audit('Xoá xét nghiệm', `Xoá cấu hình chưa phát sinh dữ liệu "${existing.name}" trên ${existingIds.length} máy`, existing.name);
        tx.changed(['tests', 'test_levels', 'qc_panels'], existingIds);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá xét nghiệm thất bại.' } };
    }
    return { ok: true, data: { id, pointsCount: 0 } };
  });


  const removePanel = writeCommand(db, 'removePanel', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
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
      w.commit((tx) => {
        db.prepare('DELETE FROM qc_panel_tests WHERE panel_id=?').run(id);
        db.prepare('DELETE FROM qc_panels WHERE id=?').run(id);
        tx.audit('Xoá Panel QC', `Xoá Panel QC "${existing.name}"`, existing.name);
        tx.changed(['qc_panels']);
      });
    } catch (e) {
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá Panel QC thất bại.' } };
    }
    return { ok: true, data: { id } };
  });

  return { listInstruments, saveInstrument, removeInstrument, listTests, saveTest, listTestLevels, saveTestLevel, listRuleScopes, saveRuleScope, listPanels, savePanel, removeTest, removePanel };
}

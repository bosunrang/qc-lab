// Cấu hình chung — bảng TEa tham chiếu (CLIA, Ricos/Westgard BV, EFLM) và
// hồ sơ TEa chuẩn hoá của phòng xét nghiệm. Tách khỏi `config-handlers.ts`
// ngày 2026-09-26 (kế hoạch kiến trúc C.1); tách thuần, không đổi hành vi.
import type { Db } from '../db/sqlite-like';
// Kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung, không khai lại: trước
// 2026-09-10 các hàm này khai `IpcResult<unknown>` nên renderer tin vào
// một hình dạng mà không gì bảo đảm.
import type { TeaRef } from '../../shared/qc-api';
import { cleanId, cleanText, uid } from '../domain/text-utils';
import { validateTeaRef, TEA_LAB_SOURCE_LABELS, type TeaRefInput } from '../domain/tea-ref-validation';
import { type IpcResult } from './shared';
import { writeCommand } from './write-command';

export function createTeaRefHandlers(db: Db) {

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

  const saveTeaRef = writeCommand(db, 'saveTeaRef', 'admin', (w, input: { id?: string; data: TeaRefInput }): IpcResult<TeaRef> => {
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
      const saved = w.commit((tx) => {
        db.prepare(`UPDATE tea_refs SET name=?,unit=?,section=?,lab=?,lab_source=?,lab_prepared_by=?,lab_next_review_date=?,sources_json=? WHERE id=?`)
          .run(name, unit, section, labValue, labSource, preparedBy, nextReviewDate, sourcesJson, id);
        tx.audit(existing.lab == null ? 'Thiết lập TEa chuẩn hóa' : 'Cập nhật TEa chuẩn hóa', detailOf(existing.lab), name);
        tx.changed(['tea_refs']);
        return db.prepare('SELECT * FROM tea_refs WHERE id=?').get(id);
      });
      return { ok: true, data: saved };
    }
    const newId = cleanId(uid());
    const saved = w.commit((tx) => {
      db.prepare(`INSERT INTO tea_refs(id,name,unit,section,lab,lab_source,lab_prepared_by,lab_next_review_date,sources_json)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(newId, name, unit, section, labValue, labSource, preparedBy, nextReviewDate, sourcesJson);
      tx.audit('Thiết lập TEa chuẩn hóa', detailOf(null), name);
      tx.changed(['tea_refs']);
      return db.prepare('SELECT * FROM tea_refs WHERE id=?').get(newId);
    });
    return { ok: true, data: saved };
  });


  const setTeaRefValue = writeCommand(db, 'setTeaRefValue', 'admin', (w, input: { analyteId: unknown; field: unknown; value: unknown; name?: unknown; unit?: unknown; section?: unknown }): IpcResult<{ analyteId: string }> => {
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
    if (!existing && value == null) return w.noChange({ analyteId });
    const label = field === 'clia' ? 'CLIA' : 'Ricos';
    w.commit((tx) => {
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
      tx.audit('Sửa bảng TEa tham chiếu',
        value == null ? `Bỏ ghi đè TEa ${label} của "${name}"` : `Đặt TEa ${label} của "${name}" = ${value}%`, name);
      tx.changed(['tea_refs']);
    });
    return { ok: true, data: { analyteId } };
  });


  const addTeaAnalyte = writeCommand(db, 'addTeaAnalyte', 'admin', (w, input: { name: unknown; abbreviation?: unknown; matrix?: unknown; unit?: unknown; section?: unknown; clia?: unknown; ricos?: unknown; cliaRule?: unknown; cliaAbsolute?: unknown; cliaAbsoluteUnit?: unknown }): IpcResult<{ analyteId: string }> => {
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
    w.commit((tx) => {
      db.prepare(`INSERT INTO tea_refs(id,analyte_id,name,abbreviation,matrix,unit,section,clia,ricos,clia_rule,clia_absolute,clia_absolute_unit)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        cleanId(uid()), analyteId, name, cleanText(input.abbreviation, 40).trim(), cleanText(input.matrix, 80).trim(),
        cleanText(input.unit, 40).trim(), cleanText(input.section, 80).trim(), num(input.clia), num(input.ricos), cliaRule, cliaAbsolute,
        cleanText(input.cliaAbsoluteUnit, 40).trim() || cleanText(input.unit, 40).trim(),
      );
      tx.audit('Thêm xét nghiệm tham chiếu', `Thêm "${name}" vào bảng TEa tham chiếu`, name);
      tx.changed(['tea_refs']);
    });
    return { ok: true, data: { analyteId } };
  });

  /** Bỏ MỌI ghi đè CLIA/Ricos của 1 analyte (nút "Khôi phục" hệ thống) — giữ
   * lại hồ sơ TEa PXN nếu có, chỉ trả 2 giá trị tham chiếu về mặc định. */
  const restoreTeaRefDefaults = writeCommand(db, 'restoreTeaRefDefaults', 'admin', (w, input: { analyteId: unknown }): IpcResult<{ analyteId: string }> => {
    const analyteId = cleanId(String(input.analyteId || ''));
    const existing = db.prepare('SELECT id, name, lab FROM tea_refs WHERE analyte_id=?').get(analyteId) as
      { id: string; name: string; lab: number | null } | undefined;
    if (!existing) return w.noChange({ analyteId });
    w.commit((tx) => {
      if (existing.lab == null) db.prepare('DELETE FROM tea_refs WHERE id=?').run(existing.id);
      else db.prepare('UPDATE tea_refs SET clia=NULL, ricos=NULL, clia_rule=\'\', clia_absolute=NULL, clia_absolute_unit=\'\' WHERE id=?').run(existing.id);
      tx.audit('Khôi phục TEa tham chiếu', `Bỏ ghi đè CLIA/Ricos của "${existing.name}"`, existing.name);
      tx.changed(['tea_refs']);
    });
    return { ok: true, data: { analyteId } };
  });

  const removeTeaRef = writeCommand(db, 'removeTeaRef', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM tea_refs WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa.' } };
    w.commit((tx) => {
      db.prepare('DELETE FROM tea_refs WHERE id=?').run(id);
      tx.audit('Xoá hồ sơ TEa', `Xoá "${existing.name}"`, existing.name);
      tx.changed(['tea_refs']);
    });
    return { ok: true, data: { id } };
  });


  const removeTeaLabProfile = writeCommand(db, 'removeTeaLabProfile', 'admin', (w, input: { id: unknown }): IpcResult<{ id: string; removedRecord: boolean }> => {
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name, clia, ricos, clia_absolute, abbreviation, matrix, lab FROM tea_refs WHERE id=?').get(id) as
      { id: string; name: string; clia: number | null; ricos: number | null; clia_absolute: number | null; abbreviation: string; matrix: string; lab: number | null } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa.' } };
    if (existing.lab == null) return w.noChange({ id, removedRecord: false });
    const isCustomAnalyte = !!(existing.abbreviation || existing.matrix);
    const removedRecord = !isCustomAnalyte && existing.clia == null && existing.ricos == null && existing.clia_absolute == null;
    w.commit((tx) => {
      db.prepare(`UPDATE tea_refs SET lab=NULL, lab_source='', lab_prepared_by='', lab_next_review_date='', sources_json='{}' WHERE id=?`).run(id);
      if (removedRecord) db.prepare('DELETE FROM tea_refs WHERE id=?').run(id);
      tx.audit('Xóa TEa chuẩn hóa', `${existing.name} · ${Number(existing.lab).toFixed(2)}%`, existing.name);
      tx.changed(['tea_refs']);
    });
    return { ok: true, data: { id, removedRecord } };
  });

  return { listTeaRefs, saveTeaRef, setTeaRefValue, addTeaAnalyte, restoreTeaRefDefaults, removeTeaRef, removeTeaLabProfile };
}

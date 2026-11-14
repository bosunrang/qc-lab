// Đọc dữ liệu TEa từ CSDL cho lớp giải thuần `domain/sigma-tea-core.ts`:
// hồ sơ TEa của PXN (kèm TEa theo mức) và các cột TEa của một xét nghiệm.
// Dùng chung cho trang Six Sigma, cổng Bias khi lập dải và ngoại kiểm, để mọi
// nơi giải TEa trên cùng một dữ liệu.
import type { Db } from './sqlite-like';
import { resolveOperationalTea, type OperationalTeaCore, type TeaRefCore, type TeaTestCore } from '../domain/sigma-tea-core';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE, type TeaCatalogItem } from '../domain/tea-catalog';

/** Mọi hồ sơ TEa tham chiếu, mỗi hồ sơ kèm TEa riêng theo mức QC. */
export function loadTeaRefs(db: Db): (TeaRefCore & { id: string })[] {
  const refs = db.prepare('SELECT id,name,analyte_id,aliases_json,lab,lab_source,clia,ricos,clia_rule,clia_absolute,clia_absolute_unit FROM tea_refs').all() as (TeaRefCore & { id: string })[];
  const levelDefaults = db.prepare('SELECT tea_ref_id,level,tea FROM tea_ref_level_defaults').all() as
    { tea_ref_id: string; level: number; tea: number }[];
  for (const ref of refs) ref.lab_level_defaults = levelDefaults.filter((item) => item.tea_ref_id === ref.id);
  return refs;
}

/** Các cột TEa của một xét nghiệm theo hình dạng lớp giải cần. Phải đọc cả 4
 * cột truy vết EFLM: cổng `hasTrace` của `resolveTea()` đọc chúng, thiếu thì
 * mọi xét nghiệm có `tea` đều được coi là "TEa EFLM đã truy vết". */
export function loadTeaTest(db: Db, testId: string): TeaTestCore | null {
  const test = db.prepare('SELECT name,tea_ref_key,unit,tea,tea_source,operational_tea_source,eflm_tea,eflm_analyte,eflm_ref,eflm_lookup_date FROM tests WHERE id=?').get(testId) as
    { name: string; tea_ref_key: string; unit: string; tea: number | null; tea_source: string; operational_tea_source: string; eflm_tea: number | null; eflm_analyte: string; eflm_ref: string; eflm_lookup_date: string } | undefined;
  if (!test) return null;
  return {
    name: test.name || '', tea_ref_key: test.tea_ref_key || '', unit: test.unit || '', tea: Number(test.tea) || 0,
    eflm_tea: test.eflm_tea,
    operational_tea_source: test.operational_tea_source || '',
    tea_source: test.tea_source || '', eflm_analyte: test.eflm_analyte || '', eflm_ref: test.eflm_ref || '', eflm_lookup_date: test.eflm_lookup_date || '',
  };
}

export type OperationalTea = OperationalTeaCore<TeaCatalogItem>;

/** Bộ giải TEa vận hành của nhiều xét nghiệm, đọc hồ sơ TEa một lần — xem
 * `resolveOperationalTea()` cho thứ tự nguồn. Xét nghiệm không tồn tại trả `null`. */
export function operationalTeaResolver(db: Db) {
  const refs = loadTeaRefs(db);
  const tests = new Map<string, TeaTestCore | null>();
  return (testId: string, targetMean?: number | null, level?: number | null): OperationalTea | null => {
    if (!tests.has(testId)) tests.set(testId, loadTeaTest(db, testId));
    const test = tests.get(testId);
    return test ? resolveOperationalTea(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE, targetMean, level) : null;
  };
}

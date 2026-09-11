// Cấu hình luật Westgard CHUNG toàn phòng xét nghiệm — module dữ liệu dùng
// chung, cùng vai trò với `operational-levels.ts`/`lot-lineage.ts`.
//
// Vì sao phải dùng chung chứ không để mỗi handler tự đọc `app_meta`: đây là
// tầng 2 của phép phân giải 3 lớp (ghi đè theo xét nghiệm → cấu hình chung →
// mặc định registry). `westgard-handlers.ts` ĐỌC/GHI nó cho panel "Cấu hình
// chung của luật", còn `config-handlers.ts` phải ĐỌC đúng cùng giá trị đó để
// nói cho người dùng biết ô "Theo cấu hình chung" trong modal Sửa xét nghiệm
// thực tế đang là gì. Hai nơi hiểu lệch nhau về một key `app_meta` chính là
// lớp lỗi "hai màn hình nói hai chuyện".
import type { Db } from './sqlite-like';
import { parseRuleActions, serializeRuleActions, type RuleActionsMap } from '../domain/rule-config';

export const RULES_META_KEY = 'westgardRules';

export function readGlobalRules(db: Db): RuleActionsMap {
  const row = db.prepare('SELECT value FROM app_meta WHERE key=?').get(RULES_META_KEY) as { value: string } | undefined;
  return parseRuleActions(row ? row.value : null);
}

export function writeGlobalRules(db: Db, map: RuleActionsMap): void {
  db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(RULES_META_KEY, serializeRuleActions(map));
}

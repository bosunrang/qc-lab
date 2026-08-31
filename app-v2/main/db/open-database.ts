import { DatabaseSync } from 'node:sqlite';
import { applySchema, SCHEMA_VERSION } from './schema';

export type Db = DatabaseSync;

/** Mở (hoặc tạo mới) file SQLite tại `filePath`, áp schema, trả về kết nối. */
export function openDatabase(filePath: string): Db {
  const db = new DatabaseSync(filePath);
  applySchema(db);
  const row = db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get() as { value: string } | undefined;
  if (!row) {
    db.prepare("INSERT INTO app_meta(key,value) VALUES('schemaVersion',?)").run(String(SCHEMA_VERSION));
    db.prepare('INSERT OR IGNORE INTO lab(id) VALUES (1)').run();
  }
  return db;
}

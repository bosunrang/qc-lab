// Nâng lịch schema 13 trên SQLite desktop và sql.js của bản xem trước.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema, readSchemaVersion, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { dumpAllTables, restoreAllTables } = require('../../app-dist/main/db/table-io.js');
const { createBrowserDatabase } = require('../../app-dist/mock/renderer/browser-mock/sqlite-shim.js');
const SQL = await require('sql.js')();

function legacy(db, invalidChild = false) {
  db.exec(`PRAGMA foreign_keys=OFF;
    DROP TABLE eqa_schedule_instruments; DROP TABLE eqa_schedule;
    CREATE TABLE eqa_schedule (
      id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES eqa_programs(id), year INTEGER NOT NULL,
      round TEXT NOT NULL, round_no INTEGER NOT NULL, receive_date TEXT NOT NULL DEFAULT '',
      run_date TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL, assignee TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL DEFAULT '', submitted_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '', UNIQUE(program_id,year,round_no)
    );
    CREATE TABLE eqa_schedule_instruments (
      schedule_id TEXT NOT NULL REFERENCES eqa_schedule(id), instrument_id TEXT NOT NULL REFERENCES instruments(id),
      submitted_at TEXT NOT NULL DEFAULT '', submitted_by TEXT NOT NULL DEFAULT '', PRIMARY KEY(schedule_id,instrument_id)
    );
    INSERT INTO eqa_programs(id,name,provider,sample_type) VALUES ('legacy-p','Sinh hóa','TT','Sinh hóa');
    INSERT INTO instruments(id,name) VALUES ('legacy-i','AU');
    INSERT INTO eqa_schedule VALUES ('legacy-s','legacy-p',2026,'ĐỢT 11',11,'2026-11-01','2026-11-18','2026-11-19','KTV','Ghi chú cũ','2026-11-18T10:00:00Z','Người nộp','2026-11-01T08:00:00Z','2026-11-18T10:00:00Z');
    UPDATE app_meta SET value='13' WHERE key='schemaVersion';
  `);
  db.prepare('INSERT INTO eqa_schedule_instruments VALUES (?,?,?,?)').run('legacy-s', invalidChild?'missing-i':'legacy-i', '2026-11-18T10:00:00Z', 'Người nộp');
  db.exec('PRAGMA foreign_keys=ON;');
}

for (const [name, create] of [['desktop',()=>openDatabase(':memory:')], ['trình duyệt',()=>createBrowserDatabase(SQL,applySchema)]]) {
  test(`schema 14 (${name}): bỏ khoá chung, giữ mã lịch, dấu nộp và khoá ngoại`, () => {
    const db = create();
    try {
      legacy(db);
      const before = {...db.prepare('SELECT * FROM eqa_schedule').get()};
      const child = {...db.prepare('SELECT * FROM eqa_schedule_instruments').get()};
      applySchema(db);
      assert.equal(readSchemaVersion(db),SCHEMA_VERSION);
      assert.deepEqual({...db.prepare('SELECT * FROM eqa_schedule').get()}, {...before,sample_type:'Sinh hóa'});
      assert.deepEqual({...db.prepare('SELECT * FROM eqa_schedule_instruments').get()},child);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
      assert.ok(db.prepare('PRAGMA foreign_key_list(eqa_schedule_instruments)').all().some(r=>r.table==='eqa_schedule'));
      db.prepare('INSERT INTO eqa_schedule(id,program_id,year,round,round_no,sample_type,due_date) VALUES (?,?,?,?,?,?,?)').run('new-s','legacy-p',2026,'11',11,'Điện giải','2026-11-21');
      applySchema(db);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM eqa_schedule').get().n,2,'mở lại không gộp hoặc mất lịch');
      assert.equal(db.prepare("SELECT sample_type FROM eqa_schedule WHERE id='new-s'").get().sample_type,'Điện giải');
    } finally { db.close(); }
  });
  test(`schema 14 (${name}): lỗi nâng cấp hoàn nguyên toàn bộ bảng và phiên bản`, () => {
    const db = create();
    try {
      legacy(db,true);
      assert.throws(()=>applySchema(db), /FOREIGN KEY/i);
      assert.equal(readSchemaVersion(db),13);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM eqa_schedule').get().n,1);
      assert.equal(db.prepare('SELECT instrument_id FROM eqa_schedule_instruments').get().instrument_id,'missing-i');
      assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('eqa_schedule_v14','eqa_schedule_instruments_v14')").get().n,0);
    } finally { db.close(); }
  });
  test(`schema 14 (${name}): phục hồi backup 13 chụp loại mẫu cũ vào từng lịch`, () => {
    const source = create(), target = create();
    try {
      legacy(source);
      restoreAllTables(target,dumpAllTables(source));
      assert.equal(readSchemaVersion(target),SCHEMA_VERSION);
      assert.equal(target.prepare('SELECT sample_type FROM eqa_schedule').get().sample_type,'Sinh hóa');
      assert.equal(target.prepare('SELECT submitted_by FROM eqa_schedule_instruments').get().submitted_by,'Người nộp');
      assert.deepEqual(target.prepare('PRAGMA foreign_key_check').all(),[]);
    } finally { source.close(); target.close(); }
  });
}

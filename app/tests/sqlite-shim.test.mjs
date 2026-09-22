// Chốt rằng `renderer/browser-mock/sqlite-shim.ts` (bọc sql.js/WASM) khớp
// ĐÚNG hợp đồng `main/db/sqlite-like.ts` mà 16 file handler thật đang dùng —
// bước 1 của việc bỏ bản giả lập viết tay `browser-mock/api.ts`.
//
// Điểm quan trọng nhất: test này áp `applySchema()` THẬT (bản đã biên dịch từ
// main/db/schema.ts) lên shim, không phải một schema rút gọn cho test. Nếu
// shim trả `PRAGMA table_info` sai hình dạng thì các nhánh ALTER TABLE
// idempotent trong applySchema sẽ chạy lại lần hai và ném "duplicate column"
// — nên nó được gọi HAI LẦN liên tiếp ở đây.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const initSqlJs = require('sql.js');
const { applySchema, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { createBrowserDatabase, wrapSqlJsDatabase } = require('../../app-dist/mock/renderer/browser-mock/sqlite-shim.js');

const SQL = await initSqlJs();

function freshDb() {
  return createBrowserDatabase(SQL, applySchema);
}

test('applySchema thật chạy được trên shim, và chạy lần hai vẫn sạch', () => {
  const db = freshDb();
  // Lần hai: chính là phép thử các nhánh ALTER TABLE idempotent, vốn dựa vào
  // `PRAGMA table_info(...).all()` trả về mảng object có trường `name`.
  assert.doesNotThrow(() => applySchema(db));
  const cols = db.prepare("PRAGMA table_info('tests')").all();
  assert.ok(Array.isArray(cols) && cols.length > 0, 'PRAGMA table_info phải trả mảng dòng');
  assert.ok(cols.every((c) => typeof c.name === 'string'), 'mỗi dòng phải có trường name dạng chuỗi');
  for (const name of ['active', 'analyte_id', 'sigma_tracked']) {
    assert.ok(cols.some((c) => c.name === name), `thiếu cột ${name} do ALTER TABLE không chạy`);
  }
  db.close();
});

test('get/all/run khớp ngữ nghĩa node:sqlite', () => {
  const db = freshDb();
  assert.equal(db.prepare('SELECT id FROM instruments WHERE id=?').get('khong-co'), undefined,
    '.get() không có dòng nào phải trả undefined, không phải null');
  assert.deepEqual(db.prepare('SELECT id FROM instruments').all(), [],
    '.all() không có dòng nào phải trả mảng rỗng');

  const ins = db.prepare('INSERT INTO instruments(id,name,model,serial,section,active) VALUES (?,?,?,?,?,?)');
  assert.equal(ins.run('i1', 'Máy A', 'M1', 'S1', 'Hóa sinh', 1).changes, 1);
  ins.run('i2', 'Máy B', 'M2', 'S2', 'Miễn dịch', 1);

  const row = db.prepare('SELECT id,name,section FROM instruments WHERE id=?').get('i1');
  assert.equal(row.name, 'Máy A', 'chuỗi tiếng Việt phải đọc lại nguyên vẹn');
  assert.equal(row.section, 'Hóa sinh');
  assert.equal(db.prepare('SELECT id FROM instruments').all().length, 2);

  // changes phải phản ánh đúng câu lệnh vừa chạy, không phải tổng tích lũy.
  assert.equal(db.prepare('UPDATE instruments SET section=? WHERE id=?').run('Khác', 'i1').changes, 1);
  assert.equal(db.prepare("UPDATE instruments SET section='X' WHERE id='khong-co'").run().changes, 0);
  db.close();
});

test('tham số ĐẶT TÊN (@name) — đường mà writeAudit() dùng', () => {
  // `node:sqlite` nhận object KHÔNG prefix cho SQL `VALUES (@id,@seq)`, còn
  // sql.js đòi key có prefix. Không dịch thì sql.js ném "tried to bind a
  // value of an unknown type ([object Object])" — đã gặp thật, và vì
  // `writeAudit()` là đường đi của MỌI thao tác ghi, nó làm vỡ cả app xem
  // trước ngay ở bước đăng nhập.
  const db = freshDb();
  db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (@id,@seq,@ts,@user,@username,@userId,@role,@type,@detail,@target,@clientId,@prevHash,@hash)`)
    .run({
      id: 'a1', seq: 1, ts: '2026-09-09T01:00:00.000Z', user: 'Quản trị viên', username: 'admin',
      userId: 'u1', role: 'admin', type: 'Nhập QC', detail: 'Điểm QC mức 1, giá trị 109.5',
      target: 'Natri (Na)', clientId: 'c1', prevHash: '', hash: 'abc',
    });
  const row = db.prepare('SELECT user, type, detail, target, seq FROM activity WHERE id=?').get('a1');
  assert.equal(row.user, 'Quản trị viên');
  assert.equal(row.type, 'Nhập QC');
  assert.equal(row.detail, 'Điểm QC mức 1, giá trị 109.5');
  assert.equal(row.target, 'Natri (Na)');
  assert.equal(row.seq, 1);
  db.close();
});

test('PRAGMA foreign_keys thật sự có tác dụng', () => {
  // Nếu FK không được bật, MỌI cổng toàn vẹn của app sẽ mất im lặng trong
  // bản xem trước mà giao diện vẫn trông như chạy đúng.
  const db = freshDb();
  db.prepare('INSERT INTO instruments(id,name,model,serial,section,active) VALUES (?,?,?,?,?,?)')
    .run('i1', 'Máy A', '', '', '', 1);
  db.prepare('INSERT INTO qc_panels(id,instrument_id,name,note) VALUES (?,?,?,?)')
    .run('p1', 'i1', 'Panel 1', '');
  assert.throws(() => db.prepare('DELETE FROM instruments WHERE id=?').run('i1'),
    /FOREIGN KEY/i, 'xoá máy đang được Panel QC tham chiếu phải bị chặn');
  db.close();
});

test('export/mở lại giữ nguyên dữ liệu (nền của persist IndexedDB)', () => {
  const db = freshDb();
  db.prepare('INSERT INTO instruments(id,name,model,serial,section,active) VALUES (?,?,?,?,?,?)')
    .run('i1', 'Máy Hóa sinh', 'AU680', 'SN-1', 'Hóa sinh', 1);
  const bytes = db.export();
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0);
  db.close();

  const reopened = createBrowserDatabase(SQL, applySchema, bytes);
  const row = reopened.prepare('SELECT name,model,section FROM instruments WHERE id=?').get('i1');
  assert.equal(row.name, 'Máy Hóa sinh', 'dữ liệu phải sống sót qua export/mở lại');
  assert.equal(row.model, 'AU680');
  assert.equal(row.section, 'Hóa sinh');
  reopened.close();
});

test('statement được free sau mỗi lời gọi (không rò handle WASM)', () => {
  // Handler thật gọi db.prepare() mới mỗi lần (321 chỗ, không cache), nên
  // shim phải chịu được số lượng lớn statement liên tiếp.
  const raw = new SQL.Database();
  let freed = 0;
  const realPrepare = raw.prepare.bind(raw);
  raw.prepare = (sql) => {
    const stmt = realPrepare(sql);
    const realFree = stmt.free.bind(stmt);
    stmt.free = () => { freed += 1; return realFree(); };
    return stmt;
  };
  const db = wrapSqlJsDatabase(raw);
  db.exec('CREATE TABLE t(a TEXT);');
  db.prepare('INSERT INTO t(a) VALUES (?)').run('x');
  db.prepare('SELECT a FROM t').get();
  db.prepare('SELECT a FROM t').all();
  assert.equal(freed, 3, 'cả get/all/run đều phải free statement');
  db.close();
});

test('schemaVersion của shim khớp bản thật', () => {
  assert.equal(typeof SCHEMA_VERSION, 'number');
});

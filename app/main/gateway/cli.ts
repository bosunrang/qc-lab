import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseArgs } from 'node:util';
import { GatewayStore, LOCAL_ADMIN } from './store';
import { startGateway } from './server';
import { integer } from './validation';
import { createFileLogger } from '../logging/file-logger';

const HELP = `QC Lab Gateway — nền tảng tiếp nhận QC, chưa kèm bộ kết nối LIS riêng.
Lệnh: npm.cmd run lis:gateway -- <lệnh> [tuỳ chọn]
  init                              Tạo CSDL và cấp token admin/app một lần
  start                             Chạy cổng cục bộ 127.0.0.1:8787
  token-create --role ingest --source LIS01 --label "LIS chính"
  token-create --role app --label "QC Lab thay thế"
  token-list                        Liệt kê token (không lộ giá trị bí mật)
  token-revoke --id <token-id>       Thu hồi token
  mappings-import --file <json>      Lưu 1–50 ánh xạ, cập nhật theo khoá nguồn
  mappings-list                     Xuất các ánh xạ hiện có
  status                            Xem số bản tin và ánh xạ
  audit                             Xem 100 dòng nhật ký gần đầu
  backup --file <sqlite-mới>         Sao lưu nhất quán, không ghi đè tệp cũ
Tuỳ chọn chung: --data-dir <thư-mục> (mặc định LOCALAPPDATA/QC Lab Gateway)
Cổng nhận từ LAN chỉ bật khi start có đủ:
  --ingress-host <IP> --ingress-port <cổng> --tls-cert <pem> --tls-key <pem>
Token chỉ in khi cấp; lưu chúng trong kho bí mật của đơn vị.`;

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    'data-dir': { type: 'string' }, role: { type: 'string' }, source: { type: 'string' }, label: { type: 'string' },
    id: { type: 'string' }, file: { type: 'string' }, help: { type: 'boolean' },
    'ingress-host': { type: 'string' }, 'ingress-port': { type: 'string' }, 'tls-cert': { type: 'string' }, 'tls-key': { type: 'string' },
  } });
  const command = positionals[0];
  if (!command || values.help) { console.log(HELP); return; }
  const commands = ['init', 'start', 'token-create', 'token-list', 'token-revoke', 'mappings-import', 'mappings-list', 'status', 'audit', 'backup'];
  if (!commands.includes(command) || positionals.length !== 1) throw new Error('Lệnh không hợp lệ. Dùng --help để xem hướng dẫn.');
  const dataDir = path.resolve(values['data-dir'] || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'QC Lab Gateway'));
  const filePath = path.join(dataDir, 'gateway.sqlite');
  if (command !== 'init' && !existsSync(filePath)) throw new Error('Gateway chưa có CSDL; chạy init trước.');
  const store = new GatewayStore(filePath);
  let serving = false;
  try {
    if (command !== 'init' && !store.initialized) throw new Error('Gateway chưa được khởi tạo hoàn chỉnh; chạy init trước.');
    if (command === 'init') console.log(JSON.stringify({ dataDir, ...store.initialize() }, null, 2));
    else if (command === 'token-create') console.log(JSON.stringify(store.createToken(LOCAL_ADMIN,
      { role: values.role, label: values.label, ...(values.source ? { sourceId: values.source } : {}) }), null, 2));
    else if (command === 'token-list') console.log(JSON.stringify(store.listTokens(LOCAL_ADMIN), null, 2));
    else if (command === 'token-revoke') { store.revokeToken(LOCAL_ADMIN, values.id); console.log('Đã thu hồi token.'); }
    else if (command === 'mappings-import') {
      if (!values.file) throw new Error('Cần --file trỏ tới tệp JSON ánh xạ.');
      store.saveMappings(LOCAL_ADMIN, JSON.parse(readFileSync(values.file, 'utf8').replace(/^\uFEFF/, ''))); console.log('Đã lưu ánh xạ.');
    } else if (command === 'mappings-list') console.log(JSON.stringify(store.listMappings(LOCAL_ADMIN), null, 2));
    else if (command === 'status') console.log(JSON.stringify(store.status(LOCAL_ADMIN), null, 2));
    else if (command === 'audit') console.log(JSON.stringify(store.audit(LOCAL_ADMIN, 0, 100), null, 2));
    else if (command === 'backup') {
      if (!values.file) throw new Error('Cần --file là đường dẫn tệp sao lưu mới.');
      await store.backup(LOCAL_ADMIN, values.file); console.log('Đã tạo bản sao lưu Gateway.');
    } else if (command === 'start') {
      const network = [values['ingress-host'], values['ingress-port'], values['tls-cert'], values['tls-key']];
      if (network.some(Boolean) && !network.every(Boolean)) throw new Error('Cổng mạng cần đủ ingress-host, ingress-port, tls-cert và tls-key.');
      const logger = createFileLogger({ dir: path.join(dataDir, 'logs') });
      const lifecycle = (message: string) => {
        try { logger.write({ level: 'info', source: 'gateway', message }); }
        catch { console.error('Không ghi được nhật ký tệp Gateway.'); }
      };
      const log = (entry: { requestId: string; code: string }) => {
        try { logger.write({ level: entry.code === 'internal-error' ? 'error' : 'warn', source: 'gateway', message: entry.code, detail: { requestId: entry.requestId } }); }
        catch { console.error(JSON.stringify({ message: 'Không ghi được nhật ký tệp Gateway.', ...entry })); }
      };
      const local = await startGateway({ store, log });
      let ingress: Awaited<ReturnType<typeof startGateway>> | undefined;
      try {
        if (values['ingress-host']) ingress = await startGateway({ store, surface: 'ingress', host: values['ingress-host'],
          port: integer(values['ingress-port'], 'ingress-port', 1, 65535), tls: {
            cert: readFileSync(values['tls-cert']!, 'utf8'), key: readFileSync(values['tls-key']!, 'utf8'),
          }, log });
      } catch (error) { await local.close(); throw error; }
      serving = true;
      lifecycle('Đã khởi động Gateway.');
      console.log(`QC Lab Gateway đang chạy: ${local.url}\nCSDL: ${filePath}${ingress ? `\nIngress HTTPS: ${ingress.url}` : '\nChưa bật cổng mạng; bộ kết nối trên máy có thể gửi QC qua cổng cục bộ.'}\nCtrl+C để dừng.`);
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        void Promise.all([local.close(), ingress?.close()]).then(() => {
          store.close();
          lifecycle('Đã dừng Gateway.');
        }).catch(() => { process.exitCode = 1; });
      };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    }
  } finally { if (!serving) store.close(); }
}

if (require.main === module) void main().catch((error: unknown) => {
  // Không in nội dung JSON đầu vào hoặc bí mật khi lệnh thất bại.
  console.error(error instanceof SyntaxError ? 'Tệp JSON không hợp lệ.' : error instanceof Error ? error.message : 'Gateway gặp lỗi.');
  process.exitCode = 1;
});

// Phía main của tiến trình phụ đẩy Firebase: mỗi lần đẩy mở một
// `utilityProcess`, gửi yêu cầu, chờ kết quả, rồi đóng. Chu kỳ đẩy 15 phút
// nên chi phí khởi tạo tiến trình không đáng kể, và một lần đẩy hỏng không để
// lại tiến trình treo.
import { utilityProcess } from 'electron';
import type { PushResponse, PushRunner } from './firebase-payload';

export function createUtilityPushRunner(workerPath: string, timeoutMs = 10 * 60 * 1000): PushRunner {
  return (request) => new Promise<PushResponse>((resolve) => {
    const child = utilityProcess.fork(workerPath, [], { serviceName: 'QC Lab Firebase backup' });
    let settled = false;
    const finish = (result: PushResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, code: 'upload-failed', message: 'Quá thời gian chờ đẩy dữ liệu lên Firebase.' }), timeoutMs);
    child.on('message', (message: PushResponse) => finish(message));
    child.on('exit', (code) => finish({ ok: false, code: 'build-failed', message: `Tiến trình đẩy dữ liệu dừng bất thường (mã ${code}).` }));
    child.postMessage(request);
  });
}

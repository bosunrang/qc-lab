// Khoá nguồn của hồ sơ NCE ngoại kiểm: nhận diện "cùng một kết quả" theo nội dung
// số liệu, để bổ sung máy khác hay nhập lại phiên bản mới không tạo hồ sơ trùng.
// Không đưa tín hiệu chuỗi (2/3, 6 cùng phía, J, không thành công) vào khoá: nhập
// bù một đợt cũ làm đổi tín hiệu của kết quả đã có hồ sơ, nhưng kết quả đó vẫn là
// một (rà soát 17/11/2026, S5). Tín hiệu mới vẫn hiện trong căn cứ của hàng chờ.
import { sha256Hex } from '../sha256';

export interface EqaSourceKeyInput {
  round: { id: string };
  result: {
    test_id: string; sample: string; code: string; unit: string; result: number; assigned: number; sigma_p: number;
    z_provider: number | null; z_official: number; class: string; method: string; peer_group: string; peer: unknown;
  };
}

export function eqaNceSourceKey(source: EqaSourceKeyInput): string {
  const r = source.result;
  return sha256Hex(JSON.stringify([source.round.id, r.test_id, r.sample, r.code, r.unit, r.result, r.assigned, r.sigma_p,
    r.z_provider, r.z_official, r.class, r.method, r.peer_group, r.peer]));
}

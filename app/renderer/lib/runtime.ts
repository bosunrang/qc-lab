// Cách renderer đang chạy, đặt MỘT lần ở `main.tsx` trước khi render.
//
// Đây là lớp HIỂN THỊ: chặn thật nằm ở main (thao tác `lan: false` trong
// `main/ipc/operations.ts` không gọi được qua mạng nội bộ). Renderer chỉ dùng
// cờ này để không bày ra nút mà máy trạm bấm vào chắc chắn bị từ chối.
let lanStation = false;

export function setLanStation(value: boolean): void { lanStation = value; }

/** Máy trạm LAN mở app qua trình duyệt: chỉ nhập liệu, thao tác quản trị và
 * cấu hình chung chỉ làm trên máy chính. */
export function isLanStation(): boolean { return lanStation; }

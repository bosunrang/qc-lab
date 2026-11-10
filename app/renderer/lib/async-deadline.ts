/** Giới hạn chờ ở giao diện, không huỷ hay khẳng định kết quả giao dịch
 * phía máy chính. Phản hồi muộn vẫn được bắt để không sinh lỗi chưa xử lý. */
export function withDeadline<T>(work: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Hết thời gian chờ phản hồi từ máy chính.')), timeoutMs);
    try { Promise.resolve(work()).then(resolve, reject).finally(() => clearTimeout(timer)); }
    catch (error) { clearTimeout(timer); reject(error); }
  });
}

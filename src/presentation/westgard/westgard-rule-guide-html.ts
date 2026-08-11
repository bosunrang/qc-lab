type Rule = { id: string; desc: string; alert: boolean; fix: string };

export function createWestgardRuleGuideHtml(deps: { escape: (value: unknown) => string; referenceIcon: () => string }) {
  return (rules: Rule[]) => {
    const rows = rules.map(rule => `<tr><td>${rule.id}</td><td>${deps.escape(rule.desc)}</td><td>${rule.alert ? '<span class="warn">Cảnh báo</span>' : '<span class="rej">Loại bỏ</span>'}</td><td>${deps.escape(rule.fix)}</td></tr>`).join('');
    return `<details class="wg-guide"><summary>Hướng dẫn nhanh luật Westgard</summary><div class="alert info" style="margin:10px 12px 18px"><span>Ký hiệu ${deps.referenceIcon()} trong bảng là điểm lịch sử cấu thành quy tắc. Điểm này chỉ là bằng chứng; trạng thái cảnh báo/loại được gắn cho lần chạy phát hiện hiện tại, không đổi hồi tố kết luận cũ.</span></div><div class="chart-scroll" tabindex="0"><table><thead><tr><th>Luật</th><th>Điều kiện</th><th>Kết luận</th><th>Gợi ý xử lý</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  };
}

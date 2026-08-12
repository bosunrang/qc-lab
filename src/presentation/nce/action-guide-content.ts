type GuideStep = { phase: string; title: string; text: string };

export function createActionGuideContent(deps: { escape: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (steps: GuideStep[]) => {
    const list = steps.map((step, index) => `<li class="action-guide-card"><span class="action-guide-number">${index + 1}</span><div><small>${deps.escape(step.phase)}</small><b>${deps.escape(step.title)}</b><p>${deps.escape(step.text)}</p></div></li>`).join('');
    return {
      body: `<div class="modal-b" tabindex="0" aria-label="Nội dung quy trình 8 bước"><div class="action-guide-intro"><b>Nguyên tắc thực hiện</b><p>Lưu hồ sơ ngay sau bước 1 ở trạng thái <strong>Đang điều tra</strong>, sau đó hoàn thiện theo tiến độ xử lý.</p></div><ol class="action-guide-list">${list}</ol></div>`,
      footer: `<div class="action-guide-footer-note"><b>Điều kiện khép vòng</b><span>Đủ bằng chứng QC, quyết định cho phép trở lại khi cần, đánh giá nguy cơ còn lại và phê duyệt độc lập.</span></div>${deps.button('Đóng', 'closeModal()', 'ghost')}`,
    };
  };
}

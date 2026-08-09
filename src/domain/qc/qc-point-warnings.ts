type AnyRecord = Record<string, any>;

export type QcWarningStats = {
  n: number;
  m: number;
  sd: number;
  cv: number;
};

export type QcPointWarningDependencies = {
  stats: (values: number[]) => QcWarningStats;
  todayIso: () => string;
  formatDate: (value: unknown) => string;
  formatNumber: (value: unknown, decimals?: number) => string;
};

export function createQcPointWarnings({ stats, todayIso, formatDate, formatNumber }: QcPointWarningDependencies) {
  return function qcPointWarnings(points: AnyRecord[], config: AnyRecord, date: string, runId: string, value: number) {
    const issues: string[] = [];
    if (!Number.isFinite(+config.sd) || +config.sd <= 0) issues.push('SD đang bằng 0 hoặc chưa hợp lệ, không thể đánh giá Westgard.');
    if (Number.isFinite(+config.mean) && +config.mean >= 0 && value < 0) issues.push('Giá trị âm trong khi Mean mục tiêu không âm.');
    if (Number.isFinite(+config.mean) && Number.isFinite(+config.sd) && +config.sd > 0
      && Math.abs((value - +config.mean) / +config.sd) > 5) issues.push('Giá trị lệch quá 5SD so với Mean/SD hiện tại.');
    if (date && date > todayIso()) issues.push('Ngày nhập nằm trong tương lai — kiểm tra lại trước khi lưu.');
    if (config.exp && date > config.exp) {
      issues.push(`Lô ${config.lot || 'hiện tại'} đã hết hạn sử dụng từ ${formatDate(config.exp)} — kiểm tra lại lô QC trước khi lưu.`);
    }
    const currentPoints = Array.isArray(points) ? points : [];
    const duplicate = currentPoints.find(point => !point.voided && point.date === date && +point.level === +config.level
      && (point.runId || '') === runId && (point.lot || '') === (config.lot || ''));
    if (duplicate) issues.push('Đã có điểm QC cùng ngày, cùng mức, cùng lô và cùng lần chạy.');
    const latest = (config.meanSdHistory || []).slice().reverse().find((history: AnyRecord) => history.effectiveFrom) || null;
    const referenceDate = latest && latest.effectiveFrom || '';
    if (referenceDate) {
      const age = Math.floor((new Date(date).getTime() - new Date(referenceDate).getTime()) / 86400000);
      if (Number.isFinite(age) && age > 365) issues.push('Mean/SD đang dùng đã quá 12 tháng, nên rà soát lại dải kiểm soát.');
    }
    const lotPoints = currentPoints.filter(point => !point.voided && +point.level === +config.level
      && (point.lot || '') === (config.lot || ''));
    const summary = stats(lotPoints.map(point => point.val));
    const targetCv = config.mean ? Math.abs(config.sd / config.mean * 100) : 0;
    if (summary && summary.n >= 10 && targetCv > 0 && summary.cv > targetCv * 1.5) {
      issues.push(`CV thực tế đang cao hơn CV mục tiêu (${formatNumber(summary.cv)}% so với ${formatNumber(targetCv)}%).`);
    }

    /* Nhập bù ngày cũ vẫn dùng cấu hình lô hiện hành. Cảnh báo nếu ngày đó nằm
       trong giai đoạn áp dụng của một lô khác; mục tiêu dự kiến chưa áp dụng
       (planned) không được xem là một giai đoạn có hiệu lực. */
    const otherLot = (config.meanSdHistory || []).find((history: AnyRecord) => {
      if (!history || (history.qcLotId ? history.qcLotId === config.qcLotId : (history.lot || '') === (config.lot || ''))) return false;
      if (history.planned) return false;
      if (history.effectiveFrom && date < history.effectiveFrom) return false;
      if (history.effectiveTo && date >= history.effectiveTo) return false;
      return true;
    });
    if (otherLot) {
      issues.push(`Ngày ${formatDate(date)} thuộc giai đoạn lô ${otherLot.lot || 'khác'} đang dùng (${otherLot.effectiveFrom ? 'từ ' + formatDate(otherLot.effectiveFrom) : 'trước đó'}${otherLot.effectiveTo ? ' đến ' + formatDate(otherLot.effectiveTo) : ''}), không phải lô ${config.lot || 'hiện tại'}. Kiểm tra lại ngày hoặc lô trước khi lưu.`);
    }
    return issues;
  };
}

export type QcPointWarnings = ReturnType<typeof createQcPointWarnings>;

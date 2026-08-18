import { icoCal } from './router-icons';

export function createDateBoxHtml(deps: { vnPickerParse: (value: unknown) => string; parseVN: (value: unknown) => string; escapeAttr: (value: unknown) => string; formatVnDate: (value: unknown) => string }) {
  return (id: string, value = '', cls = 'manage-date', attrs = '') => {
    const iso = deps.vnPickerParse(value) || deps.parseVN(value) || '';
    return `<span class="datebox ${cls}"><input id="${id}" class="date-text" inputmode="numeric" value="${deps.escapeAttr(deps.formatVnDate(value || ''))}" placeholder="dd/mm/yyyy" ${attrs}><span class="datepick" title="Chọn ngày">${icoCal()}</span><input class="native-date" type="date" lang="vi" value="${deps.escapeAttr(iso)}" title="Chọn ngày"></span>`;
  };
}

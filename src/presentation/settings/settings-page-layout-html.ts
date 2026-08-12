export function createSettingsPageLayoutHtml(head: (title: string, subtitle: string) => string) {
  return (input: { profileHtml: string; adminHtml: string; firebaseHtml: string; lisHtml: string; rulesHtml: string }): string => head('Cài đặt & Đồng bộ', 'Thông tin đơn vị, backup và kết nối Firebase')
    + `<div class="settings-profile-grid">${input.profileHtml}</div>${input.adminHtml}<div class="settings-cloud-grid">${input.firebaseHtml}${input.lisHtml}</div>${input.rulesHtml}`;
}

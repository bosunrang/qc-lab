export function createLisGatewayPanelHtml(deps: { escape: (value: unknown) => string; escapeAttribute: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (input: { url?: unknown; token?: unknown; enabled?: unknown; status?: unknown; statusText?: unknown }): string => {
    const status = input.status === 'ok' ? 'ok' : input.status === 'error' ? 'rej' : '';
    const token = String(input.token || '');
    return `<div class="panel lis-gateway-panel"><h2 class="panel-title">LIS Gateway (thử nghiệm)</h2>
     <div class="lis-gateway-body"><div class="lis-gateway-grid"><div><label for="lisGatewayUrl">Địa chỉ Gateway cục bộ</label><input id="lisGatewayUrl" value="${deps.escapeAttribute(input.url || '')}" placeholder="http://127.0.0.1:8787"></div><div><label for="lisGatewayToken">Bearer token${token ? ' (đã lưu — để trống nếu giữ nguyên)' : ''}</label><input id="lisGatewayToken" type="password" autocomplete="off" placeholder="${token ? '••••••••' : 'Dán token in ra khi chạy npm run lis:gateway'}"></div><label class="lis-gateway-toggle"><input id="lisGatewayEnabled" type="checkbox" ${input.enabled ? 'checked' : ''}><span>Tự động kiểm tra hàng chờ mỗi 5 phút</span></label></div>
       <div id="lisGatewayStatus" class="alert ${status}">${deps.escape(input.statusText || '')}</div>
       <div class="hint">Lấy kết quả nội kiểm mà middleware LIS đã đẩy vào Gateway. Kết quả KHÔNG tự thành điểm QC — phải mở hàng chờ và xác nhận từng dòng thì mới ghi vào dữ liệu nội kiểm. Không nhận dữ liệu bệnh nhân. Prototype chỉ cho phép localhost:8787.</div></div>
     <div class="settings-panel-actions">${deps.button('Lưu &amp; kiểm tra', 'lisGatewaySaveSettings()', 'teal')}${deps.button('Xem hàng chờ QC', 'lisOpenQueueModal()', 'ghost')}</div></div>`;
  };
}

// Cấu hình hồ sơ NCE (kế hoạch mục 3): hạn mặc định theo tầng, cửa sổ phát
// hiện tái diễn và ngoại lệ phân tách nhiệm vụ. Các số mặc định là tạm thời,
// chờ phòng xét nghiệm chốt theo SOP; main kiểm lại mọi giá trị khi lưu.
import { useEffect, useState } from 'react';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { errorDialog } from '../../state/dialog-store';
import { showToast } from '../../state/toast-store';
import type { NceConfigView } from '../../../shared/qc-api';

export function NceConfigPanel() {
  const [config, setConfig] = useState<NceConfigView | null>(null);
  const [saving, setSaving] = useState(false);
  const load = async () => setConfig(await window.qcApi.getNceConfig());
  useEffect(() => { void load(); }, []);
  useStoreInvalidation(['app_meta'], undefined, () => { void load(); });
  if (!config) return null;
  const set = (patch: Partial<NceConfigView>) => setConfig({ ...config, ...patch });

  async function save() {
    if (!config) return;
    setSaving(true);
    const result = await window.qcApi.saveNceConfig({ data: config });
    setSaving(false);
    if (!result.ok) { await errorDialog(result.error.message); return; }
    setConfig(result.data);
    showToast('Đã lưu cấu hình hồ sơ NCE.');
  }

  return (
    <div className="panel">
      <h2 className="panel-title settings-panel-title">Hồ sơ sự không phù hợp (NCE)</h2>
      <p className="settings-nce-note">Giá trị mặc định là tạm thời; hãy đặt theo SOP đã được phòng xét nghiệm phê duyệt.</p>
      <div className="settings-nce-fields">
        <div className="field"><label htmlFor="nceDueLow">Hạn xử lý nhanh (ngày)</label><input id="nceDueLow" type="number" min={1} max={365} value={config.dueDays.low} onChange={(e) => set({ dueDays: { ...config.dueDays, low: Number(e.target.value) } })} /></div>
        <div className="field"><label htmlFor="nceDueCapa">Hạn CAPA đầy đủ (ngày)</label><input id="nceDueCapa" type="number" min={1} max={365} value={config.dueDays.capa} onChange={(e) => set({ dueDays: { ...config.dueDays, capa: Number(e.target.value) } })} /></div>
        <div className="field"><label htmlFor="nceRecurrence">Cửa sổ phát hiện tái diễn (ngày)</label><input id="nceRecurrence" type="number" min={1} max={365} value={config.recurrenceWindowDays} onChange={(e) => set({ recurrenceWindowDays: Number(e.target.value) })} /></div>
        <div className="field settings-nce-wide">
          <label htmlFor="nceSep"><input id="nceSep" type="checkbox" checked={config.separationException.enabled} onChange={(e) => set({ separationException: { ...config.separationException, enabled: e.target.checked } })} /> Cho phép người đã tham gia hồ sơ tự duyệt (đơn vị ít người, phải có SOP)</label>
        </div>
        {config.separationException.enabled && (
          <div className="field settings-nce-wide"><label htmlFor="nceSop">Mã SOP cho phép ngoại lệ</label><input id="nceSop" value={config.separationException.sopRef} onChange={(e) => set({ separationException: { ...config.separationException, sopRef: e.target.value } })} /></div>
        )}
      </div>
      <div className="settings-panel-actions"><button type="button" className="btn teal" disabled={saving} onClick={() => void save()}>Lưu cấu hình NCE</button></div>
    </div>
  );
}

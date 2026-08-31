import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settings-store';

export function SettingsPage() {
  const { profile, error, saved, load, save } = useSettingsStore();
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [address, setAddress] = useState('');
  const [brandTitle, setBrandTitle] = useState('');
  const [brandSub, setBrandSub] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => { load(); }, [load]);

  // Nạp giá trị đã lưu vào form đúng 1 lần khi profile về — sau đó form là
  // của người dùng gõ, không bị ghi đè lại mỗi khi store re-render.
  useEffect(() => {
    if (profile && !seeded) {
      setName(profile.name); setDept(profile.dept); setAddress(profile.address);
      setBrandTitle(profile.brand_title); setBrandSub(profile.brand_sub);
      setSeeded(true);
    }
  }, [profile, seeded]);

  if (!profile) return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Đang tải…</div>;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Cài đặt (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {saved && <p style={{ color: 'green' }}>Đã lưu.</p>}

      <h2>Hồ sơ phòng xét nghiệm</h2>
      <div><label>Tên phòng xét nghiệm<br /><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} /></label></div>
      <div style={{ marginTop: 8 }}><label>Khoa/Đơn vị<br /><input value={dept} onChange={e => setDept(e.target.value)} style={{ width: '100%' }} /></label></div>
      <div style={{ marginTop: 8 }}><label>Địa chỉ<br /><input value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%' }} /></label></div>

      <h2>Thương hiệu hiển thị</h2>
      <div><label>Tiêu đề<br /><input value={brandTitle} onChange={e => setBrandTitle(e.target.value)} style={{ width: '100%' }} /></label></div>
      <div style={{ marginTop: 8 }}><label>Phụ đề<br /><input value={brandSub} onChange={e => setBrandSub(e.target.value)} style={{ width: '100%' }} /></label></div>

      <button style={{ marginTop: 16 }} onClick={() => save(name, dept, address, brandTitle, brandSub)}>Lưu</button>
    </div>
  );
}

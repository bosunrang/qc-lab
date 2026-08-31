import { useEffect, useState } from 'react';
import { useManageStore } from '../store/manage-store';

export function ManagePage() {
  const { instruments, tests, levelsByTestId, error, loadInstruments, loadTests, loadLevels, addInstrument, addTest, addLevel } = useManageStore();
  const [instrumentName, setInstrumentName] = useState('');
  const [instrumentManufacturer, setInstrumentManufacturer] = useState('');
  const [testName, setTestName] = useState('');
  const [testInstrumentId, setTestInstrumentId] = useState('');
  const [testUnit, setTestUnit] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [levelNo, setLevelNo] = useState('2');
  const [levelMean, setLevelMean] = useState('');
  const [levelSd, setLevelSd] = useState('');

  useEffect(() => { loadInstruments(); loadTests(); }, [loadInstruments, loadTests]);
  useEffect(() => { if (selectedTestId) loadLevels(selectedTestId); }, [selectedTestId, loadLevels]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Cấu hình chung (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <section style={{ marginBottom: 24 }}>
        <h2>Máy xét nghiệm</h2>
        <ul>{instruments.map(i => <li key={i.id}>{i.name} — {i.manufacturer}</li>)}</ul>
        <input placeholder="Tên máy" value={instrumentName} onChange={e => setInstrumentName(e.target.value)} />
        <input placeholder="Hãng sản xuất" value={instrumentManufacturer} onChange={e => setInstrumentManufacturer(e.target.value)} />
        <button onClick={async () => { await addInstrument(instrumentName, instrumentManufacturer); setInstrumentName(''); setInstrumentManufacturer(''); }}>Thêm máy</button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Xét nghiệm</h2>
        <ul>{tests.map(t => <li key={t.id}>{t.name} ({t.unit}) <button onClick={() => setSelectedTestId(t.id)}>Xem mức</button></li>)}</ul>
        <input placeholder="Tên xét nghiệm" value={testName} onChange={e => setTestName(e.target.value)} />
        <select value={testInstrumentId} onChange={e => setTestInstrumentId(e.target.value)}>
          <option value="">Chọn máy</option>
          {instruments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input placeholder="Đơn vị" value={testUnit} onChange={e => setTestUnit(e.target.value)} />
        <button onClick={async () => { await addTest(testName, testInstrumentId, testUnit); setTestName(''); setTestUnit(''); }}>Thêm xét nghiệm</button>
      </section>

      {selectedTestId && (
        <section>
          <h2>Mức QC của xét nghiệm đã chọn</h2>
          <ul>{(levelsByTestId[selectedTestId] || []).map(l => <li key={l.id}>Mức {l.level}: Mean={l.mean ?? '—'} SD={l.sd ?? '—'}</li>)}</ul>
          <input placeholder="Mức" value={levelNo} onChange={e => setLevelNo(e.target.value)} />
          <input placeholder="Mean" value={levelMean} onChange={e => setLevelMean(e.target.value)} />
          <input placeholder="SD" value={levelSd} onChange={e => setLevelSd(e.target.value)} />
          <button onClick={async () => { await addLevel(selectedTestId, Number(levelNo), levelMean, levelSd); setLevelMean(''); setLevelSd(''); }}>Thêm mức</button>
        </section>
      )}
    </div>
  );
}

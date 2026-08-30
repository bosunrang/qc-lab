import { useState, useEffect } from 'react';
import { useAppStore } from '../state/kernel';
import { PageHeader } from '../components/PageHeader';
import { PrintIcon } from '../components/PrintIcon';
import { DateField } from '../components/DateField';
import {
  reportModel, reportSearchSet, reportRangeChanged,
  goManageTargets, reportUnlockPeriod, reportSetLockPart, reportLockPeriod, printReport, exportReportXLSX, exportReportCSV,
  type ReportLockPanel,
} from '../bridge/reportBridge';

function Head({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Báo cáo & Biểu mẫu" subtitle={subtitle} />;
}

function EmptyPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="panel">
      <div className="empty">
        <div className="empty-title">Chưa có xét nghiệm đang vận hành</div>
        <div>Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.</div>
        {isAdmin ? <div className="empty-actions"><button className="btn teal" onClick={goManageTargets}>Cấu hình Mean/SD</button></div> : null}
      </div>
    </div>
  );
}

function SearchInput({ query }: { query: string }) {
  const [value, setValue] = useState(query);
  useEffect(() => { setValue(query); }, [query]);
  return <input id="reportSearch" type="search" placeholder="Tìm tên xét nghiệm" value={value} onChange={e => { setValue(e.target.value); reportSearchSet(e.target.value); }} />;
}

function RangePicker({ start, end }: { start: string; end: string }) {
  return (
    <>
      <div><label>Từ ngày</label><DateField id="rStartDate" value={start} onChange={() => reportRangeChanged()} /></div>
      <div><label>Đến ngày</label><DateField id="rEndDate" value={end} onChange={() => reportRangeChanged()} /></div>
    </>
  );
}

function LockRow({ lock, isAdmin }: { lock: ReportLockPanel['locks'][number]; isAdmin: boolean }) {
  return (
    <div className="period-lock-row">
      <div><b>Kỳ {lock.monthLabel}</b><span className="hint"> · Khóa bởi {lock.lockedBy}{lock.lockedAtText ? ` lúc ${lock.lockedAtText}` : ''}</span></div>
      {isAdmin ? <button className="btn ghost sm" onClick={() => reportUnlockPeriod(lock.ym)}>Mở khóa</button> : null}
    </div>
  );
}

function LockPanel({ lockPanel }: { lockPanel: ReportLockPanel }) {
  const { isAdmin, year, month, months, years, already, ym, locks } = lockPanel;
  return (
    <div className="panel">
      <h2 className="panel-title">Khóa kỳ báo cáo</h2>
      <div className="hint">Khóa 1 kỳ (theo tháng) sẽ chặn sửa/hủy điểm QC của kỳ đó ở <b>mọi xét nghiệm</b> — nên làm sau khi đã xuất xong báo cáo chính thức của kỳ.</div>
      <div className="report-lock-controls">
        <div>
          <label>Tháng</label>
          <select key={ym} aria-label="Tháng" disabled={!isAdmin} defaultValue={month} onChange={e => reportSetLockPart('month', e.target.value)}>
            {months.map(m => <option value={m} key={m}>Tháng {m}</option>)}
          </select>
        </div>
        <div>
          <label>Năm</label>
          <select key={ym} aria-label="Năm" disabled={!isAdmin} defaultValue={year} onChange={e => reportSetLockPart('year', e.target.value)}>
            {years.map(y => <option value={y} key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'end' }}>
          {isAdmin
            ? (already ? <button className="btn ghost" disabled>Kỳ này đã khóa</button> : <button className="btn teal" onClick={reportLockPeriod}>Khóa kỳ này</button>)
            : <span className="hint">Chỉ admin mới khóa/mở khóa được kỳ báo cáo.</span>}
        </div>
      </div>
      <div className="flow-panel">
        {locks.length ? <div className="period-lock-list">{locks.map(lock => <LockRow lock={lock} isAdmin={isAdmin} key={lock.ym} />)}</div> : <div className="hint">Chưa có kỳ nào được khóa.</div>}
      </div>
    </div>
  );
}

export function ReportPage() {
  useAppStore();
  const model = reportModel();

  if (model.empty) {
    return (
      <>
        <Head subtitle="" />
        <EmptyPanel isAdmin={model.isAdmin} />
        <LockPanel lockPanel={model.lockPanel} />
      </>
    );
  }

  return (
    <>
      <Head subtitle="Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn" />
      <div className="panel">
        <h2 className="panel-title">Báo cáo nội kiểm theo ngày</h2>
        <div className="grid4">
          <div><label>Tìm xét nghiệm</label><SearchInput query={model.query} /></div>
          <div>
            <label>Xét nghiệm <span id="reportTestCount" className="hint">({model.matched.length}/{model.totalCount})</span></label>
            <select key={model.selectedId} id="rTest" aria-label="Xét nghiệm" disabled={!model.matched.length} defaultValue={model.selectedId}>
              {model.matched.length ? model.matched.map(t => <option value={t.id} key={t.id}>{t.label}</option>) : <option value="">Không tìm thấy xét nghiệm phù hợp</option>}
            </select>
          </div>
          <RangePicker start={model.start} end={model.end} />
        </div>
        <div className="report-export-options">
          <label className="report-nce-option">
            <input id="reportNceAppendix" type="checkbox" defaultChecked />
            <span><b>Kèm phụ lục NCE</b><small>(Áp dụng cho PDF và Excel)</small></span>
          </label>
        </div>
        <div className="report-actions">
          <button className="btn teal" disabled={model.disabled} onClick={printReport}><PrintIcon />Tạo báo cáo & In</button>
          <button className="btn teal" disabled={model.disabled} onClick={exportReportXLSX}>Xuất Excel</button>
          <button className="btn teal" disabled={model.disabled} onClick={exportReportCSV}>Xuất CSV</button>
        </div>
      </div>
      <LockPanel lockPanel={model.lockPanel} />
    </>
  );
}

import { useEffect } from 'react';
import { useAppStore } from '../state/kernel';
import { reagentModel, headOnlyHtml, dateBoxHtml, rcToolIcon, rcCompute, type ReagentRow } from '../bridge/reagentBridge';

function Head({ subtitle }: { subtitle: string }) {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: headOnlyHtml('So sánh 2 lô hóa chất', subtitle) }} />;
}

function EmptyPanel() {
  return (
    <div className="panel">
      <div className="empty">
        <div className="empty-title">Chưa có phép so sánh</div>
        <div>Tải lại dữ liệu hoặc tạo phép so sánh mới.</div>
      </div>
    </div>
  );
}

function Toolbar({ comparisons, currentId, canWrite }: { comparisons: { id: string; label: string }[]; currentId: string; canWrite: boolean }) {
  return (
    <div className="panel rc-toolbar-panel">
      <h2 className="panel-title">Thiết lập so sánh</h2>
      <div className="rc-toolbar">
        <div className="rc-toolbar-selcol">
          <label>Chọn hóa chất</label>
          <select id="rcSel" aria-label="Chọn hóa chất" defaultValue={currentId} data-action="rcSwitch" data-action-on="change">
            {comparisons.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
          </select>
        </div>
        {canWrite ? (
          <div className="rc-toolbar-primary"><div>
            <button className="btn teal rc-add-btn" data-action="openRcCreateModal">+ Thêm</button>
            <button className="btn danger rc-delete-btn" data-action="rcDeleteCurrent" dangerouslySetInnerHTML={{ __html: rcToolIcon('trash') + ' Xóa' }} />
          </div></div>
        ) : null}
        <div className="rc-toolbar-secondary">
          {canWrite ? <button className="btn ghost rc-find-btn" data-action="openRcModal" dangerouslySetInnerHTML={{ __html: rcToolIcon('search') + ' Tìm' }} /> : null}
          <button className="btn teal rc-report-btn" data-action="rcPrint" dangerouslySetInnerHTML={{ __html: rcToolIcon('print') + ' In hóa chất này' }} />
          <button className="btn teal rc-report-main" data-action="rcPrintSummary" dangerouslySetInnerHTML={{ __html: rcToolIcon('report') + ' Báo cáo tổng hợp' }} />
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ model }: { model: Extract<ReturnType<typeof reagentModel>, { empty: false }> }) {
  const disabled = !model.canWrite;
  return (
    <div className="panel rc-info-panel">
      <h2 className="panel-title">Thông tin đánh giá</h2>
      <div className="rc-info-grid">
        <div className="rc-field"><label>Tên hóa chất</label><input disabled={disabled} defaultValue={model.reagent as string} data-action="rcMeta" data-args='["reagent"]' data-action-on="input" placeholder="Tên hóa chất / xét nghiệm" /></div>
        <div className="rc-field"><label>Đơn vị</label><input disabled={disabled} defaultValue={model.unit as string} data-action="rcMeta" data-args='["unit"]' data-action-on="input" placeholder="mmol/L..." /></div>
        <div className="rc-field"><label>Số lô cũ</label><input disabled={disabled} aria-label="Số lô cũ" defaultValue={model.lotOld as string} data-action="rcMeta" data-args='["lotOld"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["lotOld"]' data-change-action="rcMetaLog" data-change-args='["lotOld"]' /></div>
        <div className="rc-field"><label>Số lô mới</label><input disabled={disabled} aria-label="Số lô mới" defaultValue={model.lotNew as string} data-action="rcMeta" data-args='["lotNew"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["lotNew"]' data-change-action="rcMetaLog" data-change-args='["lotNew"]' /></div>
        <div className="rc-field rc-date-field">
          <label>Ngày thực hiện</label>
          <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dateBoxHtml('rcDate', (model.date as string) || '', '', `${disabled ? 'disabled' : ''} data-action="rcMeta" data-args='["date"]' data-action-on="change"`) }} />
        </div>
        <div className="rc-field">
          <label>Người thực hiện</label>
          <div className="rc-quick-field">
            <input disabled={disabled} defaultValue={model.operator as string} data-action="rcMeta" data-args='["operator"]' data-action-on="input" placeholder="Họ tên" />
            <button className="rc-icon-btn" disabled={!model.canWrite} data-action="rcOpenQuick" data-args='["operator"]' title="Chọn nhanh người thực hiện" aria-label="Chọn nhanh người thực hiện" dangerouslySetInnerHTML={{ __html: rcToolIcon('user') }} />
          </div>
        </div>
        <div className="rc-field">
          <label>Loại mẫu</label>
          <div className="rc-quick-field">
            <input disabled={disabled} defaultValue={model.sampleType as string} data-action="rcMeta" data-args='["sampleType"]' data-action-on="input" placeholder="Loại mẫu" />
            <button className="rc-icon-btn" disabled={!model.canWrite} data-action="rcOpenQuick" data-args='["sampleType"]' title="Chọn nhanh loại mẫu" aria-label="Chọn nhanh loại mẫu" dangerouslySetInnerHTML={{ __html: rcToolIcon('sample') }} />
          </div>
        </div>
        <div className="rc-field"><label>Bias mong muốn (%)</label><input disabled={disabled} aria-label="Bias mong muốn (%)" type="number" step="any" defaultValue={model.biasTarget as number} data-action="rcMeta" data-args='["biasTarget"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["biasTarget"]' data-change-action="rcMetaLog" data-change-args='["biasTarget"]' /></div>
        <div className="rc-field"><label>Mức ý nghĩa (α, alpha)</label><input disabled={disabled} aria-label="Mức ý nghĩa (alpha)" type="number" step="any" defaultValue={model.alpha as number} data-action="rcMeta" data-args='["alpha"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["alpha"]' data-change-action="rcMetaLog" data-change-args='["alpha"]' /></div>
        <div className="rc-field rc-coverage-cell">
          <label className="rc-coverage-check">
            <input disabled={disabled} type="checkbox" defaultChecked={model.coverageConfirmed} data-action="rcMeta" data-args='["coverageConfirmed"]' data-action-on="change" />
            <span>Mẫu đã bao phủ khoảng đo và/hoặc điểm quyết định lâm sàng theo SOP</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function PairRow({ row, readOnly }: { row: ReagentRow; readOnly: boolean }) {
  return (
    <div className="rc-pair-row" data-rc-row={row.index}>
      <div className="rc-idx">{row.index + 1}</div>
      <input disabled={readOnly} defaultValue={row.old as string} data-action="rcCell" data-args={`[${row.index},0]`} data-action-on="input" type="number" step="any" placeholder="–" />
      <input disabled={readOnly} defaultValue={row.new as string} data-action="rcCell" data-args={`[${row.index},1]`} data-action-on="input" type="number" step="any" placeholder="–" />
      <div className="rc-calc avg">{row.avg}</div>
      <div className={`rc-calc dif${row.difNeg ? ' neg' : ''}`}>{row.dif}</div>
      {readOnly ? <span></span> : <button className="x" data-action="rcRmRow" data-args={`[${row.index}]`} title="Xóa dòng">✕</button>}
    </div>
  );
}

function PairPanel({ model }: { model: Extract<ReturnType<typeof reagentModel>, { empty: false }> }) {
  const readOnly = !model.canWrite;
  return (
    <div className="panel rc-pair-panel">
      <h2 className="panel-title">Dữ liệu đo bắt cặp</h2>
      <div className="rc-pair-wrap">
        <div className="rc-pair-head">
          <div>Mẫu</div>
          <div id="rcOldLotHead">{model.oldLotHead}</div>
          <div id="rcNewLotHead">{model.newLotHead}</div>
          <div>Trung bình</div>
          <div>Hiệu số (cũ − mới)</div>
          <div></div>
        </div>
        {model.rows.map(row => <PairRow row={row} readOnly={readOnly} key={`${model.rows.length}-${row.index}`} />)}
      </div>
      {model.canWrite ? (
        <div className="rc-pair-actions">
          <button className="btn ghost sm" data-action="rcAddRow">+ Thêm mẫu</button>{' '}
          <button className="btn ghost sm" data-action="rcClearRows">Xóa dữ liệu</button>
        </div>
      ) : null}
      <div className="hint" style={{ margin: '8px 16px 16px' }}>Nhập tối thiểu {model.minPairs} cặp để tính mô tả; để phần mềm đánh dấu “đạt sàng lọc” cần ≥20 cặp hợp lệ, bao phủ khoảng đo/điểm quyết định lâm sàng và %bias trong giới hạn SOP. Không dùng p-value để tự chấp nhận lô.</div>
    </div>
  );
}

function ResultsPanels() {
  return (
    <>
      <div className="panel rc-stats-panel"><h2 className="panel-title">Kết quả thống kê</h2><div id="rcStats"></div></div>
      <div className="panel rc-crit-panel"><h2 className="panel-title">Tiêu chí chấp nhận &amp; kết luận</h2><div id="rcCrit"></div><div id="rcVerdict"></div></div>
    </>
  );
}

function ChartsPanel() {
  return (
    <div className="panel rc-chart-panel">
      <h2 className="panel-title">Biểu đồ</h2>
      <div className="rc-charts">
        <div className="rc-chart-box">
          <h3>Biểu đồ tương quan</h3>
          <p>Lô cũ (trục X) so với Lô mới (trục Y)</p>
          <div id="rcScatter"></div>
          <div className="rc-chart-legend"><span><i className="reg"></i>Đường hồi quy</span><span><i className="ideal"></i>Đường lý tưởng y = x</span></div>
        </div>
        <div className="rc-chart-box">
          <h3>Biểu đồ Bland-Altman</h3>
          <p>Hiệu số (cũ − mới) so với giá trị trung bình</p>
          <div id="rcBland"></div>
          <div className="rc-chart-legend"><span><i className="bias"></i>Bias trung bình</span><span><i className="limit"></i>±1.96 SD</span></div>
        </div>
      </div>
    </div>
  );
}

export function ReagentPage() {
  useAppStore();
  const model = reagentModel();

  useEffect(() => {
    if (!model.empty) rcCompute();
  });

  if (model.empty) {
    return (
      <>
        <Head subtitle="" />
        <EmptyPanel />
      </>
    );
  }

  return (
    <>
      <Head subtitle="Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP" />
      {/* key={currentId}: mọi field bên trong (rcSel, tên hóa chất, lô, bias, alpha,
          checkbox bao phủ...) đều KHÔNG điều khiển (defaultValue/defaultChecked) vì chỉ
          đọc lúc gõ/đổi (rcMeta không gọi rerender()). Nhưng đổi SANG một hóa chất khác
          (rcSwitch/rcCreateFrom/rcPick/rcDelete) đều gọi rerender() — nếu không ép remount
          bằng key này, React tái dùng đúng những DOM node cũ (cùng vị trí, cùng key ngầm
          định) và giữ nguyên giá trị đã mount lần đầu, hiển thị SAI dữ liệu của hóa chất
          vừa chọn (đã xác nhận trực tiếp trong trình duyệt — chọn hóa chất khác nhưng
          select/ô dữ liệu vẫn hiện hóa chất cũ). */}
      <div key={model.currentId} style={{ display: 'contents' }}>
        <Toolbar comparisons={model.comparisons} currentId={model.currentId} canWrite={model.canWrite} />
        <div className="rc-entry-grid">
          <InfoPanel model={model} />
          <PairPanel model={model} />
        </div>
      </div>
      <ResultsPanels />
      <ChartsPanel />
    </>
  );
}

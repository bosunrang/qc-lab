/* ===== QC DOMAIN RULES ===== */
function qcPointWarnings(t,cfg,date,runId,val){
  const issues=[];
  if(!Number.isFinite(+cfg.sd)||+cfg.sd<=0)issues.push('SD đang bằng 0 hoặc chưa hợp lệ, không thể đánh giá Westgard.');
  if(Number.isFinite(+cfg.mean)&&+cfg.mean>=0&&val<0)issues.push('Giá trị âm trong khi Mean mục tiêu không âm.');
  if(Number.isFinite(+cfg.mean)&&Number.isFinite(+cfg.sd)&&+cfg.sd>0&&Math.abs((val-+cfg.mean)/+cfg.sd)>5)issues.push('Giá trị lệch quá 5SD so với Mean/SD hiện tại.');
  if(date&&date>isoToday())issues.push('Ngày nhập nằm trong tương lai — kiểm tra lại trước khi lưu.');
  if(cfg.exp&&date>cfg.exp)issues.push(`Lô ${cfg.lot||'hiện tại'} đã hết hạn sử dụng từ ${vnDate(cfg.exp)} — kiểm tra lại lô QC trước khi lưu.`);
  const dup=(state.data[t.id]||[]).find(p=>!p.voided&&p.date===date&&+p.level===+cfg.level&&(p.runId||'')===runId&&(p.lot||'')===(cfg.lot||''));
  if(dup)issues.push('Đã có điểm QC cùng ngày, cùng mức, cùng lô và cùng lần chạy.');
  const latest=(cfg.meanSdHistory||[]).slice().reverse().find(h=>h.effectiveFrom)||null,ref=latest&&latest.effectiveFrom||'';
  if(ref){const age=Math.floor((new Date(date)-new Date(ref))/86400000);if(Number.isFinite(age)&&age>365)issues.push('Mean/SD đang dùng đã quá 12 tháng, nên rà soát lại dải kiểm soát.');}
  const pts=(state.data[t.id]||[]).filter(p=>!p.voided&&+p.level===+cfg.level&&(p.lot||'')===(cfg.lot||'')),st=stats(pts.map(p=>p.val)),targetCv=cfg.mean?Math.abs(cfg.sd/cfg.mean*100):0;
  if(st&&st.n>=10&&targetCv>0&&st.cv>targetCv*1.5)issues.push(`CV thực tế đang cao hơn CV mục tiêu (${fmt(st.cv)}% so với ${fmt(targetCv)}%).`);
  /* Nhập liệu luôn dùng Mean/SD của lô ĐANG hoạt động (cfg), bất kể ngày được chọn —
     nhập bù một ngày cũ sau khi đã chuyển tiếp lô sẽ âm thầm tính Z theo Mean/SD của
     lô MỚI dù ngày đó lô CŨ mới thực sự đang chạy. meanSdHistory đã ghi lại đúng
     effectiveFrom/effectiveTo của từng lô lúc chuyển tiếp (xem applyAcceptedLotTransitionToConfig
     ở state.js) — dùng lại để phát hiện ngày rơi vào giai đoạn của MỘT LÔ KHÁC, không
     chặn cứng (có thể người dùng cố ý biết rõ), chỉ cảnh báo trước khi lưu như các
     cảnh báo khác ở trên. */
  const otherLot=(cfg.meanSdHistory||[]).find(h=>{
    if(!h||(h.qcLotId?h.qcLotId===cfg.qcLotId:(h.lot||'')===(cfg.lot||'')))return false;
    if(h.effectiveFrom&&date<h.effectiveFrom)return false;
    if(h.effectiveTo&&date>=h.effectiveTo)return false;
    return true;
  });
  if(otherLot)issues.push(`Ngày ${vnDate(date)} thuộc giai đoạn lô ${otherLot.lot||'khác'} đang dùng (${otherLot.effectiveFrom?'từ '+vnDate(otherLot.effectiveFrom):'trước đó'}${otherLot.effectiveTo?' đến '+vnDate(otherLot.effectiveTo):''}), không phải lô ${cfg.lot||'hiện tại'}. Kiểm tra lại ngày hoặc lô trước khi lưu.`);
  return issues;
}
if(typeof globalThis!=='undefined')globalThis.qcPointWarnings=qcPointWarnings;

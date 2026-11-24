// Ngoại kiểm xuất hiện trong cùng khung việc cần xử lý với QC, tự cập nhật sau nộp.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {bootstrapAndLogin,launchApp,openPage,seedOperationalTest,countIpcCalls,showEqaCalendarMonth} from './helpers.mjs';

test('Tổng quan: ngoại kiểm nằm trong Cần xử lý / Theo dõi, giữ cảnh báo QC và thử lại khi lỗi đọc', {timeout:150_000}, async()=>{
  const {app,page,errors}=await launchApp();
  const shots=path.resolve('.cache/dashboard-eqa-followup');
  mkdirSync(shots,{recursive:true});
  try {
    await bootstrapAndLogin(page);
    const qc=await seedOperationalTest(page);
    const seed=await page.evaluate(async()=>{
      const api=window.qcApi,now=new Date();
      const at=offset=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
      const must=r=>{if(!r.ok)throw new Error(JSON.stringify(r.error));return r.data;};
      const a=must(await api.saveInstrument({data:{name:'DxC 700 AU'}}));
      const b=must(await api.saveInstrument({data:{name:'EasyLyte Plus'}}));
      const late=must(await api.saveEqaSchedule({data:{programName:'CHƯƠNG TRÌNH NGOẠI KIỂM TRA SINH HÓA',year:Number(at(-400).slice(0,4)),round:'11',sampleType:'Sinh hóa',instrumentIds:[a.id],dueDate:at(-400)}}));
      const soon=must(await api.saveEqaSchedule({data:{programId:late.program_id,year:now.getFullYear(),round:'11',sampleType:'Điện giải',instrumentIds:[b.id],dueDate:at(3)}}));
      return {late,soon,a,b,today:at(0),next:at(2)};
    });
    await page.setViewportSize({width:1630,height:1000});
    const panel=page.getByRole('region',{name:'Cần xử lý / Theo dõi',exact:true});
    const late=panel.locator('.shift-item').filter({hasText:'Ngoại kiểm · Sinh hóa'});
    const soon=panel.locator('.shift-item').filter({hasText:'Ngoại kiểm · Điện giải'});
    await late.waitFor();await soon.waitFor();
    assert.ok((await late.getAttribute('class')).includes('rej'));
    assert.ok((await soon.getAttribute('class')).includes('warn'));
    assert.equal(await page.locator('.dash-eqa-alert').count(),0,'không còn dải nhắc việc ngoài khung');
    assert.equal(await panel.getByText('Không có điểm bị loại/cảnh báo cần xử lý ngay.',{exact:true}).count(),0,'còn lịch thì không báo hết việc');
    assert.equal(await panel.getByRole('link',{name:'Mở lịch ngoại kiểm',exact:true}).count(),2);
    await page.screenshot({path:path.join(shots,'followup-wide.png'),fullPage:true});
    await page.setViewportSize({width:1050,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await panel.locator('.shift-item').evaluateAll(rows=>rows.every(n=>n.scrollWidth<=n.clientWidth+1)),true);
    await page.screenshot({path:path.join(shots,'followup-narrow.png'),fullPage:true});
    async function checkDestination(row,machine){
      const [year,month,day]=row.due_date.split('-');
      await page.getByRole('grid',{name:`Lịch tháng ${month}/${Number(year)}`,exact:true}).waitFor();
      const calendar=page.getByRole('region',{name:'Lịch và danh sách đợt',exact:true});
      assert.equal(await calendar.locator(`button[data-date="${row.due_date}"]`).getAttribute('aria-pressed'),'true');
      assert.equal(await calendar.getByRole('combobox',{name:'Loại mẫu trong lịch',exact:true}).inputValue(),'');
      const details=page.getByRole('region',{name:'Công việc ngày được chọn',exact:true});
      await details.getByRole('heading',{name:`Công việc ngày ${day}/${month}/${year}`,exact:true}).waitFor();
      const task=details.locator('.eqa-schedule-task').filter({hasText:machine});
      await task.waitFor();
      await page.waitForFunction(name=>document.activeElement?.classList.contains('eqa-schedule-task')&&document.activeElement.textContent.includes(name),machine);
      assert.equal(await task.getByRole('button',{name:'Ghi nhận nộp',exact:true}).count(),1);
    }
    // Mở lịch năm cũ phải chọn đúng tháng/ngày sau khi dữ liệu tải xong.
    await late.getByRole('link',{name:'Mở lịch ngoại kiểm',exact:true}).click();
    await checkDestination(seed.late,'DxC 700 AU');
    await page.screenshot({path:path.join(shots,'targeted-calendar.png'),fullPage:true});
    // Đường dẫn giữ nguyên đích khi tải lại, rồi vẫn cho chọn ngày khác bình thường.
    await page.reload();await checkDestination(seed.late,'DxC 700 AU');
    const targetHash=await page.evaluate(()=>location.hash);
    await page.evaluate(()=>{location.hash='#/eqa?view=lich';});
    await showEqaCalendarMonth(page,seed.today);
    await page.locator(`button[data-date="${seed.today}"]`).click();
    assert.equal(await page.locator(`button[data-date="${seed.today}"]`).getAttribute('aria-pressed'),'true');
    await page.evaluate(hash=>{location.hash=hash;},targetHash);
    await checkDestination(seed.late,'DxC 700 AU');
    await openPage(page,'Tổng quan');await soon.waitFor();
    await soon.getByRole('link',{name:'Mở lịch ngoại kiểm',exact:true}).click();
    await checkDestination(seed.soon,'EasyLyte Plus');
    await openPage(page,'Tổng quan');await late.waitFor();await soon.waitFor();
    const calls=await countIpcCalls(app,['westgard:listTestSummaries']);
    await page.evaluate(async row=>{
      const r=await window.qcApi.markEqaSubmitted({data:{id:row.id,instrumentIds:row.instruments.map(m=>m.instrument_id)}});
      if(!r.ok)throw new Error(r.error.message);
    },seed.late);
    await late.waitFor({state:'hidden'});await soon.waitFor();
    assert.equal((await calls.read())['westgard:listTestSummaries'],0,'thay đổi ngoại kiểm không tính lại Westgard');
    await page.evaluate(async row=>{
      const r=await window.qcApi.markEqaSubmitted({data:{id:row.id,instrumentIds:row.instruments.map(m=>m.instrument_id)}});
      if(!r.ok)throw new Error(r.error.message);
    },seed.soon);
    await soon.waitFor({state:'hidden'});
    await panel.getByText('Không có điểm bị loại/cảnh báo cần xử lý ngay.',{exact:true}).waitFor();

    // Cảnh báo QC vẫn hiện trong cùng panel sau khi thêm nguồn công việc ngoại kiểm.
    await page.evaluate(async data=>{
      const r=await window.qcApi.addPoint({data:{testId:data.testId,level:1,date:data.today,val:6}});
      if(!r.ok)throw new Error(r.error.message);
    },{testId:qc.testId,today:seed.today});
    const qcItem=panel.locator('.shift-item').filter({hasText:'Glucose E2E'});
    await qcItem.waitFor();
    const pending=await page.evaluate(async data=>{
      const r=await window.qcApi.saveEqaSchedule({data:{programId:data.program,year:Number(data.today.slice(0,4)),round:'12',sampleType:'Sinh hóa',instrumentIds:[data.machine],dueDate:data.due}});
      if(!r.ok)throw new Error(r.error.message);return r.data;
    },{program:seed.late.program_id,today:seed.today,machine:seed.a.id,due:seed.next});
    const pendingRow=panel.locator('.shift-item').filter({hasText:`Ngoại kiểm · Sinh hóa · 12/`});
    await pendingRow.waitFor();await qcItem.waitFor();
    assert.match(await panel.locator('.shift-item').first().innerText(),/Glucose E2E/,'QC bị loại vẫn ưu tiên phía trên');

    // Lỗi làm mới không được biến thành thông báo không có việc.
    await app.evaluate(({ipcMain})=>{
      const original=ipcMain._invokeHandlers.get('eqa:listSchedule');
      ipcMain._invokeHandlers.set('eqa:listSchedule',()=>{
        ipcMain._invokeHandlers.set('eqa:listSchedule',original);
        throw new Error('Lỗi đọc lịch để kiểm tra khôi phục');
      });
    });
    await page.evaluate(async row=>{
      const r=await window.qcApi.markEqaSubmitted({data:{id:row.id,instrumentIds:row.instruments.map(m=>m.instrument_id)}});
      if(!r.ok)throw new Error(r.error.message);
    },pending);
    await panel.getByText('Không tải được lịch ngoại kiểm',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'Thử lại',exact:true}).click();
    await panel.getByText('Không tải được lịch ngoại kiểm',{exact:true}).waitFor({state:'hidden'});
    await pendingRow.waitFor({state:'hidden'});await qcItem.waitFor();
    assert.deepEqual(errors,[]);
  }catch(error){
    await page.screenshot({path:path.join(shots,'failure.png'),fullPage:true});
    console.error(await page.locator('body').innerText());
    throw error;
  }finally{await app.close();}
});

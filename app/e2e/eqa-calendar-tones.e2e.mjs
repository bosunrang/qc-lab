// Nền cảnh báo thuộc hạn nộp, không lan sang ngày chạy hoặc việc đã nộp.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {bootstrapAndLogin,launchApp,openPage,showEqaCalendarMonth} from './helpers.mjs';

test('lịch tháng: tô cả ô theo hạn nộp, giữ màu khi chọn và gỡ cảnh báo sau nộp', {timeout:120_000}, async()=>{
  const {app,page,errors}=await launchApp();
  const shots=path.resolve('.cache/eqa-calendar-tones');
  mkdirSync(shots,{recursive:true});
  try {
    await bootstrapAndLogin(page);
    const data=await page.evaluate(async()=>{
      const api=window.qcApi,now=new Date();
      const at=offset=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
      const must=r=>{if(!r.ok)throw new Error(JSON.stringify(r.error));return r.data;};
      const add=async(name,run,due,done=false)=>{
        const r=must(await api.saveEqaSchedule({data:{programName:name,year:now.getFullYear(),round:'11',sampleType:'Sinh hóa',runDate:run===null?'':at(run),dueDate:at(due)}}));
        if(done)must(await api.markEqaSubmitted({data:{id:r.id,submitted:true}}));
        return r.id;
      };
      await add('Đợt quá hạn',-2,-1);
      await add('Đợt đã nộp',null,-1,true);
      const soon=await add('Đến hạn hôm nay',-1,0);
      const other=await add('Cùng hạn hôm nay',null,0);
      await add('Chạy xa hạn',2,12);
      await add('Đã nộp trước hạn',null,2,true);
      return {today:at(0),overdue:at(-1),oldRun:at(-2),futureRun:at(2),soon,other};
    });
    await page.setViewportSize({width:1630,height:1000});
    await openPage(page,'Phân tích ngoại kiểm');
    await page.getByRole('button',{name:'Lịch',exact:true}).click();
    const main=page.getByRole('region',{name:'Lịch và danh sách đợt',exact:true});
    await main.getByRole('grid').waitFor();
    const day=async(date)=>{
      const button=main.locator(`.eqa-cal-day[data-date="${date}"]`);
      if(!(await button.count()))await showEqaCalendarMonth(page,date);
      await button.waitFor();
      return button;
    };
    const weekend=main.locator('.eqa-cal-day.is-weekend:not(.is-selected):not(.is-overdue):not(.is-soon)').first();
    const weekendDate=await weekend.getAttribute('data-date');
    const weekendBackground=await weekend.evaluate(node=>getComputedStyle(node).backgroundColor);
    await weekend.hover();
    await page.waitForFunction(({date,before})=>getComputedStyle(document.querySelector(`.eqa-cal-day[data-date="${date}"]`)).backgroundColor!==before,{date:weekendDate,before:weekendBackground});
    await page.mouse.move(0,0);
    await page.waitForFunction(({date,before})=>getComputedStyle(document.querySelector(`.eqa-cal-day[data-date="${date}"]`)).backgroundColor===before,{date:weekendDate,before:weekendBackground});
    const late=await day(data.overdue);
    assert.ok((await late.getAttribute('class')).includes('is-overdue'));
    assert.equal((await late.getAttribute('class')).includes('is-soon'),false,'ngày có nhiều việc ưu tiên quá hạn');
    const red=await late.evaluate(n=>getComputedStyle(n).backgroundColor);
    await late.click();
    assert.equal(await late.evaluate(n=>getComputedStyle(n).backgroundColor),red,'chọn ngày không che nền đỏ');
    assert.notEqual(await late.evaluate(n=>getComputedStyle(n).boxShadow),'none');
    for(const date of [data.oldRun,data.futureRun]){
      const run=await day(date),classes=await run.getAttribute('class');
      assert.equal(/is-overdue|is-soon/.test(classes),false,'ngày chạy và hạn đã nộp không tự thành cảnh báo');
    }
    const soon=await day(data.today);
    assert.ok((await soon.getAttribute('class')).includes('is-soon'));
    const amber=await soon.evaluate(n=>getComputedStyle(n).backgroundColor);
    assert.notEqual(amber,red);
    await soon.click();
    assert.equal(await soon.evaluate(n=>getComputedStyle(n).backgroundColor),amber,'viền chọn ngày giữ nền vàng');
    const legend=main.locator('.eqa-calendar-key').first();
    await legend.getByText('● Chạy mẫu',{exact:true}).waitFor();
    await legend.getByText('● Hạn nộp',{exact:true}).waitFor();
    assert.equal(await legend.getByText('Nhận mẫu',{exact:false}).count(),0);
    await page.screenshot({path:path.join(shots,'calendar-warnings.png'),fullPage:true});
    await page.evaluate(async(ids)=>{
      for(const id of ids){const r=await window.qcApi.markEqaSubmitted({data:{id,submitted:true}});if(!r.ok)throw new Error(r.error.message);}
    },[data.soon,data.other]);
    await page.waitForFunction(date=>{
      const n=document.querySelector(`.eqa-cal-day[data-date="${date}"]`);
      return n&&!n.classList.contains('is-soon')&&!n.classList.contains('is-overdue');
    },data.today);
    assert.deepEqual(errors,[]);
  }catch(error){
    await page.screenshot({path:path.join(shots,'failure.png'),fullPage:true});
    throw error;
  }finally{await app.close();}
});

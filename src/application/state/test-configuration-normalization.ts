type Row=Record<string,any>;
export type TestConfigurationDependencies={uid:()=>string;searchText:(value:unknown)=>string;teaKey:(value:unknown)=>string;builtInMeta:(value:unknown)=>Row;metaById:(id:unknown)=>Row;meta:(name:unknown,record:Row|undefined)=>Row;dedupeHistory:(level:Row)=>unknown};

export function normalizeTestConfiguration(state:Row,migrateLegacyLots:boolean,deps:TestConfigurationDependencies){
  (state.teaRefs||[]).forEach((reference:Row)=>{if(!reference.analyteId){const builtIn=deps.builtInMeta(reference.name);reference.analyteId=builtIn.analyteId||('custom-'+String(reference.id||deps.uid()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,72));}const built=deps.metaById(reference.analyteId);if(built.analyteId){reference.name=built.standardName;reference.displayName=built.displayName;reference.standardName=built.standardName;reference.abbreviation=built.abbreviation;reference.aliases=[...built.aliases];reference.matrix=built.matrix;}});
  /* Giai đoạn 7 (state immutable): gán lại `state.instruments` bằng mảng
     MỚI (spread) thay vì .push() tại chỗ, ở cả 3 chỗ tự sinh instrument từ
     dữ liệu cũ dưới đây (nhóm instruments/qcLots/qcPanels, 2026-08-30).
     lotGroups/qcLots do migrateLegacyLots tạo ra (dòng test.levels bên
     dưới) cũng đã đổi sang gán lại mảng MỚI khi TẠO MỚI phần tử (nhóm
     lotGroups/tests/teaRefs/lotTransitions, 2026-08-31) — an toàn cho
     targetSwitchCtx/activateLotGroup (giữ tham chiếu OBJECT vào một nhóm lô
     ĐANG SỬA qua bước re-auth/confirm, xem kế hoạch kiến trúc) vì đây chỉ
     TẠO nhóm/lô hoàn toàn mới lúc migrate dữ liệu cũ, không bao giờ THAY
     THẾ một nhóm/lô đang tồn tại bằng object khác — mã hoá lô đang sửa (nếu
     có) không đụng đường code này. */
  (state.machines||[]).forEach((name:unknown)=>{if(name&&!state.instruments.some((instrument:Row)=>deps.searchText(instrument.name)===deps.searchText(name)))state.instruments=[...state.instruments,{id:deps.uid(),name,manufacturer:'',model:'',serial:'',section:'',active:true}];});
  if(!state.instruments.length)state.instruments=[{id:deps.uid(),name:'Máy A',manufacturer:'',model:'',serial:'',section:'',active:true}];
  state.machines=[...new Set(state.instruments.map((instrument:Row)=>instrument.name).filter(Boolean))];
  state.tests.forEach((test:Row)=>{
    let instrument=state.instruments.find((item:Row)=>item.id===test.instrumentId)||state.instruments.find((item:Row)=>deps.searchText(item.name)===deps.searchText(test.machine));
    if(!instrument){instrument={id:deps.uid(),name:test.machine||'Máy A',manufacturer:'',model:'',serial:'',section:'',active:true};state.instruments=[...state.instruments,instrument];}
    test.instrumentId=instrument.id;test.machine=instrument.name;if(!test.section)test.section=instrument.section||'';if(test.active==null)test.active=true;test.ruleActions=test.ruleActions||{};test.ruleScopes=test.ruleScopes||{};test.cusum=test.cusum||{on:false,k:0.5,h:4};
    const reference=(state.teaRefs||[]).find((item:Row)=>test.analyteId&&item.analyteId===test.analyteId)||(state.teaRefs||[]).find((item:Row)=>deps.teaKey(item.name)===deps.teaKey(test.name)),naming=deps.meta(test.name,reference);test.analyteId=test.analyteId||naming.analyteId||('local-'+String(test.id||deps.uid()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,73));const built=deps.metaById(test.analyteId);if(built.analyteId){test.name=built.standardName;test.displayName=built.displayName;test.standardName=built.standardName;test.abbreviation=built.abbreviation;test.aliases=[...built.aliases];test.matrix=built.matrix;}else if(naming.standardName){test.displayName=test.displayName||naming.displayName;test.standardName=test.standardName||naming.standardName;test.abbreviation=test.abbreviation||naming.abbreviation;test.aliases=Array.isArray(test.aliases)&&test.aliases.length?test.aliases:naming.aliases;test.matrix=test.matrix||naming.matrix;}
    test.levels.forEach((level:Row)=>{let lot=state.qcLots.find((item:Row)=>item.id===level.qcLotId);if(migrateLegacyLots&&!lot&&level.lot){let group=state.lotGroups.find((item:Row)=>deps.searchText(item.name)===deps.searchText(test.name+' QC'));if(!group){group={id:deps.uid(),name:test.name+' QC',lotIds:[],manufacturer:'',material:'',catalog:'',note:'Tự động chuyển từ dữ liệu cũ',active:true};state.lotGroups=[...state.lotGroups,group];}lot=state.qcLots.find((item:Row)=>item.groupId===group.id&&item.lotNo===level.lot&&+item.level===+level.level);if(!lot){lot={id:deps.uid(),groupId:group.id,lotNo:level.lot,level:level.level,exp:level.exp||'',opened:'',active:true,note:''};state.qcLots=[...state.qcLots,lot];}if(lot&&!group.lotIds.includes(lot.id))group.lotIds=[...group.lotIds,lot.id];}if(lot){level.qcLotId=lot.id;level.lot=lot.lotNo;level.exp=lot.exp;}level.meanSdHistory=Array.isArray(level.meanSdHistory)?level.meanSdHistory:[];if(!level.meanSdHistory.length&&Number.isFinite(+level.mean)&&Number.isFinite(+level.sd)&&+level.sd>0)level.meanSdHistory.push({id:deps.uid(),qcLotId:level.qcLotId||'',lot:level.lot||'',mean:+level.mean,sd:+level.sd,low:level.low==null?null:+level.low,high:level.high==null?null:+level.high,effectiveFrom:'',effectiveTo:level.exp||'',source:level.applied==='lab'?'lab':'mfg',note:'Tự động chuyển từ cấu hình hiện hành'});deps.dedupeHistory(level);});
  });
}

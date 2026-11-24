// Phạm vi đọc ngoại kiểm đi cùng URL để mở xét nghiệm, xem kỳ rồi quay lại
// vẫn giữ năm, chương trình và máy. Chỉ lọc dữ liệu; kết luận do main tính.
import { useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { isoLocalDate } from '../../../main/domain/local-date';

export interface EqaNavigationContext {
  year?: number; programId?: string; instrumentId?: string; resultId?: string; roundId?: string;
}
export interface EqaSelection { testId: string; roundId: string; resultId?: string; sample?: string }

/** Chỉ mang phạm vi đọc sang màn khác, không mang trạng thái hộp thoại. */
export function eqaContextParams(params: URLSearchParams, context: EqaNavigationContext = {}): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of ['year', 'program', 'machine', 'roundMachine', 'roundFilter', 'roundCancelled']) if (params.get(key)) next.set(key, params.get(key)!);
  if (context.year !== undefined) next.set('year', String(context.year));
  if (context.programId) next.set('program', context.programId);
  if (context.instrumentId !== undefined) {
    if (context.instrumentId) next.set('machine', context.instrumentId); else next.delete('machine');
  }
  if (context.resultId) next.set('point', context.resultId);
  if (context.roundId) next.set('round', context.roundId);
  return next;
}

export function useEqaScope(preferredInstrumentId?: string) {
  const rounds = useEqaStore((s) => s.rounds);
  const [params, setParams] = useSearchParams();
  const active = rounds.filter((r) => r.status === 'open');
  const years = [...new Set(rounds.map((r) => r.year))].sort((a, b) => b - a);
  const requestedYear = Number(params.get('year'));
  const year = years.includes(requestedYear) ? requestedYear : years[0] ?? Number(isoLocalDate().slice(0, 4));
  const yearRounds = active.filter((r) => r.year === year);
  // URL trống thì mở chương trình có kỳ đang dùng mới nhất của năm (ngày báo
  // cáo, rồi số đợt), không theo chữ cái: tránh rơi vào chương trình ít dữ
  // liệu hay chỉ còn kỳ đã huỷ. Danh sách chọn vẫn xếp theo tên.
  const latestOf = new Map<string, string>();
  for (const r of yearRounds) {
    const key = `${r.report_date || ''}|${String(r.round_no).padStart(6, '0')}`;
    if (key > (latestOf.get(r.program_id) ?? '')) latestOf.set(r.program_id, key);
  }
  const programs = [...new Map(rounds.filter((r) => r.year === year).map((r) => [r.program_id, { id: r.program_id, name: r.program_name }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const newest = [...programs].sort((a, b) => (latestOf.get(b.id) ?? '').localeCompare(latestOf.get(a.id) ?? ''))[0];
  const programId = programs.some((p) => p.id === params.get('program')) ? params.get('program')! : newest?.id ?? '';
  const scopedRounds = yearRounds.filter((r) => r.program_id === programId)
    .sort((a, b) => a.round_no - b.round_no || a.report_date.localeCompare(b.report_date));
  // Máy đã khai nhưng chưa có báo cáo vẫn chọn được để người dùng thấy thiếu.
  // Giữ cả máy chỉ còn đợt đã huỷ để vẫn tra cứu được theo máy đó.
  const machineRounds = rounds.filter((r) => r.year === year && r.program_id === programId);
  const machines = [...new Map(machineRounds.flatMap((r) => [...r.by_instrument, ...r.missing_instruments])
    .map((i) => [i.instrument_id, { id: i.instrument_id, name: i.instrument_name }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const wantedMachine = preferredInstrumentId || params.get('machine');
  const activeMachineIds = new Set(scopedRounds.flatMap((r) => [...r.by_instrument, ...r.missing_instruments]).map((i) => i.instrument_id));
  const defaultMachine = machines.find((i) => activeMachineIds.has(i.id)) ?? machines[0];
  const instrumentId = machines.some((i) => i.id === wantedMachine) ? wantedMachine! : preferredInstrumentId || defaultMachine?.id || '';
  const context: EqaNavigationContext = { year, programId, instrumentId };

  function change(next: Partial<EqaNavigationContext>) {
    const query = eqaContextParams(params, { ...context, ...next });
    // Các bộ lọc riêng của danh sách đợt trở về tất cả khi đổi năm/chương trình.
    if (next.year !== undefined && next.year !== year || next.programId !== undefined && next.programId !== programId) {
      query.delete('roundMachine'); query.delete('roundFilter');
    }
    if (params.get('test')) query.set('test', params.get('test')!);
    // Đổi phạm vi không giữ ô kết quả của phạm vi trước.
    setParams(query, { replace: true });
  }
  /** `override` cho màn có phạm vi riêng (chuỗi xét nghiệm chọn chương trình
   * theo dữ liệu của xét nghiệm), để chọn điểm không ghi đè phạm vi đó. */
  function select(selection: EqaSelection, override: Partial<EqaNavigationContext> = {}) {
    const query = eqaContextParams(params, { ...context, ...override, ...selection });
    if (selection.sample !== undefined) query.set('sample', selection.sample);
    if (params.get('test')) query.set('test', params.get('test')!);
    else query.set('assay', selection.testId);
    setParams(query, { replace: true });
  }
  function clearSelection() {
    const query = eqaContextParams(params, context);
    if (params.get('test')) query.set('test', params.get('test')!);
    setParams(query, { replace: true });
  }
  return { year, years, programs, programId, machines, instrumentId, rounds: scopedRounds, context, params, change, select, clearSelection };
}

export function EqaScopeControls({ scope, action }: { scope: ReturnType<typeof useEqaScope>; action?: ReactNode }) {
  return <div className="eqa-scope-controls" role="group" aria-label="Phạm vi ngoại kiểm">
    <div className="field"><label htmlFor="eqa-scope-year">Năm</label><select id="eqa-scope-year" value={scope.year} onChange={(e) => scope.change({ year: Number(e.target.value) })}>
      {(scope.years.length ? scope.years : [scope.year]).map((y) => <option key={y} value={y}>{y}</option>)}
    </select></div>
    <div className="field eqa-scope-program"><label htmlFor="eqa-scope-program">Chương trình</label><select id="eqa-scope-program" value={scope.programId} onChange={(e) => scope.change({ programId: e.target.value })}>
      {!scope.programs.length && <option value="">Chưa có chương trình</option>}
      {scope.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select></div>
    <div className="field eqa-scope-machine"><label htmlFor="eqa-scope-machine">Máy</label><select id="eqa-scope-machine" value={scope.instrumentId} onChange={(e) => scope.change({ instrumentId: e.target.value })}>
      {!scope.machines.length && <option value="">Chưa có máy</option>}
      {scope.machines.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select></div>
    {action && <div className="eqa-scope-action">{action}</div>}
  </div>;
}

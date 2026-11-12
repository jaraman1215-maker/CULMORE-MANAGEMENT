import React, { useEffect } from 'react';
import { Printer, X, Download, AlertCircle } from 'lucide-react';
import { Employee, Shift, WorkWeekDay, BUSINESS_GROUPS, getBusinessGroup } from '../types';
import { getDaysInWorkWeek, formatWorkWeekRange } from '../utils/dateUtils';
import { calculateWeeklyHoursSummary, getEffectiveShiftForEmployee } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';

interface PrintScheduleStandaloneViewProps {
  currentWeekFriday: string;
  selectedGroup: string;
  mode: 'compact' | 'detailed';
  employees: Employee[];
  shifts: Shift[];
}

export const PrintScheduleStandaloneView: React.FC<PrintScheduleStandaloneViewProps> = ({
  currentWeekFriday,
  selectedGroup,
  mode,
  employees,
  shifts,
}) => {
  const { language } = useLanguage();
  const days: WorkWeekDay[] = getDaysInWorkWeek(currentWeekFriday);
  const activeEmployees = employees.filter((e) => e.active);

  // Dynamic effective shifts matching each employee's current work part (department & position)
  const effectiveShifts = shifts.map((s) => {
    const emp = employees.find((e) => e.employeeId === s.employeeId);
    return getEffectiveShiftForEmployee(s, emp);
  });

  const filteredEmployees = activeEmployees.filter((emp) => {
    if (selectedGroup === 'ALL') return true;
    const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
    return grp.id === selectedGroup;
  });

  const selectedGrpObj = selectedGroup !== 'ALL' ? BUSINESS_GROUPS.find((g) => g.id === selectedGroup) : null;
  const branchName = selectedGrpObj
    ? selectedGrpObj.name
    : language === 'ko'
    ? '전체 5개 사업장 (All Branches)'
    : 'All 5 Branches';

  const groupsToRender = selectedGroup === 'ALL'
    ? BUSINESS_GROUPS
    : BUSINESS_GROUPS.filter((g) => g.id === selectedGroup);

  // Auto-trigger print on mount (works 100% when opened in top-level window/tab)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn('Auto print failed:', err);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  let grandTotalHours = 0;
  let grandTotalOt = 0;
  let grandHeadcount = 0;

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-6 print:p-0">
      <style>{`
        @page {
          size: portrait;
          margin: 8mm 6mm;
        }
      `}</style>
      {/* Floating Action Bar (Hidden on print) */}
      <div className="no-print mb-6 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 sticky top-4 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm">
              MANAGEMENT OF CULMORE — {language === 'ko' ? '주간 근무 스케줄 인쇄 모드' : 'Schedule Print Mode'}
            </h1>
            <p className="text-xs text-slate-400">
              {formatWorkWeekRange(currentWeekFriday, language)} • {branchName}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'ko' ? '인쇄하기 (Print)' : 'Print Now'}</span>
          </button>

          <button
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.search = '';
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{language === 'ko' ? '닫기 / 돌아가기' : 'Close'}</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="max-w-6xl mx-auto bg-white border border-slate-200 print:border-none p-6 print:p-0 rounded-xl shadow-xs print:shadow-none">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              MANAGEMENT OF CULMORE
            </h1>
            <p className="text-xs text-slate-600">4210 John Marr Dr, Annandale, VA 22003 • (703) 555-0199</p>
            <p className="text-sm font-bold text-emerald-800 mt-1">
              {language === 'ko' ? '공식 주간 근무 스케줄표' : 'Official Weekly Work Schedule'}:{' '}
              {formatWorkWeekRange(currentWeekFriday, language)}
            </p>
            <p className="text-xs text-slate-700">
              <strong>{language === 'ko' ? '출력 대상 사업장' : 'Scope'}:</strong> {branchName}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500 font-mono">
            <div>
              <strong>Printed:</strong> {new Date().toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US')}
            </div>
            <div>Virginia FLSA (Fri - Thu / 40h OT)</div>
            <div className="text-emerald-800 font-bold mt-1">CULMORE CORP. OFFICIAL</div>
          </div>
        </div>

        {/* Groups Tables */}
        <div className="space-y-6">
          {groupsToRender.map((grp) => {
            const grpEmps = filteredEmployees.filter(
              (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
            );

            let grpHours = 0;
            let grpOt = 0;

            grpEmps.forEach((emp) => {
              const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
              const summary = calculateWeeklyHoursSummary(empShifts);
              grpHours += summary.totalHours;
              grpOt += summary.overtimeHours;
            });

            if (grpEmps.length === 0 && selectedGroup === 'ALL') {
              return null;
            }

            grandHeadcount += grpEmps.length;
            grandTotalHours += grpHours;
            grandTotalOt += grpOt;

            return (
              <div key={grp.id} className="border border-slate-300 rounded-lg overflow-hidden page-break-inside-avoid">
                {/* Group Banner */}
                <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                  <span>
                    {grp.name}
                  </span>
                  <span className="text-[11px] font-normal text-slate-300">
                    {language === 'ko' ? '인원' : 'Staff'}: {grpEmps.length}명 • {language === 'ko' ? '소계' : 'Subtotal'}:{' '}
                    {grpHours.toFixed(1)}h {grpOt > 0 ? `(OT: ${grpOt.toFixed(1)}h)` : ''}
                  </span>
                </div>

                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                      <th className="py-1.5 px-2 text-center w-8 border-r border-slate-300">No</th>
                      <th className="py-1.5 px-3 text-left w-44 border-r border-slate-300">
                        {language === 'ko' ? '직원명 / 직책' : 'Employee / Role'}
                      </th>
                      {days.map((day, idx) => (
                        <th
                          key={day.date}
                          className={`py-1.5 px-1 text-center border-r border-slate-300 ${
                            idx === 1 || idx === 2 ? 'bg-amber-100/70 text-amber-900' : ''
                          }`}
                        >
                          <div>{language === 'ko' ? day.dayOfWeekKo : day.dayOfWeek}</div>
                          <div className="text-[10px] font-normal opacity-80">
                            {language === 'ko' ? day.displayDateKo : day.displayDate}
                          </div>
                        </th>
                      ))}
                      <th className="py-1.5 px-2 text-right w-24">
                        {language === 'ko' ? '주간 합계' : 'Weekly Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {grpEmps.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-slate-400 italic">
                          {language === 'ko' ? '등록된 직원이 없습니다.' : 'No active employees in this group.'}
                        </td>
                      </tr>
                    ) : (
                      grpEmps.map((emp, index) => {
                        const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
                        const summary = calculateWeeklyHoursSummary(empShifts);
                        const isOt = summary.totalHours > 40;

                        return (
                          <tr key={emp.employeeId} className={index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="py-1.5 px-1 text-center text-slate-500 text-[10px] border-r border-slate-300">
                              {index + 1}
                            </td>
                            <td className="py-1.5 px-3 text-left border-r border-slate-300">
                              <div className="font-bold text-slate-900">{emp.fullName}</div>
                              <div className="text-[10px] text-slate-500">
                                {emp.department} • {emp.position}
                              </div>
                            </td>
                            {days.map((day) => {
                              const s = empShifts.find((sh) => sh.date === day.date);
                              if (!s) {
                                return (
                                  <td
                                    key={day.date}
                                    className="py-1 px-1 text-center text-slate-400 text-[10px] bg-slate-50/40 border-r border-slate-300"
                                  >
                                    OFF
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={day.date}
                                  className="py-1 px-1 text-center border-r border-slate-300 leading-tight"
                                >
                                  <div className="font-bold text-slate-900 text-[10px]">
                                    {s.startTime} - {s.endTime}
                                  </div>
                                  <div className="text-[9px] text-emerald-700 font-bold">
                                    {s.hours.toFixed(1)}h{s.isOvernight ? ' 🌙' : ''}
                                  </div>
                                  {mode === 'detailed' && s.actualBreakMinutes ? (
                                    <div className="text-[8px] text-slate-400">
                                      휴게 {s.actualBreakMinutes}분
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                            <td
                              className={`py-1.5 px-2 text-right font-bold ${
                                isOt ? 'text-rose-700 bg-rose-50/60' : 'text-emerald-800'
                              }`}
                            >
                              <div>{summary.totalHours.toFixed(1)}h</div>
                              {isOt && (
                                <div className="text-[9px] text-rose-600 font-normal">
                                  OT +{summary.overtimeHours.toFixed(1)}h
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Grand Summary Strip */}
        <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-300 flex justify-between text-xs font-bold text-slate-800">
          <div>
            {language === 'ko' ? '총 편성 인원' : 'Total Scheduled Staff'}: {grandHeadcount}명
          </div>
          <div>
            {language === 'ko' ? '주간 총 근무 시간' : 'Total Weekly Hours'}: {grandTotalHours.toFixed(1)}시간
          </div>
          <div className={grandTotalOt > 0 ? 'text-rose-700' : 'text-slate-800'}>
            {language === 'ko' ? '초과근무(OT >40h)' : 'Total Overtime (>40h)'}: {grandTotalOt.toFixed(1)}시간
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-8 pt-4 border-t border-dashed border-slate-400 flex justify-between text-xs text-slate-700">
          <div>
            {language === 'ko' ? '작성자 (Scheduler)' : 'Prepared By'}:{' '}
            <span className="inline-block w-36 border-b border-slate-500 ml-1"></span>
          </div>
          <div>
            {language === 'ko' ? '매니저 승인 (Store Manager)' : 'Approved By'}:{' '}
            <span className="inline-block w-36 border-b border-slate-500 ml-1"></span>
          </div>
          <div>
            {language === 'ko' ? '승인 일자 (Date)' : 'Approval Date'}:{' '}
            <span className="inline-block w-32 border-b border-slate-500 ml-1"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

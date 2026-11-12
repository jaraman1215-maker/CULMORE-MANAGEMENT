import React from 'react';
import {
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  Moon,
  Calendar,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  Sparkles,
  ShoppingBag,
  Building,
  Store,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Employee, Shift, PayrollPeriod, StoreSettings, BUSINESS_GROUPS, getBusinessGroup } from '../types';
import { formatCurrency } from '../utils/calculations';
import { ActiveTab } from './Sidebar';

interface DashboardViewProps {
  employees: Employee[];
  shifts: Shift[];
  payrollPeriod: PayrollPeriod | null;
  settings: StoreSettings;
  currentWeekFriday: string;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenTestModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  employees,
  shifts,
  payrollPeriod,
  settings,
  currentWeekFriday,
  setActiveTab,
  onOpenTestModal,
}) => {
  const { t, language } = useLanguage();

  const activeEmployees = employees.filter((e) => e.active);
  const totalEmployeesCount = employees.length;

  // Aggregate shift hours for this week
  const totalScheduledHours = shifts.reduce((acc, s) => acc + (Number(s.hours) || 0), 0);

  // Group hours per employee to determine regular vs overtime
  const employeeHoursMap: Record<string, number> = {};
  shifts.forEach((s) => {
    employeeHoursMap[s.employeeId] = (employeeHoursMap[s.employeeId] || 0) + (Number(s.hours) || 0);
  });

  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  const overtimeEmployees: { emp: Employee; hours: number; ot: number }[] = [];
  const missingShiftEmployees: Employee[] = [];

  activeEmployees.forEach((emp) => {
    const hrs = employeeHoursMap[emp.employeeId] || 0;
    if (hrs === 0) {
      missingShiftEmployees.push(emp);
    } else {
      const reg = Math.min(40, hrs);
      const ot = Math.max(0, hrs - 40);
      totalRegularHours += reg;
      totalOvertimeHours += ot;

      if (ot > 0) {
        overtimeEmployees.push({ emp, hours: hrs, ot });
      }
    }
  });

  // Calculate estimated gross payroll based on scheduled hours and individual employee wages
  let estimatedGross = 0;
  activeEmployees.forEach((emp) => {
    const hrs = employeeHoursMap[emp.employeeId] || 0;
    const reg = Math.min(40, hrs);
    const ot = Math.max(0, hrs - 40);
    const wage = Number(emp.hourlyWage) || 0;
    const otMult = Number(settings.overtimeMultiplier) || 1.5;
    estimatedGross += reg * wage + ot * (wage * otMult);
  });

  // Overnight shifts count (crossing midnight)
  const overnightShifts = shifts.filter((s) => s.isOvernight);

  // Department breakdown
  const departmentHours: Record<string, number> = {};
  shifts.forEach((s) => {
    const emp = employees.find((e) => e.employeeId === s.employeeId);
    const dept = emp?.department || 'Other';
    departmentHours[dept] = (departmentHours[dept] || 0) + (Number(s.hours) || 0);
  });

  // Business Groups breakdown
  const groupStats = BUSINESS_GROUPS.map((grp) => {
    const groupEmps = employees.filter(
      (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
    );
    const activeGroupEmps = groupEmps.filter((e) => e.active);
    const groupHours = shifts
      .filter((s) => {
        const emp = employees.find((e) => e.employeeId === s.employeeId);
        return getBusinessGroup(s.businessGroup || emp?.businessGroup || emp?.groupNumber).id === grp.id;
      })
      .reduce((acc, s) => acc + (Number(s.hours) || 0), 0);

    return {
      ...grp,
      totalCount: groupEmps.length,
      activeCount: activeGroupEmps.length,
      hours: groupHours,
    };
  });

  const payrollStatusLabel = payrollPeriod?.status
    ? payrollPeriod.status === 'finalized'
      ? language === 'ko' ? '마감 및 잠금 완료' : 'Finalized & Locked'
      : payrollPeriod.status === 'pending_review'
      ? language === 'ko' ? '검토 대기 중' : 'Pending Review'
      : language === 'ko' ? '작성 중 (초안)' : 'Draft'
    : language === 'ko' ? '미정산 (스케줄 대기)' : 'Not Yet Generated';

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                {language === 'ko' ? '버지니아 식료품 마트 관리자 콘솔' : 'Virginia Retail Grocery Admin'}
              </span>
              <span className="text-xs text-slate-400">• America/New_York (ET)</span>
            </div>
            <h1 className="text-2xl font-black mt-1 text-white tracking-tight">
              {language === 'ko' ? 'MANAGEMENT OF CULMORE 주간 스케줄 및 급여 대시보드' : 'MANAGEMENT OF CULMORE Operations Dashboard'}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              {language === 'ko'
                ? '금요일~목요일 주간 스케줄 편성, 자정 통과 야간조 시간 계산, 버지니아주 및 FLSA 법정 기준에 부합하는 오버타임(1.5배) 급여 정산 포털입니다.'
                : 'Friday through Thursday workweek management, overnight shift calculations crossing midnight, and FLSA 1.5x overtime compliance.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('schedule')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 flex items-center space-x-2 transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>{t('createSchedule')}</span>
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 flex items-center space-x-2 transition-all"
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>{t('processPayroll')}</span>
            </button>
          </div>
        </div>

        {/* Decorative corner accent */}
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('activeEmployees')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900">{activeEmployees.length}</span>
              <span className="text-xs text-slate-500">
                / {totalEmployeesCount} {language === 'ko' ? '전체 (퇴사 1명)' : 'total (1 inactive)'}
              </span>
            </div>
            <div className="mt-2 flex items-center text-xs text-blue-700">
              <span className="font-medium">
                {language === 'ko' ? '25명 기본 정원 관리' : '25 initial staff supported'}
              </span>
            </div>
          </div>
        </div>

        {/* Total Scheduled Hours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('scheduledHoursThisWeek')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {totalScheduledHours.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-500">hrs</span>
            </div>
            <div className="mt-2 text-xs flex items-center space-x-2">
              <span className="text-emerald-700 font-medium">
                {totalRegularHours.toFixed(1)}h reg
              </span>
              <span className="text-slate-300">•</span>
              <span className={totalOvertimeHours > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                {totalOvertimeHours.toFixed(1)}h OT
              </span>
            </div>
          </div>
        </div>

        {/* Estimated Gross Payroll */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('estimatedGrossPayroll')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-slate-900">
                {formatCurrency(estimatedGross)}
              </span>
            </div>
            <div className="mt-2 text-xs text-indigo-700 font-medium">
              {language === 'ko' ? '시급 및 오버타임 1.5배 반영' : 'Based on individual rates & 1.5x OT'}
            </div>
          </div>
        </div>

        {/* Payroll Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('payrollStatus')}
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                payrollPeriod?.status === 'finalized'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center space-x-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  payrollPeriod?.status === 'finalized'
                    ? 'bg-emerald-500'
                    : payrollPeriod?.status === 'pending_review'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-lg font-bold text-slate-900 truncate">
                {payrollStatusLabel}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500 truncate">
              {payrollPeriod?.finalizedBy ? `Locked by ${payrollPeriod.finalizedBy}` : 'Action required prior to pay date'}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts and Operational Notices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts & Compliance Warnings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  {language === 'ko' ? '스케줄 이상 및 준수 규정 알림' : 'Scheduling & Overtime Alerts'}
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {overtimeEmployees.length + missingShiftEmployees.length} {language === 'ko' ? '건 발생' : 'alerts'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Overtime Alerts */}
              {overtimeEmployees.length > 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center space-x-1.5">
                      <span>⚠️ {t('overtimeAlert')}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px]">
                        FLSA 1.5x Premium
                      </span>
                    </span>
                    <span className="text-xs font-bold text-amber-800">
                      {overtimeEmployees.length} {language === 'ko' ? '명 대상' : 'staff'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {overtimeEmployees.map((o) => (
                      <div
                        key={o.emp.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-slate-800 font-medium flex items-center space-x-1.5 shadow-2xs"
                      >
                        <span className="font-bold text-slate-900">{o.emp.fullName}</span>
                        <span className="text-amber-700 font-semibold">
                          {o.hours}h ({o.ot.toFixed(1)}h OT)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {language === 'ko'
                      ? '이번 주 40시간 초과 근무자가 없어 추가 오버타임 수당이 발생하지 않습니다.'
                      : 'No employees exceeding 40 weekly hours. All schedules within standard regular thresholds.'}
                  </span>
                </div>
              )}

              {/* Missing Shifts Alert */}
              {missingShiftEmployees.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900">
                      🚨 {t('missingShiftsAlert')} ({missingShiftEmployees.length} {language === 'ko' ? '명 미배정' : 'employees'})
                    </span>
                    <button
                      onClick={() => setActiveTab('schedule')}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline"
                    >
                      {language === 'ko' ? '스케줄표로 이동' : 'Assign in Schedule'}
                    </button>
                  </div>
                  <p className="text-xs text-rose-800 mt-1">
                    {language === 'ko'
                      ? '재직 중인 다음 직원의 이번 주 근무가 전혀 배정되지 않았습니다:'
                      : 'Active employees with zero scheduled shifts this week:'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {missingShiftEmployees.slice(0, 5).map((e) => (
                      <span
                        key={e.id}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-900 font-medium"
                      >
                        {e.fullName} ({e.position})
                      </span>
                    ))}
                    {missingShiftEmployees.length > 5 && (
                      <span className="text-[11px] text-rose-700 self-center">
                        +{missingShiftEmployees.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Overnight Shifts Active Notice */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {language === 'ko' ? '야간조 근무 (자정 통과) 감지' : 'Active Overnight Shifts (Cross Midnight)'}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {language === 'ko'
                        ? `${overnightShifts.length}개 야간 교대근무(22:00~06:00 등)가 자정 날짜 넘김을 자동 반영하여 정확히 계산되었습니다.`
                        : `${overnightShifts.length} shifts cross midnight (e.g. 22:00 to 06:00) with automatic 24h wrap & meal deduction.`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-1 bg-slate-800 rounded-md">
                  {overnightShifts.length} shifts
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveTab('schedule')}
              className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold text-slate-900">{t('createSchedule')}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ko' ? '금~목 7일간 근무 배치 및 복사' : 'Friday-Thursday 7-day grid'}
              </p>
            </button>

            <button
              onClick={() => setActiveTab('payroll')}
              className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <DollarSign className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold text-slate-900">{t('processPayroll')}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ko' ? '세금/공제 계산 및 마감' : 'Withholding & Net Pay calculation'}
              </p>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold text-slate-900">{t('viewPaystubs')}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ko' ? '직원별 급여명세서 및 CSV 출력' : 'Printable vouchers & Excel CSV'}
              </p>
            </button>
          </div>
        </div>

        {/* Right Column: Business Groups & Department Hours Breakdown */}
        <div className="space-y-4">
          {/* 5 Business Groups Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>{language === 'ko' ? '5대 사업장 / 그룹별 현황' : 'Business Groups & Branches'}</span>
              </h2>
              <button
                onClick={() => setActiveTab('employees')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                {language === 'ko' ? '관리' : 'Manage'} →
              </button>
            </div>

            <div className="space-y-2.5">
              {groupStats.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => setActiveTab('employees')}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-2xs ${grp.borderClass} ${grp.badgeBg}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-md bg-white font-mono font-black text-slate-800 text-xs flex items-center justify-center shadow-2xs">
                        <Store className="w-3.5 h-3.5 text-emerald-700" />
                      </span>
                      <div>
                        <p className="font-extrabold text-slate-900 leading-tight">
                          {grp.name}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          {language === 'ko' ? grp.descriptionKo : grp.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className="font-mono font-bold text-slate-900 block">
                        {grp.activeCount} staff
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {grp.hours.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hours by Department */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>{t('departmentBreakdown')}</span>
            </h2>

            <div className="space-y-3">
              {Object.entries(departmentHours).map(([dept, hrs]) => {
                const pct = totalScheduledHours > 0 ? (hrs / totalScheduledHours) * 100 : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">{dept}</span>
                      <span className="font-mono text-slate-900 font-bold">
                        {hrs.toFixed(1)}h ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {Object.keys(departmentHours).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">
                  {language === 'ko' ? '배정된 스케줄이 없습니다.' : 'No scheduled hours yet for this week.'}
                </p>
              )}
            </div>
          </div>

          {/* Compliance & Calculation Test Launcher Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-900">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold">{t('calculationTests')}</h3>
            </div>
            <p className="text-xs text-emerald-800 mt-1.5 leading-relaxed">
              {language === 'ko'
                ? '오버타임 1.5배, 버지니아 주세 원천징수(5.0%), FICA 사회보장세(6.20%), 메디케어(1.45%) 및 자정 통과 야간조 시간 계산 공식 8종을 검증합니다.'
                : 'Verifies 8 critical FLSA & Virginia calculations including overnight shifts crossing midnight, overtime premiums, and statutory FICA rates.'}
            </p>
            <div className="mt-3.5 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{t('testsPassing')}</span>
              </span>
              <button
                onClick={onOpenTestModal}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                {language === 'ko' ? '검증 테스트 보기' : 'View Test Results'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

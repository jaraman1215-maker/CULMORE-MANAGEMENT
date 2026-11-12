import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Archive,
  CheckCircle,
  XCircle,
  DollarSign,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  FileText,
  Building,
  RotateCcw,
  UserCheck,
  UserX,
  Store,
} from 'lucide-react';
import {
  Employee,
  GroceryDepartment,
  BusinessGroupId,
  BusinessGroupName,
  BUSINESS_GROUPS,
  getBusinessGroup,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/calculations';

interface EmployeesViewProps {
  employees: Employee[];
  onSaveEmployee: (employee: Employee) => Promise<void>;
  onArchiveEmployee: (employeeId: string, active: boolean) => Promise<void>;
  onSeedSampleData: () => Promise<void>;
}

const DEPARTMENTS: GroceryDepartment[] = [
  'Produce',
  'Meat & Seafood',
  'Deli & Prepared Foods',
  'Bakery',
  'Cashiers & Front End',
  'Grocery & Stocking',
  'Pharmacy & Health',
  'Kitchen & Cooking',
  'Dining & Service',
  'Management',
];

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onSaveEmployee,
  onArchiveEmployee,
  onSeedSampleData,
}) => {
  const { t, language } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [employeeSubTab, setEmployeeSubTab] = useState<'active' | 'inactive'>('active');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmArchiveEmp, setConfirmArchiveEmp] = useState<Employee | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Employee>>({
    employeeId: '',
    fullName: '',
    fullNameKo: '',
    position: '',
    department: 'Cashiers & Front End',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 16.00,
    hireDate: new Date().toISOString().split('T')[0],
    phone: '',
    email: '',
    notes: '',
    withholdFederal: true,
    withholdVirginia: true,
    withholdSocialSecurity: true,
    withholdMedicare: true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingEmployee(null);
    const nextIdNum = 101 + employees.length;
    const defaultGrp = selectedGroup !== 'ALL'
      ? BUSINESS_GROUPS.find((g) => g.id === selectedGroup) || BUSINESS_GROUPS[1]
      : BUSINESS_GROUPS[1];

    setFormData({
      employeeId: `EMP-${nextIdNum}`,
      fullName: '',
      fullNameKo: '',
      position: '',
      department: defaultGrp.groupNumber === 1 ? 'Pharmacy & Health' : (defaultGrp.groupNumber >= 3 ? 'Kitchen & Cooking' : 'Cashiers & Front End'),
      businessGroup: defaultGrp.name,
      groupNumber: defaultGrp.groupNumber,
      active: true,
      hourlyWage: 16.50,
      hireDate: new Date().toISOString().split('T')[0],
      phone: '',
      email: '',
      notes: '',
      withholdFederal: true,
      withholdVirginia: true,
      withholdSocialSecurity: true,
      withholdMedicare: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    const resolvedGrp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
    setFormData({
      ...emp,
      businessGroup: resolvedGrp.name,
      groupNumber: resolvedGrp.groupNumber,
      withholdFederal: emp.withholdFederal ?? true,
      withholdVirginia: emp.withholdVirginia ?? true,
      withholdSocialSecurity: emp.withholdSocialSecurity ?? true,
      withholdMedicare: emp.withholdMedicare ?? true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.employeeId?.trim()) {
      setFormError(language === 'ko' ? '사원 번호를 입력해주세요.' : 'Employee ID is required.');
      return;
    }
    if (!formData.fullName?.trim()) {
      setFormError(language === 'ko' ? '직원 영문 성명을 입력해주세요.' : 'Full English name is required.');
      return;
    }
    if (!formData.position?.trim()) {
      setFormError(language === 'ko' ? '담당 직책을 입력해주세요.' : 'Position is required.');
      return;
    }
    const wage = Number(formData.hourlyWage);
    if (isNaN(wage) || wage <= 0) {
      setFormError(
        language === 'ko'
          ? '올바른 시급 금액을 입력해주세요.'
          : 'Please enter a valid hourly wage amount.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const resolvedGrp = getBusinessGroup(formData.businessGroup || formData.groupNumber);
      const employeePayload: Employee = {
        id: editingEmployee ? editingEmployee.id : `emp_${formData.employeeId}`,
        employeeId: formData.employeeId.trim().toUpperCase(),
        fullName: formData.fullName.trim(),
        fullNameKo: formData.fullNameKo?.trim() || '',
        position: formData.position.trim(),
        department: (formData.department as GroceryDepartment) || 'Grocery & Stocking',
        businessGroup: resolvedGrp.name,
        groupNumber: resolvedGrp.groupNumber,
        active: formData.active ?? true,
        hourlyWage: isNaN(wage) ? 0 : wage,
        hireDate: formData.hireDate || new Date().toISOString().split('T')[0],
        phone: formData.phone?.trim() || '',
        email: formData.email?.trim() || '',
        notes: formData.notes?.trim() || '',
        withholdFederal: formData.withholdFederal ?? true,
        withholdVirginia: formData.withholdVirginia ?? true,
        withholdSocialSecurity: formData.withholdSocialSecurity ?? true,
        withholdMedicare: formData.withholdMedicare ?? true,
      };

      await onSaveEmployee(employeePayload);
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async (emp: Employee) => {
    try {
      await onArchiveEmployee(emp.id, !emp.active);
      setConfirmArchiveEmp(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter employees based on active/inactive subtab and filters
  const filteredEmployees = employees.filter((emp) => {
    // Sub-tab separation: Active vs Inactive
    if (employeeSubTab === 'active' && !emp.active) return false;
    if (employeeSubTab === 'inactive' && emp.active) return false;

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      emp.fullName.toLowerCase().includes(term) ||
      (emp.fullNameKo && emp.fullNameKo.toLowerCase().includes(term)) ||
      emp.employeeId.toLowerCase().includes(term) ||
      emp.position.toLowerCase().includes(term);

    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;

    const empGrp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
    const matchesGroup = selectedGroup === 'ALL' || empGrp.id === selectedGroup;

    return matchesSearch && matchesDept && matchesGroup;
  });

  const activeCount = employees.filter((e) => e.active).length;
  const inactiveCount = employees.filter((e) => !e.active).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t('employeeDirectory')}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ko'
              ? '개별 시급 설정, 7대 부서 배치, 재직/퇴사 상태 관리 (퇴사 처리 시에도 과거 급여 내역은 영구 보존됩니다).'
              : 'Individual wage settings, grocery department assignments, active/archived employee tracking.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {employees.length === 0 && (
            <button
              onClick={onSeedSampleData}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              {t('loadDemoData')}
            </button>
          )}

          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-700/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addEmployee')}</span>
          </button>
        </div>
      </div>

      {/* Dedicated Business Group Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Tab Header Strip */}
        <div className="flex items-center space-x-1 p-2 bg-slate-100/70 border-b border-slate-200 overflow-x-auto no-scrollbar">
          {/* ALL Staff Tab */}
          <button
            onClick={() => setSelectedGroup('ALL')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center space-x-2 shrink-0 cursor-pointer ${
              selectedGroup === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'ko' ? '전체 직원 명부' : 'All Staff Roster'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                selectedGroup === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {employees.length}
            </span>
          </button>

          {/* Individual Group Tabs (No group numbers) */}
          {BUSINESS_GROUPS.map((grp) => {
            const isSelected = selectedGroup === grp.id;
            const grpEmps = employees.filter(
              (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
            );
            const activeGrpCount = grpEmps.filter((e) => e.active).length;

            return (
              <button
                key={grp.id}
                onClick={() => setSelectedGroup(grp.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center space-x-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? `${grp.badgeBg} ${grp.borderClass} border shadow-xs ring-2 ring-emerald-500/20`
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span>{grp.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    isSelected ? 'bg-white shadow-2xs font-extrabold text-slate-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {activeGrpCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Group Branch Detail Banner */}
        {selectedGroup !== 'ALL' && (() => {
          const currentGrp = BUSINESS_GROUPS.find((g) => g.id === selectedGroup)!;
          const grpEmps = employees.filter(
            (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === currentGrp.id
          );
          const activeEmps = grpEmps.filter((e) => e.active);
          const avgWage =
            activeEmps.length > 0
              ? activeEmps.reduce((sum, e) => sum + e.hourlyWage, 0) / activeEmps.length
              : 0;

          return (
            <div className={`p-4 ${currentGrp.badgeBg} border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-800">
                  <Store className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{currentGrp.name}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {currentGrp.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-xs font-medium text-slate-700 shrink-0">
                <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    {language === 'ko' ? '재직 직원' : 'Active Staff'}
                  </span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {activeEmps.length} <span className="text-xs font-normal text-slate-500">/ {grpEmps.length}명</span>
                  </span>
                </div>

                <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    {language === 'ko' ? '평균 시급' : 'Avg Wage'}
                  </span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    {formatCurrency(avgWage)}<span className="text-xs font-normal text-slate-500">/hr</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? `이 그룹에 직원 등록` : `Add to ${currentGrp.shortName}`}</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Active vs Inactive Employee Status Sub-tabs (Item 12) */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setEmployeeSubTab('active')}
            className={`px-4 py-2.5 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              employeeSubTab === 'active'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>{language === 'ko' ? '재직 직원 목록' : 'Active Employees'}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800">
              {employees.filter((e) => (selectedGroup === 'ALL' || getBusinessGroup(e.businessGroup || e.groupNumber).id === selectedGroup) && e.active).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEmployeeSubTab('inactive')}
            className={`px-4 py-2.5 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              employeeSubTab === 'inactive'
                ? 'border-amber-600 text-amber-800 bg-amber-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <UserX className="w-4 h-4 text-amber-600" />
            <span>{language === 'ko' ? '퇴사 / 비활성 직원 관리' : 'Inactive / Archived Employees'}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-900">
              {employees.filter((e) => (selectedGroup === 'ALL' || getBusinessGroup(e.businessGroup || e.groupNumber).id === selectedGroup) && !e.active).length}
            </span>
          </button>
        </div>

        {employeeSubTab === 'inactive' && (
          <p className="text-[11px] text-amber-700 font-medium hidden md:block">
            {language === 'ko' ? '비활성 직원은 언제든지 [재직으로 복귀] 버튼을 눌러 다시 활성화할 수 있습니다.' : 'Inactive employees can be reactivated anytime.'}
          </p>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchEmployees')}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Department filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">{t('filterDepartment')}</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('employeeId')}</th>
                <th className="py-3 px-4">{t('fullName')}</th>
                <th className="py-3 px-4">{language === 'ko' ? '사업장/그룹' : 'Business Group'}</th>
                <th className="py-3 px-4">{t('department')}</th>
                <th className="py-3 px-4">{t('position')}</th>
                <th className="py-3 px-4">{t('hourlyWage')}</th>
                <th className="py-3 px-4">{t('hireDate')}</th>
                <th className="py-3 px-4">{t('status')}</th>
                <th className="py-3 px-4 text-right">{t('tableActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
                return (
                <tr
                  key={emp.id}
                  className={`hover:bg-slate-50/60 transition-colors ${
                    !emp.active ? 'opacity-75 bg-amber-50/20' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {emp.employeeId}
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-bold text-slate-900">{emp.fullName}</p>
                      {emp.fullNameKo && (
                        <p className="text-[11px] text-slate-500 font-medium">{emp.fullNameKo}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] border ${grp.badgeBg}`}
                      title={language === 'ko' ? grp.descriptionKo : grp.description}
                    >
                      <span>{grp.name}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      {emp.department}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {emp.position}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-sm">
                    {formatCurrency(emp.hourlyWage)}/hr
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {emp.hireDate}
                  </td>
                  <td className="py-3 px-4">
                    {emp.active ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{t('active')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{language === 'ko' ? '비활성 (퇴사)' : 'Inactive'}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => openEditModal(emp)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title={t('editEmployee')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {emp.active ? (
                        <button
                          onClick={() => setConfirmArchiveEmp(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title={t('archiveEmployee')}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmArchiveEmp(emp)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center space-x-1 border border-emerald-200 transition-colors cursor-pointer"
                          title={language === 'ko' ? '재직 직원으로 복귀' : 'Reactivate Employee'}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{language === 'ko' ? '재직 복귀' : 'Reactivate'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {language === 'ko'
                      ? (employeeSubTab === 'inactive' ? '비활성(퇴사) 직원이 없습니다.' : '일치하는 재직 직원이 없습니다.')
                      : 'No employees found matching filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-900">
                {editingEmployee ? t('editEmployee') : t('addEmployee')}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('employeeId')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="e.g. EMP-101"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('hourlyWage')} ($/hr) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="e.g. 12.77"
                      value={formData.hourlyWage !== undefined && formData.hourlyWage !== null ? formData.hourlyWage : ''}
                      onChange={(e) => setFormData({ ...formData, hourlyWage: e.target.value === '' ? ('' as unknown as number) : parseFloat(e.target.value) })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('fullName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Min-Jun Kim"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('fullNameKo')}
                  </label>
                  <input
                    type="text"
                    value={formData.fullNameKo}
                    onChange={(e) => setFormData({ ...formData, fullNameKo: e.target.value })}
                    placeholder="예: 김민준"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Business Group / Branch Selection */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="font-bold text-slate-800 text-xs block mb-1.5 flex items-center justify-between">
                  <span>{language === 'ko' ? '소속 사업장 / 그룹 선택 *' : 'Assigned Business Group / Branch *'}</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    {language === 'ko' ? '매장 브랜드' : 'Store Group'}
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUSINESS_GROUPS.map((grp) => {
                    const isCurrent = (formData.businessGroup === grp.name) || (formData.groupNumber === grp.groupNumber);
                    return (
                      <button
                        type="button"
                        key={grp.id}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            businessGroup: grp.name,
                            groupNumber: grp.groupNumber,
                          });
                        }}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center space-x-2.5 ${
                          isCurrent
                            ? `${grp.borderClass} ${grp.badgeBg} ring-2 ring-emerald-500/20 font-bold shadow-2xs`
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-extrabold text-[11px] truncate leading-tight text-slate-900">
                            {grp.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                            {language === 'ko' ? grp.descriptionKo : grp.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('department')} *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value as GroceryDepartment })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('position')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="e.g. Produce Specialist"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('hireDate')} *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('status')}
                  </label>
                  <div className="flex items-center space-x-4 pt-2">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="activeStatus"
                        checked={formData.active === true}
                        onChange={() => setFormData({ ...formData, active: true })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-800 font-semibold">{t('active')}</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="activeStatus"
                        checked={formData.active === false}
                        onChange={() => setFormData({ ...formData, active: false })}
                        className="text-slate-500 focus:ring-slate-400"
                      />
                      <span className="text-slate-600 font-semibold">{t('inactive')}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('phone')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(703) 555-0100"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="emp@hanaromarket.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Default Withholding Tax Selections for Employee */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs block">
                    {language === 'ko' ? '기본 원천징수 세금 선택' : 'Default Tax Withholding Preferences'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {language === 'ko' ? 'W-4 및 VA-4 신고 기준' : 'W-4 & VA-4 Election'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80">
                    <input
                      type="checkbox"
                      checked={formData.withholdFederal !== false}
                      onChange={(e) => setFormData({ ...formData, withholdFederal: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-800 font-semibold">{t('applyFederalTax')}</span>
                  </label>

                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80">
                    <input
                      type="checkbox"
                      checked={formData.withholdVirginia !== false}
                      onChange={(e) => setFormData({ ...formData, withholdVirginia: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-800 font-semibold">{t('applyVaTax')}</span>
                  </label>

                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80">
                    <input
                      type="checkbox"
                      checked={formData.withholdSocialSecurity !== false}
                      onChange={(e) => setFormData({ ...formData, withholdSocialSecurity: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-800 font-semibold">{t('applySocialSecurity')}</span>
                  </label>

                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80">
                    <input
                      type="checkbox"
                      checked={formData.withholdMedicare !== false}
                      onChange={(e) => setFormData({ ...formData, withholdMedicare: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-800 font-semibold">{t('applyMedicare')}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('notes')}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={language === 'ko' ? '관리자 메모 (자격증, 주말 선호 등)' : 'Internal notes (certifications, night stocking, etc.)'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Saving...' : t('saveEmployee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation modal for archive/deactivate */}
      {confirmArchiveEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-600 mb-3">
              <Archive className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">
                {confirmArchiveEmp.active ? t('archiveEmployee') : t('reactivateEmployee')}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {confirmArchiveEmp.active
                ? t('confirmArchive')
                : (language === 'ko' ? '이 직원을 재직 상태로 복원하시겠습니까?' : 'Reactivate this employee to include them in new weekly schedules?')}
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 mb-5">
              <p className="font-bold text-slate-900">{confirmArchiveEmp.fullName} ({confirmArchiveEmp.employeeId})</p>
              <p className="text-slate-500">{confirmArchiveEmp.position} • {confirmArchiveEmp.department}</p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmArchiveEmp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => handleToggleArchive(confirmArchiveEmp)}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs ${
                  confirmArchiveEmp.active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmArchiveEmp.active ? t('archiveEmployee') : t('reactivateEmployee')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export type Language = 'en' | 'ko';

export type AdminRole = 'super_admin' | 'admin' | 'manager';

export interface Administrator {
  uid: string;
  email: string;
  loginId?: string;
  name: string;
  role: AdminRole;
  createdAt: string;
  createdBy?: string;
}

export type GroceryDepartment = 
  | 'Produce'
  | 'Meat & Seafood'
  | 'Deli & Prepared Foods'
  | 'Bakery'
  | 'Cashiers & Front End'
  | 'Grocery & Stocking'
  | 'Management'
  | 'Pharmacy & Health'
  | 'Kitchen & Cooking'
  | 'Dining & Service';

export type BusinessGroupId = 'group_1' | 'group_2' | 'group_3' | 'group_4' | 'group_5';

export type BusinessGroupName =
  | 'CMORE DRUG STORE'
  | 'CULMORE SUPERMARKET'
  | 'TACOSSAM(FALLS CHURCH)'
  | 'TACOSSAM(ANANDALE)'
  | 'SSAM KITCHEN';

export interface BusinessGroup {
  id: BusinessGroupId;
  groupNumber: 1 | 2 | 3 | 4 | 5;
  name: BusinessGroupName;
  nameKo: string;
  shortName: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  accentBg: string;
  description: string;
  descriptionKo: string;
}

export const BUSINESS_GROUPS: BusinessGroup[] = [
  {
    id: 'group_1',
    groupNumber: 1,
    name: 'CMORE DRUG STORE',
    nameKo: 'CMORE DRUG STORE',
    shortName: 'CMORE DRUG',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badgeText: 'text-emerald-700',
    borderClass: 'border-emerald-500',
    accentBg: 'bg-emerald-600',
    description: 'Pharmacy, Wellness & OTC retail store',
    descriptionKo: '약국, 건강보조제 및 드럭스토어 매장',
  },
  {
    id: 'group_2',
    groupNumber: 2,
    name: 'CULMORE SUPERMARKET',
    nameKo: 'CULMORE SUPERMARKET',
    shortName: 'CULMORE SUPER',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    badgeText: 'text-blue-700',
    borderClass: 'border-blue-500',
    accentBg: 'bg-blue-600',
    description: 'Full-service grocery, fresh produce, meat & cashier front-end',
    descriptionKo: '종합 식료품, 농산/수산/정육, 프론트 계산원 마트',
  },
  {
    id: 'group_3',
    groupNumber: 3,
    name: 'TACOSSAM(FALLS CHURCH)',
    nameKo: 'TACOSSAM(FALLS CHURCH)',
    shortName: 'TACOSSAM FC',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    badgeText: 'text-amber-700',
    borderClass: 'border-amber-500',
    accentBg: 'bg-amber-600',
    description: 'Mexican-Korean fusion dining - Falls Church branch',
    descriptionKo: '타코쌈 폴스처치 지점 다이닝',
  },
  {
    id: 'group_4',
    groupNumber: 4,
    name: 'TACOSSAM(ANANDALE)',
    nameKo: 'TACOSSAM(ANANDALE)',
    shortName: 'TACOSSAM AD',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    badgeText: 'text-purple-700',
    borderClass: 'border-purple-500',
    accentBg: 'bg-purple-600',
    description: 'Mexican-Korean fusion dining - Annandale branch',
    descriptionKo: '타코쌈 애난데일 지점 다이닝',
  },
  {
    id: 'group_5',
    groupNumber: 5,
    name: 'SSAM KITCHEN',
    nameKo: 'SSAM KITCHEN',
    shortName: 'SSAM KITCHEN',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
    badgeText: 'text-rose-700',
    borderClass: 'border-rose-500',
    accentBg: 'bg-rose-600',
    description: 'Central commissary kitchen, meal prep & catering production',
    descriptionKo: '센트럴 키친, 밀키트/반찬 조리 및 케이터링 생산',
  },
];

export function getBusinessGroup(groupVal?: string | number): BusinessGroup {
  if (!groupVal) return BUSINESS_GROUPS[1]; // default to CULMORE SUPERMARKET
  if (typeof groupVal === 'number') {
    const found = BUSINESS_GROUPS.find((g) => g.groupNumber === groupVal);
    if (found) return found;
  }
  const str = String(groupVal).trim().toUpperCase();
  if (str === 'GROUP_1' || str === 'GROUP 1' || str === '1' || str.includes('CMORE') || str.includes('DRUG')) return BUSINESS_GROUPS[0];
  if (str === 'GROUP_2' || str === 'GROUP 2' || str === '2' || str.includes('CULMORE') || str.includes('SUPERMARKET')) return BUSINESS_GROUPS[1];
  if (str === 'GROUP_3' || str === 'GROUP 3' || str === '3' || str.includes('FALLS')) return BUSINESS_GROUPS[2];
  if (str === 'GROUP_4' || str === 'GROUP 4' || str === '4' || str.includes('ANANDALE') || str.includes('ANNANDALE')) return BUSINESS_GROUPS[3];
  if (str === 'GROUP_5' || str === 'GROUP 5' || str === '5' || str.includes('SSAM') || str.includes('KITCHEN')) return BUSINESS_GROUPS[4];
  const exact = BUSINESS_GROUPS.find((g) => g.name.toUpperCase() === str || g.id.toUpperCase() === str);
  return exact || BUSINESS_GROUPS[1];
}

export interface Employee {
  id: string; // Firestore doc ID
  employeeId: string; // e.g. EMP-101
  fullName: string;
  fullNameKo?: string;
  nickname?: string;
  position: string;
  department: GroceryDepartment;
  businessGroup?: BusinessGroupName; // Group 1 to 5
  groupNumber?: 1 | 2 | 3 | 4 | 5;
  active: boolean;
  hourlyWage: number;
  hireDate: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  notes?: string;
  withholdFederal?: boolean;
  withholdVirginia?: boolean;
  withholdSocialSecurity?: boolean;
  withholdMedicare?: boolean;
  customFederalRate?: number;
  customVaRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ShiftStatus = 'scheduled' | 'completed' | 'absent' | 'sick';

export interface Shift {
  id: string; // Firestore doc ID
  scheduleId: string; // YYYY-MM-DD representing Friday start
  employeeId: string;
  employeeName: string;
  position?: string; // Direct position per shift (e.g. Cashier, Meat Cutter, Kitchen Prep)
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 'Friday' | 'Saturday' | ...
  startTime: string; // 'HH:MM' 24h format
  endTime: string; // 'HH:MM' 24h format
  breakMinutes: number; // e.g. actual break minutes
  paidBreakMinutes?: number; // automatically granted paid break (30/60m general, 20/40m cashier)
  actualBreakMinutes?: number; // actual break taken by employee
  excessBreakMinutes?: number; // unpaid excess break deducted (actual - paid)
  rawHours?: number; // gross shift hours before any excess break deduction
  hours: number; // computed net payable working hours
  isOvernight: boolean; // crosses midnight
  businessGroup?: BusinessGroupName;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklySchedule {
  id: string; // Format: 'sched_YYYY-MM-DD' (Friday date)
  weekStartDate: string; // YYYY-MM-DD (Friday)
  weekEndDate: string; // YYYY-MM-DD (Thursday)
  status: 'draft' | 'published' | 'archived';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export type PayrollStatus = 'draft' | 'pending_review' | 'finalized';

export interface PayrollAdjustment {
  id: string;
  reason: string;
  amount: number; // can be positive or negative
  adminEmail: string;
  timestamp: string;
}

export interface WorkWeekDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  dayOfWeekKo: string;
  shortDay: string;
  shortDayKo: string;
  displayDate: string;
  displayDateKo: string;
  fullDateUs: string;
}

export interface PayrollRecord {
  id: string; // e.g. pay_YYYY-MM-DD_EMP-101
  periodId: string; // matches PayrollPeriod id
  employeeId: string;
  employeeName: string;
  position: string;
  department: GroceryDepartment;
  businessGroup?: BusinessGroupName;
  groupNumber?: 1 | 2 | 3 | 4 | 5;
  hourlyWage: number;
  regularHours: number; // up to 40.0
  overtimeHours: number; // hours > 40.0
  regularPay: number; // regularHours * hourlyWage
  overtimePay: number; // overtimeHours * (hourlyWage * 1.5)
  grossPay: number; // regularPay + overtimePay + adjustments
  federalWithholding: number; // Estimated Federal Income Tax
  vaWithholding: number; // Virginia State Income Tax
  socialSecurityTax: number; // 6.20%
  medicareTax: number; // 1.45%
  totalTaxes: number; // federal + va + ss + med
  insuranceDeduction: number;
  otherDeductions: number;
  totalDeductions: number; // federal + va + ss + med + ins + other
  netPay: number; // grossPay - totalDeductions
  withholdFederal?: boolean;
  withholdVirginia?: boolean;
  withholdSocialSecurity?: boolean;
  withholdMedicare?: boolean;
  // Custom Payment & Tax Allocation (Check vs Cash, Taxable Hours, Manual Tax Override)
  paymentMethod?: 'ALL_CHECK' | 'ALL_CASH' | 'SPLIT';
  taxableHours?: number; // Hours subject to tax withholding (e.g. 40h)
  cashHours?: number; // Hours paid in cash without tax withholding
  checkAmount?: number; // Amount paid via official payroll check
  cashAmount?: number; // Amount paid via cash
  isManualTax?: boolean; // When true, taxes are overridden manually by manager
  manualFederalWithholding?: number;
  manualVaWithholding?: number;
  manualSocialSecurityTax?: number;
  manualMedicareTax?: number;
  notes?: string;
  isAdjusted?: boolean;
  adjustments?: PayrollAdjustment[];
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentMethod = 'ALL_CHECK' | 'ALL_CASH' | 'SPLIT';

export interface PayrollPeriod {
  id: string; // e.g. 'period_YYYY-MM-DD' (Friday date)
  weekStartDate: string; // Friday
  weekEndDate: string; // Thursday
  status: PayrollStatus;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalGrossPay: number;
  totalTaxes: number;
  totalDeductions: number;
  totalNetPay: number;
  finalizedAt?: string;
  finalizedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupStoreInfo {
  storeName: string;
  storeNameKo: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  ein: string;
  managerName?: string;
}

export interface StoreSettings {
  id: string; // 'store_settings'
  storeName: string;
  storeNameKo: string;
  address: string;
  city: string;
  state: string; // 'VA'
  zipCode: string;
  phone: string;
  ein: string; // Employer ID Number for paystubs
  federalTaxDefaultRate: number; // e.g. 10.0 (%)
  vaTaxDefaultRate: number; // e.g. 5.0 (%)
  socialSecurityRate: number; // 6.20 (%)
  medicareRate: number; // 1.45 (%)
  overtimeMultiplier: number; // 1.5
  defaultBreakMinutes: number; // 30
  workWeekStartDay: string; // 'Friday'
  workspacePasscode?: string; // 6-digit workspace entry passcode (editable only by jaraman1215@gmail.com)
  groupSettings?: Record<string, GroupStoreInfo>; // Per-group store information
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Returns store info specifically configured for the given business group, falling back to base settings.
 */
export function getGroupStoreInfo(settings: StoreSettings, groupVal?: string | number): GroupStoreInfo {
  const grp = getBusinessGroup(groupVal);
  if (settings.groupSettings && settings.groupSettings[grp.id]) {
    const custom = settings.groupSettings[grp.id];
    return {
      storeName: custom.storeName || grp.name,
      storeNameKo: custom.storeNameKo || grp.nameKo,
      address: custom.address || settings.address || '4210 John Marr Dr',
      city: custom.city || settings.city || 'Annandale',
      state: custom.state || settings.state || 'VA',
      zipCode: custom.zipCode || settings.zipCode || '22003',
      phone: custom.phone || settings.phone || '(703) 555-0199',
      ein: custom.ein || settings.ein || '54-1928374',
      managerName: custom.managerName || 'Store Manager',
    };
  }

  // Sensible defaults tailored per group
  return {
    storeName: grp.name,
    storeNameKo: grp.nameKo,
    address: settings.address || '4210 John Marr Dr',
    city: settings.city || 'Annandale',
    state: settings.state || 'VA',
    zipCode: settings.zipCode || '22003',
    phone: settings.phone || '(703) 555-0199',
    ein: settings.ein || '54-1928374',
    managerName: 'Store Manager',
  };
}

export interface AuditLog {
  id: string;
  action: string;
  entity: 'EMPLOYEE' | 'SCHEDULE' | 'PAYROLL' | 'SETTINGS' | 'ADMIN';
  entityId: string;
  details: string;
  performedBy: string;
  performedByEmail: string;
  timestamp: string;
}

export interface ScheduleBackupFile {
  type: 'CULMORE_SCHEDULE_BACKUP';
  version: number;
  id: string;
  weekStartDate: string;
  exportedAt: string;
  reason: 'auto' | 'manual';
  shiftCount: number;
  shifts: Shift[];
}

export interface FinalPayrollArchive {
  type: 'CULMORE_FINAL_PAYROLL_ARCHIVE';
  version: number;
  id: string;
  savedAt: string;
  finalizedBy: string;
  period: PayrollPeriod;
  records: PayrollRecord[];
  employees: Employee[];
  settings: StoreSettings;
}

export type PasswordResetTargetType = 'employee' | 'admin';

export type PasswordResetStatus = 'pending' | 'verified' | 'completed' | 'expired' | 'revoked';

export interface PasswordResetRequest {
  id: string;
  targetType: PasswordResetTargetType;
  targetUid?: string;
  targetName: string;
  email: string;
  loginId?: string;
  codeHash: string;
  firebaseEmailSent: boolean;
  status: PasswordResetStatus;
  expiresAt: string;
  createdAt: string;
  requestedBy: string;
  verifiedAt?: string;
  completedAt?: string;
}


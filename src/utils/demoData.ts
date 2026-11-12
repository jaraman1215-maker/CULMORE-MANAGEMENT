import { Employee, Shift, StoreSettings } from '../types';
import { getWorkWeekFriday, getDaysInWorkWeek } from './dateUtils';
import { calculateShiftHours, isCashierEmployee } from './calculations';

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  id: 'store_settings',
  storeName: 'MANAGEMENT OF CULMORE',
  storeNameKo: 'MANAGEMENT OF CULMORE',
  address: '4210 John Marr Dr',
  city: 'Annandale',
  state: 'VA',
  zipCode: '22003',
  phone: '(703) 555-0199',
  ein: '54-1928374',
  federalTaxDefaultRate: 10.0,
  vaTaxDefaultRate: 5.0,
  socialSecurityRate: 6.20,
  medicareRate: 1.45,
  overtimeMultiplier: 1.5,
  defaultBreakMinutes: 30,
  workWeekStartDay: 'Friday',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

export const SAMPLE_EMPLOYEES: Employee[] = [
  // -------------------------------------------------------------
  // Group 1: CMORE DRUG STORE (1번 그룹)
  // -------------------------------------------------------------
  {
    id: 'emp_01',
    employeeId: 'EMP-101',
    fullName: 'Min-Jun Kim',
    fullNameKo: '김민준',
    position: 'Pharmacy Manager & Lead',
    department: 'Pharmacy & Health',
    businessGroup: 'CMORE DRUG STORE',
    groupNumber: 1,
    active: true,
    hourlyWage: 26.50,
    hireDate: '2022-03-15',
    phone: '(703) 555-0101',
    email: 'minjun.kim@cmoredrug.com',
    notes: 'Licensed pharmacist in charge, OTC inventory & supplier coordinator.',
  },
  {
    id: 'emp_02',
    employeeId: 'EMP-102',
    fullName: 'Carlos Mendoza',
    fullNameKo: '카를로스 멘도자',
    position: 'Pharmacy Technician',
    department: 'Pharmacy & Health',
    businessGroup: 'CMORE DRUG STORE',
    groupNumber: 1,
    active: true,
    hourlyWage: 19.50,
    hireDate: '2023-05-10',
    phone: '(703) 555-0102',
    email: 'carlos.m@cmoredrug.com',
    notes: 'Prescription staging, insurance billing support, and stock refill.',
  },
  {
    id: 'emp_03',
    employeeId: 'EMP-103',
    fullName: 'Seo-Yeon Park',
    fullNameKo: '박서연',
    position: 'Health & Wellness Specialist',
    department: 'Pharmacy & Health',
    businessGroup: 'CMORE DRUG STORE',
    groupNumber: 1,
    active: true,
    hourlyWage: 17.50,
    hireDate: '2024-01-22',
    phone: '(703) 555-0103',
    email: 'seoyeon.park@cmoredrug.com',
    notes: 'Vitamin, Korean wellness products, and OTC customer consultation.',
  },
  {
    id: 'emp_04',
    employeeId: 'EMP-104',
    fullName: 'Linh Nguyen',
    fullNameKo: '린 응우옌',
    position: 'Beauty & Retail Associate',
    department: 'Pharmacy & Health',
    businessGroup: 'CMORE DRUG STORE',
    groupNumber: 1,
    active: true,
    hourlyWage: 16.50,
    hireDate: '2024-06-01',
    phone: '(703) 555-0104',
    email: 'linh.n@cmoredrug.com',
    notes: 'Cosmetics, personal care merchandising and checkout.',
  },
  {
    id: 'emp_24',
    employeeId: 'EMP-124',
    fullName: 'Kwang-Soo Park',
    fullNameKo: '박광수',
    position: 'Operations Lead (CMORE)',
    department: 'Management',
    businessGroup: 'CMORE DRUG STORE',
    groupNumber: 1,
    active: true,
    hourlyWage: 28.00,
    hireDate: '2019-09-01',
    phone: '(703) 555-0124',
    email: 'kwangsoo.park@culmorecorp.com',
    notes: 'Virginia store operations, pharmacy compliance, licensing records.',
  },

  // -------------------------------------------------------------
  // Group 2: CULMORE SUPERMARKET (2번 그룹)
  // -------------------------------------------------------------
  {
    id: 'emp_05',
    employeeId: 'EMP-105',
    fullName: 'Dong-Hyuk Lee',
    fullNameKo: '이동혁',
    position: 'Head Butcher',
    department: 'Meat & Seafood',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 24.50,
    hireDate: '2021-08-12',
    phone: '(703) 555-0105',
    email: 'donghyuk.lee@culmoresuper.com',
    notes: 'Certified meat cutter. Handles bulgogi, galbi, and pork belly prep.',
  },
  {
    id: 'emp_06',
    employeeId: 'EMP-106',
    fullName: 'David Santos',
    fullNameKo: '데이비드 산토스',
    position: 'Seafood Specialist',
    department: 'Meat & Seafood',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 19.00,
    hireDate: '2023-02-14',
    phone: '(703) 555-0106',
    email: 'david.s@culmoresuper.com',
    notes: 'Fresh fish scaling, sashimi preparation, shellfish displays.',
  },
  {
    id: 'emp_07',
    employeeId: 'EMP-107',
    fullName: 'Jin-Woo Choi',
    fullNameKo: '최진우',
    position: 'Meat Assistant',
    department: 'Meat & Seafood',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 17.00,
    hireDate: '2024-04-10',
    phone: '(703) 555-0107',
    email: 'jinwoo.c@culmoresuper.com',
    notes: 'Packaging, sanitary compliance, and display replenishment.',
  },
  {
    id: 'emp_12',
    employeeId: 'EMP-112',
    fullName: 'Tae-Sung An',
    fullNameKo: '안태성',
    position: 'Head Pastry Baker',
    department: 'Bakery',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 21.00,
    hireDate: '2022-01-15',
    phone: '(703) 555-0112',
    email: 'taesung.an@culmoresuper.com',
    notes: 'Early morning baker (04:00 AM starts). Fresh artisan breads & red bean pastries.',
  },
  {
    id: 'emp_13',
    employeeId: 'EMP-113',
    fullName: 'Eun-Ji Shin',
    fullNameKo: '신은지',
    position: 'Cake Decorator',
    department: 'Bakery',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 18.50,
    hireDate: '2023-04-18',
    phone: '(703) 555-0113',
    email: 'eunji.shin@culmoresuper.com',
    notes: 'Custom fresh cream cakes and seasonal dessert display.',
  },
  {
    id: 'emp_15',
    employeeId: 'EMP-115',
    fullName: 'Ji-Hye Moon',
    fullNameKo: '문지혜',
    position: 'Head Cashier / CSM',
    department: 'Cashiers & Front End',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 19.50,
    hireDate: '2021-04-10',
    phone: '(703) 555-0115',
    email: 'jihye.m@culmoresuper.com',
    notes: 'Customer service supervisor, cash drawer reconciliation.',
  },
  {
    id: 'emp_16',
    employeeId: 'EMP-116',
    fullName: 'Jessica Taylor',
    fullNameKo: '제시카 테일러',
    position: 'Full-time Cashier',
    department: 'Cashiers & Front End',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 16.50,
    hireDate: '2022-09-05',
    phone: '(703) 555-0116',
    email: 'jessica.t@culmoresuper.com',
    notes: 'Bilingual English/Korean customer relations.',
  },
  {
    id: 'emp_21',
    employeeId: 'EMP-121',
    fullName: 'Sang-Hoon Cho',
    fullNameKo: '조상훈',
    position: 'Night Stocking Lead',
    department: 'Grocery & Stocking',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 20.00,
    hireDate: '2022-05-15',
    phone: '(703) 555-0121',
    email: 'sanghoon.c@culmoresuper.com',
    notes: 'Overnight shift supervisor (22:00 to 06:00). Heavy freight logistics.',
  },
  {
    id: 'emp_22',
    employeeId: 'EMP-122',
    fullName: 'Marcus Washington',
    fullNameKo: '마커스 워싱턴',
    position: 'Night Stocker',
    department: 'Grocery & Stocking',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 17.50,
    hireDate: '2023-08-20',
    phone: '(703) 555-0122',
    email: 'marcus.w@culmoresuper.com',
    notes: 'Dry groceries and refrigerated aisle night replenishment.',
  },
  {
    id: 'emp_25',
    employeeId: 'EMP-125',
    fullName: 'Su-Jin Chae',
    fullNameKo: '채수진',
    position: 'Supermarket Assistant Manager',
    department: 'Management',
    businessGroup: 'CULMORE SUPERMARKET',
    groupNumber: 2,
    active: true,
    hourlyWage: 23.50,
    hireDate: '2021-02-15',
    phone: '(703) 555-0125',
    email: 'sujin.c@culmoresuper.com',
    notes: 'Staff scheduling coordinator, weekly payroll reviewer.',
  },

  // -------------------------------------------------------------
  // Group 3: TACOSSAM(FALLS CHURCH) (3번 그룹)
  // -------------------------------------------------------------
  {
    id: 'emp_08',
    employeeId: 'EMP-108',
    fullName: 'Soon-Ja Han',
    fullNameKo: '한순자',
    position: 'Branch Head Chef',
    department: 'Kitchen & Cooking',
    businessGroup: 'TACOSSAM(FALLS CHURCH)',
    groupNumber: 3,
    active: true,
    hourlyWage: 23.00,
    hireDate: '2020-11-05',
    phone: '(703) 555-0108',
    email: 'soonja.h@tacossam.com',
    notes: 'Leads kitchen line, marinated meats, taco recipes & salsa standards.',
  },
  {
    id: 'emp_09',
    employeeId: 'EMP-109',
    fullName: 'Mi-Kyung Jung',
    fullNameKo: '정미경',
    position: 'Sous Chef / Grill Cook',
    department: 'Kitchen & Cooking',
    businessGroup: 'TACOSSAM(FALLS CHURCH)',
    groupNumber: 3,
    active: true,
    hourlyWage: 19.00,
    hireDate: '2022-07-19',
    phone: '(703) 555-0109',
    email: 'mikyung.j@tacossam.com',
    notes: 'Hot taco grill, quesadilla station and fry prep.',
  },
  {
    id: 'emp_17',
    employeeId: 'EMP-117',
    fullName: 'Young-Jae Oh',
    fullNameKo: '오영재',
    position: 'Dining Service Lead',
    department: 'Dining & Service',
    businessGroup: 'TACOSSAM(FALLS CHURCH)',
    groupNumber: 3,
    active: true,
    hourlyWage: 17.50,
    hireDate: '2023-06-15',
    phone: '(703) 555-0117',
    email: 'youngjae.o@tacossam.com',
    notes: 'Floor supervisor, host stand, and POS order dispatch.',
  },
  {
    id: 'emp_18',
    employeeId: 'EMP-118',
    fullName: 'Fatima Al-Mansoor',
    fullNameKo: '파티마 알만수르',
    position: 'Front Service & Cashier',
    department: 'Dining & Service',
    businessGroup: 'TACOSSAM(FALLS CHURCH)',
    groupNumber: 3,
    active: true,
    hourlyWage: 16.00,
    hireDate: '2023-10-02',
    phone: '(703) 555-0118',
    email: 'fatima.a@tacossam.com',
    notes: 'Evening counter service, beverage bar, takeout orders.',
  },

  // -------------------------------------------------------------
  // Group 4: TACOSSAM(ANANDALE) (4번 그룹)
  // -------------------------------------------------------------
  {
    id: 'emp_10',
    employeeId: 'EMP-110',
    fullName: 'Maria Hernandez',
    fullNameKo: '마리아 에르난데스',
    position: 'Branch Kitchen Lead',
    department: 'Kitchen & Cooking',
    businessGroup: 'TACOSSAM(ANANDALE)',
    groupNumber: 4,
    active: true,
    hourlyWage: 21.00,
    hireDate: '2023-09-01',
    phone: '(703) 555-0110',
    email: 'maria.h@tacossam.com',
    notes: 'Annandale kitchen line operations, tortilla press and grill oversight.',
  },
  {
    id: 'emp_11',
    employeeId: 'EMP-111',
    fullName: 'Kyung-Hee Yoon',
    fullNameKo: '윤경희',
    position: 'Kitchen Line Cook',
    department: 'Kitchen & Cooking',
    businessGroup: 'TACOSSAM(ANANDALE)',
    groupNumber: 4,
    active: true,
    hourlyWage: 18.00,
    hireDate: '2024-03-01',
    phone: '(703) 555-0111',
    email: 'kyunghee.y@tacossam.com',
    notes: 'Taco assembly, sauce preparation, and order completion.',
  },
  {
    id: 'emp_14',
    employeeId: 'EMP-114',
    fullName: 'Brian Campbell',
    fullNameKo: '브라이언 캠벨',
    position: 'Dining Service Associate',
    department: 'Dining & Service',
    businessGroup: 'TACOSSAM(ANANDALE)',
    groupNumber: 4,
    active: true,
    hourlyWage: 16.00,
    hireDate: '2024-05-20',
    phone: '(703) 555-0114',
    email: 'brian.c@tacossam.com',
    notes: 'Dining room maintenance, guest seating, and drink station.',
  },
  {
    id: 'emp_19',
    employeeId: 'EMP-119',
    fullName: 'Jun-Ho Bae',
    fullNameKo: '배준호',
    position: 'Cashier & Server',
    department: 'Dining & Service',
    businessGroup: 'TACOSSAM(ANANDALE)',
    groupNumber: 4,
    active: true,
    hourlyWage: 15.50,
    hireDate: '2024-02-14',
    phone: '(703) 555-0119',
    email: 'junho.b@tacossam.com',
    notes: 'Student shift employee, evening checkout and customer order pack.',
  },

  // -------------------------------------------------------------
  // Group 5: SSAM KITCHEN (5번 그룹)
  // -------------------------------------------------------------
  {
    id: 'emp_20',
    employeeId: 'EMP-120',
    fullName: 'Hanna Song',
    fullNameKo: '송한나',
    position: 'Central Kitchen Cook (Archived)',
    department: 'Kitchen & Cooking',
    businessGroup: 'SSAM KITCHEN',
    groupNumber: 5,
    active: false, // Inactive employee to test historical retention
    hourlyWage: 16.50,
    hireDate: '2022-01-10',
    phone: '(703) 555-0120',
    email: 'hanna.s@ssamkitchen.com',
    notes: 'Archived staff member. Historical payroll records preserved.',
  },
  {
    id: 'emp_23',
    employeeId: 'EMP-123',
    fullName: 'Hyun-Woo Lim',
    fullNameKo: '임현우',
    position: 'Catering Prep & Logistics Lead',
    department: 'Kitchen & Cooking',
    businessGroup: 'SSAM KITCHEN',
    groupNumber: 5,
    active: true,
    hourlyWage: 19.50,
    hireDate: '2023-11-12',
    phone: '(703) 555-0123',
    email: 'hyunwoo.l@ssamkitchen.com',
    notes: 'Central commissary batch cooking, vacuum packaging, delivery dispatch.',
  },
];

/**
 * Generates realistic weekly shifts for the active employees for a given Friday-Thursday week
 */
export function generateSampleShiftsForWeek(fridayYmd: string = getWorkWeekFriday()): Shift[] {
  const days = getDaysInWorkWeek(fridayYmd);
  const shifts: Shift[] = [];

  // Shifts pattern:
  // Night Stockers (EMP-121, EMP-122): 22:00 to 06:00 (Overnight crossing midnight, 8h - 30m = 7.5h) on Fri, Sat, Sun, Mon, Tue -> 37.5h
  // Head Butcher (EMP-105): 07:00 to 16:30 (9.5h - 30m = 9.0h) on Fri, Sat, Sun, Mon, Tue -> 45.0h (Overtime demonstration!)
  // Head Cashier (EMP-115): 08:30 to 17:30 (9h - 30m = 8.5h) on Fri, Sat, Sun, Mon, Tue -> 42.5h (Overtime demonstration!)
  // Bakers: 04:00 to 12:30 (8.5h - 30m = 8.0h)
  // Standard Cashiers: 09:00 to 17:30 or 12:30 to 21:00
  // Produce Associates: 08:00 to 16:30

  SAMPLE_EMPLOYEES.filter(e => e.active).forEach((emp) => {
    const isCashier = isCashierEmployee(emp.department, emp.position);

    // Pharmacy & Health (Group 1: CMORE DRUG STORE)
    if (emp.department === 'Pharmacy & Health') {
      const workDayIndices = emp.employeeId === 'EMP-101' ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5];
      const startT = emp.employeeId === 'EMP-101' ? '08:30' : '09:00';
      const endT = emp.employeeId === 'EMP-101' ? '17:30' : '17:30';
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours(startT, endT, 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: startT,
          endTime: endT,
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: 'CMORE Drug consultation & pharmacy retail',
        });
      });
    }

    // Kitchen & Cooking (Group 3, 4 & 5: TACOSSAM & SSAM KITCHEN)
    else if (emp.department === 'Kitchen & Cooking') {
      const workDayIndices = [0, 1, 2, 3, 4];
      const startT = emp.businessGroup === 'SSAM KITCHEN' ? '06:00' : '10:00';
      const endT = emp.businessGroup === 'SSAM KITCHEN' ? '14:30' : '18:30';
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours(startT, endT, 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: startT,
          endTime: endT,
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: emp.businessGroup === 'SSAM KITCHEN' ? 'Central kitchen meal prep & packaging' : 'Taco kitchen line & grill',
        });
      });
    }

    // Dining & Service (Group 3 & 4: TACOSSAM Dining)
    else if (emp.department === 'Dining & Service') {
      const workDayIndices = emp.employeeId === 'EMP-119' ? [0, 1, 2] : [0, 1, 2, 3, 4];
      const startT = emp.employeeId === 'EMP-117' ? '11:00' : '12:00';
      const endT = emp.employeeId === 'EMP-117' ? '20:00' : '20:30';
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours(startT, endT, 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: startT,
          endTime: endT,
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: 'Customer dining & beverage service',
        });
      });
    }

    // Produce
    else if (emp.department === 'Produce') {
      const workDayIndices = [0, 1, 2, 3, 4];
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours('08:00', '16:30', 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: '08:00',
          endTime: '16:30',
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: 'Produce prep & display',
        });
      });
    }

    // Meat & Seafood
    else if (emp.department === 'Meat & Seafood') {
      const workDayIndices = [0, 1, 2, 3, 4];
      const startTime = emp.employeeId === 'EMP-105' ? '07:00' : '08:00';
      const endTime = emp.employeeId === 'EMP-105' ? '16:30' : '16:30'; // 105 works 9 hrs/day = 45 hrs OT
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours(startTime, endTime, 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime,
          endTime,
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: emp.employeeId === 'EMP-105' ? 'Meat cutting & weekend prep (OT)' : 'Seafood display',
        });
      });
    }

    // Bakery
    else if (emp.department === 'Bakery') {
      const workDayIndices = [0, 1, 2, 3, 6];
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours('04:00', '12:30', 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: '04:00',
          endTime: '12:30',
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: 'Early morning baking',
        });
      });
    }

    // Cashiers & Front End
    else if (emp.department === 'Cashiers & Front End') {
      const workDayIndices = [0, 1, 2, 3, 4];
      const startT = emp.employeeId === 'EMP-115' ? '08:30' : '09:00';
      const endT = emp.employeeId === 'EMP-115' ? '17:30' : '17:30';
      workDayIndices.forEach(idx => {
        const d = days[idx];
        // Cashier 9h shift: 20m paid break. If 20m break taken -> 9.0h (or 30m taken -> 10m excess)
        const calc = calculateShiftHours(startT, endT, 20, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: startT,
          endTime: endT,
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: 'Front checkout register',
        });
      });
    }

    // Grocery & Stocking (OVERNIGHT SHIFT TESTING)
    else if (emp.department === 'Grocery & Stocking') {
      const isNight = emp.employeeId === 'EMP-121' || emp.employeeId === 'EMP-122';
      const startT = isNight ? '22:00' : '08:00';
      const endT = isNight ? '06:00' : '16:30';
      const workDayIndices = [0, 1, 2, 3, 4];

      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours(startT, endT, 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: startT,
          endTime: endT,
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: isNight ? 'Overnight freight replenishment' : 'Pallet receiver',
        });
      });
    }

    // Management
    else if (emp.department === 'Management') {
      const workDayIndices = [0, 1, 2, 3, 4];
      workDayIndices.forEach(idx => {
        const d = days[idx];
        const calc = calculateShiftHours('08:00', '17:00', 30, isCashier);
        shifts.push({
          id: `shift_${fridayYmd}_${emp.employeeId}_${d.date}`,
          scheduleId: fridayYmd,
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          startTime: '08:00',
          endTime: '17:00',
          breakMinutes: calc.actualBreakMinutes,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
          notes: 'Branch administration & ops',
        });
      });
    }
  });

  return shifts;
}

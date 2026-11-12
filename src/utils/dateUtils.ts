export interface WorkWeekDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 'Friday', 'Saturday', etc.
  dayOfWeekKo: string; // '금요일', '토요일', etc.
  shortDay: string; // 'Fri', 'Sat', etc.
  shortDayKo: string; // '금', '토', etc.
  displayDate: string; // 'Nov 06'
  displayDateKo: string; // '11월 06일'
  fullDateUs: string; // '11/06/2026'
}

/**
 * Returns YYYY-MM-DD string for a Date object in local Eastern Time
 */
export function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses 'YYYY-MM-DD' into a local Date object safely
 */
export function parseDateYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Given any reference date, returns the Friday date string (YYYY-MM-DD)
 * for the workweek that starts on Friday and ends on Thursday.
 */
export function getWorkWeekFriday(refDate: Date = new Date()): string {
  const d = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat

  let daysBack = 0;
  if (day >= 5) {
    // Friday (5) or Saturday (6)
    daysBack = day - 5;
  } else {
    // Sunday (0) through Thursday (4)
    daysBack = day + 2; // Sunday is 2 days after Friday, Mon 3, ..., Thu 6
  }

  d.setDate(d.getDate() - daysBack);
  return formatDateYMD(d);
}

/**
 * Returns the Thursday ending date string (YYYY-MM-DD) for a Friday start date.
 */
export function getWorkWeekThursday(fridayYmd: string): string {
  const fri = parseDateYMD(fridayYmd);
  const thu = new Date(fri);
  thu.setDate(fri.getDate() + 6);
  return formatDateYMD(thu);
}

/**
 * Returns all 7 days in the Friday-Thursday workweek
 */
export function getDaysInWorkWeek(fridayYmd: string): WorkWeekDay[] {
  const fri = parseDateYMD(fridayYmd);
  const dayNamesEn = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const dayNamesKo = ['금요일', '토요일', '일요일', '월요일', '화요일', '수요일', '목요일'];
  const shortEn = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  const shortKo = ['금', '토', '일', '월', '화', '수', '목'];
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const days: WorkWeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(fri);
    cur.setDate(fri.getDate() + i);

    const ymd = formatDateYMD(cur);
    const m = cur.getMonth();
    const d = cur.getDate();
    const mStr = String(m + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');

    days.push({
      date: ymd,
      dayOfWeek: dayNamesEn[i],
      dayOfWeekKo: dayNamesKo[i],
      shortDay: shortEn[i],
      shortDayKo: shortKo[i],
      displayDate: `${monthNamesEn[m]} ${dStr}`,
      displayDateKo: `${m + 1}월 ${d}일`,
      fullDateUs: `${mStr}/${dStr}/${cur.getFullYear()}`,
    });
  }

  return days;
}

/**
 * Shift week forward or backward by 7 days
 */
export function getPreviousWeekFriday(fridayYmd: string): string {
  const d = parseDateYMD(fridayYmd);
  d.setDate(d.getDate() - 7);
  return formatDateYMD(d);
}

export function getNextWeekFriday(fridayYmd: string): string {
  const d = parseDateYMD(fridayYmd);
  d.setDate(d.getDate() + 7);
  return formatDateYMD(d);
}

/**
 * Formats a date range e.g. "Nov 06, 2026 - Nov 12, 2026"
 */
export function formatWorkWeekRange(fridayYmd: string, language: 'en' | 'ko' = 'en'): string {
  const fri = parseDateYMD(fridayYmd);
  const thu = parseDateYMD(getWorkWeekThursday(fridayYmd));

  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (language === 'ko') {
    return `${fri.getFullYear()}년 ${fri.getMonth() + 1}월 ${fri.getDate()}일(금) ~ ${thu.getMonth() + 1}월 ${thu.getDate()}일(목)`;
  }

  return `${monthNamesEn[fri.getMonth()]} ${String(fri.getDate()).padStart(2, '0')} - ${monthNamesEn[thu.getMonth()]} ${String(thu.getDate()).padStart(2, '0')}, ${thu.getFullYear()}`;
}

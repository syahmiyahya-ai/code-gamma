/**
 * Shared date utilities for Code Gamma
 */

export function getStartDate(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  return d;
}

export function getEndDate(date: Date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // Last day of month
  return d;
}

export function getWeekStartDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(d.setDate(diff));
}

export function getWeekEndDate(date: Date) {
  const d = getWeekStartDate(date);
  d.setDate(d.getDate() + 6);
  return d;
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}

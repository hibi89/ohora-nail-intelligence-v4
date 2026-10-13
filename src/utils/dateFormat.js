export const DISPLAY_TIME_ZONE = 'Asia/Seoul';

export function formatDisplayDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
    year: options.year ? 'numeric' : undefined,
    month: options.month || 'short',
    day: 'numeric',
  }).format(date);
}

export function formatCalendarDay(day, includeYear = true) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'All observed dates';
  const [year, month, date] = day.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, date, 12)));
  return includeYear ? `${monthName} ${date}, ${year}` : `${monthName} ${date}`;
}

export function formatDateRange(range) {
  if (!range?.from || !range?.to) return 'All observed dates';
  const fromYear = range.from.slice(0, 4);
  const toYear = range.to.slice(0, 4);
  if (fromYear === toYear) return `${formatCalendarDay(range.from, false)} – ${formatCalendarDay(range.to, true)}`;
  return `${formatCalendarDay(range.from)} – ${formatCalendarDay(range.to)}`;
}

export function subtractCalendarDays(day, count) {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date - count, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

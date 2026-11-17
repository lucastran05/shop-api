export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const HOLIDAYS = [
  { key: 'new_year', month: 1, day: 1, label: 'Năm mới', tags: ['celebration', 'fresh'] },
  { key: 'valentine', month: 2, day: 14, label: 'Valentine', tags: ['love', 'romantic'] },
  { key: 'women_march', month: 3, day: 8, label: 'Ngày Quốc tế Phụ nữ', tags: ['gratitude', 'love'] },
  { key: 'family', month: 6, day: 28, label: 'Ngày Gia đình Việt Nam', tags: ['family', 'gratitude'] },
  { key: 'women_october', month: 10, day: 20, label: 'Ngày Phụ nữ Việt Nam', tags: ['gratitude', 'love'] },
  { key: 'teachers', month: 11, day: 20, label: 'Ngày Nhà giáo Việt Nam', tags: ['gratitude', 'respect'] },
  { key: 'christmas', month: 12, day: 25, label: 'Giáng sinh', tags: ['celebration', 'warm'] },
];

function daysUntil(month, day, now) {
  const current = Date.UTC(now.year, now.month - 1, now.day);
  let target = Date.UTC(now.year, month - 1, day);
  if (target < current) target = Date.UTC(now.year + 1, month - 1, day);
  return Math.round((target - current) / 86400000);
}

export function vietnamContext(date = new Date(), personalOccasions = []) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', hourCycle: 'h23', weekday: 'long',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const now = { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
  const hour = Number(parts.hour);
  const season = [3, 4, 5].includes(now.month) ? 'spring'
    : [6, 7, 8].includes(now.month) ? 'summer'
    : [9, 10, 11].includes(now.month) ? 'autumn' : 'winter';
  const holidays = HOLIDAYS.map((item) => ({ ...item, daysUntil: daysUntil(item.month, item.day, now) }))
    .filter((item) => item.daysUntil <= 14).sort((a, b) => a.daysUntil - b.daysUntil);
  const occasions = personalOccasions.filter((item) => item.enabled)
    .map((item) => ({ ...item, daysUntil: daysUntil(item.month, item.day, now) }))
    .filter((item) => item.daysUntil <= Number(item.reminder_days))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  return { date: now, weekday: parts.weekday, period: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening', season, holidays, occasions, timeZone: TIME_ZONE };
}

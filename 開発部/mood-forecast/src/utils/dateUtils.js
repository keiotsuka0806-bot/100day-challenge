export const today = () => new Date().toISOString().slice(0, 10)

export function formatDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function formatMonthYear(year, month) {
  return `${year}年${month + 1}月`
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay()
}

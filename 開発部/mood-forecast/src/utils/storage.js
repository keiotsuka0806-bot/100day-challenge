const KEY = 'mood_forecast_v1'

export function loadRecords() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecords(records) {
  localStorage.setItem(KEY, JSON.stringify(records))
}

import { useState, useCallback } from 'react'
import { loadRecords, saveRecords } from '../utils/storage'

export function useRecords() {
  const [records, setRecords] = useState(loadRecords)

  const upsert = useCallback((record) => {
    setRecords(prev => {
      const next = [...prev.filter(r => r.date !== record.date), record]
        .sort((a, b) => b.date.localeCompare(a.date))
      saveRecords(next)
      return next
    })
  }, [])

  const remove = useCallback((id) => {
    setRecords(prev => {
      const next = prev.filter(r => r.id !== id)
      saveRecords(next)
      return next
    })
  }, [])

  const getByDate = useCallback(
    (date) => records.find(r => r.date === date) ?? null,
    [records]
  )

  return { records, upsert, remove, getByDate }
}

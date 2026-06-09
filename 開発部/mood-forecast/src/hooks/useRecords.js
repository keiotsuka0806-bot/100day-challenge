import { useState, useEffect, useCallback } from 'react'
import { db } from '../firebase'
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where,
} from 'firebase/firestore'

const CACHE_KEY = 'mood_forecast_v1'

export function useRecords(uid) {
  const [records, setRecords] = useState(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'moodRecords'), where('uid', '==', uid))
    return onSnapshot(q, snap => {
      const recs = snap.docs
        .map(d => d.data())
        .sort((a, b) => b.date.localeCompare(a.date))
      setRecords(recs)
      localStorage.setItem(CACHE_KEY, JSON.stringify(recs))
    })
  }, [uid])

  const upsert = useCallback(async (record) => {
    await setDoc(doc(db, 'moodRecords', record.id), { ...record, uid })
  }, [uid])

  const remove = useCallback(async (id) => {
    await deleteDoc(doc(db, 'moodRecords', id))
  }, [])

  const getByDate = useCallback(
    (date) => records.find(r => r.date === date) ?? null,
    [records],
  )

  return { records, upsert, remove, getByDate }
}

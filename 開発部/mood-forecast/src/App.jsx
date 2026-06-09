import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useRecords } from './hooks/useRecords'
import { today } from './utils/dateUtils'
import Navigation from './components/Navigation'
import MoodForm from './components/MoodForm'
import CalendarView from './components/CalendarView'
import ChartsView from './components/ChartsView'
import RecordList from './components/RecordList'
import LoginScreen from './components/LoginScreen'

export default function App() {
  const { user, signIn, signOut } = useAuth()
  const [tab, setTab] = useState('form')
  const [formDate, setFormDate] = useState(today())
  const { records, upsert, remove, getByDate } = useRecords(user?.uid)

  function openFormForDate(date) {
    setFormDate(date)
    setTab('form')
  }

  if (user === undefined) {
    return <div className="loading-screen"><div className="loading-spinner" /></div>
  }

  if (user === null) {
    return <LoginScreen onSignIn={signIn} />
  }

  return (
    <div className="app">
      <main className="main-content">
        {tab === 'form'     && (
          <MoodForm
            date={formDate}
            setDate={setFormDate}
            getByDate={getByDate}
            onSave={upsert}
          />
        )}
        {tab === 'calendar' && (
          <CalendarView records={records} onSelectDate={openFormForDate} />
        )}
        {tab === 'charts'   && (
          <ChartsView records={records} />
        )}
        {tab === 'list'     && (
          <RecordList records={records} onDelete={remove} onSelectDate={openFormForDate} />
        )}
      </main>
      <Navigation active={tab} onChange={setTab} user={user} onSignOut={signOut} />
    </div>
  )
}

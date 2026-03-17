import { startTransition, useState } from 'react'
import './App.css'
import { RunScreen } from './components/RunScreen'
import { SetupScreen } from './components/SetupScreen'
import { DEFAULT_WORKOUT, normalizeWorkoutInput, type QuickWorkoutInput } from './lib/timerSession'

function App() {
  const [draft, setDraft] = useState<QuickWorkoutInput>(DEFAULT_WORKOUT)
  const [activeWorkout, setActiveWorkout] = useState<QuickWorkoutInput>(DEFAULT_WORKOUT)
  const [screen, setScreen] = useState<'setup' | 'run'>('setup')

  const handleLaunch = () => {
    const normalized = normalizeWorkoutInput(draft)
    setDraft(normalized)
    setActiveWorkout(normalized)
    startTransition(() => {
      setScreen('run')
    })
  }

  const handleEdit = () => {
    startTransition(() => {
      setScreen('setup')
    })
  }

  return (
    <main className={`app app--${screen}`}>
      {screen === 'setup' ? (
        <SetupScreen draft={draft} onChange={setDraft} onLaunch={handleLaunch} />
      ) : (
        <RunScreen workout={activeWorkout} onEdit={handleEdit} />
      )}
    </main>
  )
}

export default App

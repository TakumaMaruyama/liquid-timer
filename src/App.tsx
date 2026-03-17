import { startTransition, useState } from 'react'
import './App.css'
import { RunScreen } from './components/RunScreen'
import { SetupScreen } from './components/SetupScreen'
import { usePresetStore } from './hooks/usePresetStore'
import { normalizeWorkoutInput, type QuickWorkoutInput } from './lib/timerSession'

function App() {
  const presetStore = usePresetStore()
  const [activeWorkout, setActiveWorkout] = useState<QuickWorkoutInput>(() =>
    normalizeWorkoutInput(presetStore.selectedPreset.workout),
  )
  const [screen, setScreen] = useState<'setup' | 'run'>('setup')

  const handleLaunch = () => {
    const normalized = normalizeWorkoutInput(presetStore.selectedPreset.workout)
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
        <SetupScreen presetStore={presetStore} onLaunch={handleLaunch} />
      ) : (
        <RunScreen workout={activeWorkout} onEdit={handleEdit} />
      )}
    </main>
  )
}

export default App

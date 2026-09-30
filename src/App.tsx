import { useState } from 'react'
import './App.css'
import { RunScreen } from './components/RunScreen'
import { SetupScreen } from './components/SetupScreen'
import { useWorkoutSession } from './hooks/useWorkoutSession'
import { usePresetStore } from './hooks/usePresetStore'
import { draftFromSeconds, validateTimerDraft, type TimerDraft } from './lib/timerDraft'
import { type QuickWorkoutInput } from './lib/timerSession'

function App() {
  const presetStore = usePresetStore()
  const selectedPreset = presetStore.selectedPreset
  const [draft, setDraft] = useState<TimerDraft>(() =>
    draftFromSeconds(selectedPreset.workout.intervalSec, selectedPreset.workout.leadInSec),
  )
  const [audioEnabled, setAudioEnabled] = useState(selectedPreset.workout.audioEnabled)
  const [screen, setScreen] = useState<'setup' | 'run'>('setup')
  const timer = useWorkoutSession(selectedPreset.workout)
  const validation = validateTimerDraft(draft)

  const makeWorkout = (nextDraft: TimerDraft, enabled = audioEnabled): QuickWorkoutInput | null => {
    const valid = validateTimerDraft(nextDraft).value
    if (!valid) return null
    return {
      ...selectedPreset.workout,
      rounds: 1,
      repsPerRound: 1,
      roundRestSec: 0,
      intervalSec: valid.intervalSec,
      leadInSec: valid.leadInSec,
      audioEnabled: enabled,
    }
  }

  const save = (workout: QuickWorkoutInput) => {
    presetStore.update(selectedPreset.id, {
      workout: {
        ...selectedPreset.workout,
        intervalSec: workout.intervalSec,
        leadInSec: workout.leadInSec,
        audioEnabled: workout.audioEnabled,
      },
    })
  }

  const handleDraftChange = (field: keyof TimerDraft, value: string) => {
    const nextDraft = { ...draft, [field]: value }
    setDraft(nextDraft)
    const workout = makeWorkout(nextDraft)
    if (workout) save(workout)
  }

  const handleAudioChange = (enabled: boolean) => {
    setAudioEnabled(enabled)
    const workout = makeWorkout(draft, enabled)
    if (workout) save(workout)
  }

  const handleLaunch = (pressedAt: number, pointerId?: number) => {
    const workout = makeWorkout(draft)
    if (!workout || timer.session.phase !== 'idle') return
    save(workout)
    timer.start(workout, pressedAt, pointerId)
    setScreen('run')
  }

  const handleEdit = () => {
    if (!timer.reset()) return
    setScreen('setup')
  }

  return (
    <main className={'app app--' + screen}>
      {screen === 'setup' ? (
        <SetupScreen
          draft={draft}
          errors={validation.errors}
          canStart={validation.value !== null}
          audioEnabled={audioEnabled}
          onDraftChange={handleDraftChange}
          onAudioChange={handleAudioChange}
          onLaunch={handleLaunch}
          error={timer.startError}
        />
      ) : (
        <RunScreen
          timer={timer}
          onEdit={handleEdit}
          onAbort={() => setScreen('setup')}
        />
      )}
    </main>
  )
}

export default App

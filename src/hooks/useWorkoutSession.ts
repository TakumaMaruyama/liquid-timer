import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAudioCuePlayer,
  type AudioCuePlayer,
} from '../lib/audioCuePlayer'
import {
  createIdleSession,
  isRunningPhase,
  pauseSession,
  resetSession,
  resumeSession,
  startSession,
  tickSession,
  type CueEvent,
  type QuickWorkoutInput,
  type WorkoutSession,
} from '../lib/timerSession'

interface VisualCueState {
  id: number
  event: CueEvent | null
}

export function useWorkoutSession(workout: QuickWorkoutInput) {
  const [session, setSession] = useState<WorkoutSession>(() => createIdleSession(workout))
  const [visualCue, setVisualCue] = useState<VisualCueState>({ id: 0, event: null })
  const audioPlayerRef = useRef<AudioCuePlayer | null>(null)
  const cueTimeoutRef = useRef<number | null>(null)
  const sessionRef = useRef(session)

  if (audioPlayerRef.current === null) {
    audioPlayerRef.current = createAudioCuePlayer()
  }

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    return () => {
      if (cueTimeoutRef.current !== null) {
        window.clearTimeout(cueTimeoutRef.current)
      }
    }
  }, [])

  const emitCues = useCallback((events: CueEvent[]) => {
    if (events.length === 0) {
      return
    }

    const latestEvent = events[events.length - 1]
    setVisualCue((current) => ({
      id: current.id + 1,
      event: latestEvent,
    }))

    if (cueTimeoutRef.current !== null) {
      window.clearTimeout(cueTimeoutRef.current)
    }

    cueTimeoutRef.current = window.setTimeout(() => {
      setVisualCue((current) => ({
        id: current.id,
        event: null,
      }))
    }, latestEvent === 'workout_complete' ? 1200 : 360)

    for (const event of events) {
      void audioPlayerRef.current?.play(event, workout.audioEnabled)
    }
  }, [workout.audioEnabled])

  const commitTransition = useCallback((nextSession: WorkoutSession, events: CueEvent[]) => {
    sessionRef.current = nextSession
    setSession(nextSession)
    emitCues(events)
  }, [emitCues])

  useEffect(() => {
    if (!isRunningPhase(session.phase)) {
      return
    }

    let frameId = 0

    const loop = () => {
      const transition = tickSession(sessionRef.current, Date.now())
      commitTransition(transition.state, transition.events)
      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [commitTransition, session.phase])

  const start = async () => {
    await audioPlayerRef.current?.unlock()
    const nextSession = startSession(workout, Date.now())
    commitTransition(nextSession, [])
  }

  const pause = () => {
    const transition = pauseSession(sessionRef.current, Date.now())
    commitTransition(transition.state, transition.events)
  }

  const resume = async () => {
    await audioPlayerRef.current?.unlock()
    const transition = resumeSession(sessionRef.current, Date.now())
    commitTransition(transition.state, transition.events)
  }

  const reset = () => {
    const nextSession = resetSession(workout)
    commitTransition(nextSession, [])
  }

  return {
    session,
    visualCue: visualCue.event,
    start,
    pause,
    resume,
    reset,
    isRunning: isRunningPhase(session.phase),
    isWarningWindow:
      isRunningPhase(session.phase) &&
      session.remainingMs > 0 &&
      session.remainingMs <= 5000,
  }
}

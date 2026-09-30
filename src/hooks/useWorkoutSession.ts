import { useCallback, useEffect, useRef, useState } from 'react'
import { createAudioCuePlayer, type AudioCuePlayer } from '../lib/audioCuePlayer'
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

export function useWorkoutSession(initialWorkout: QuickWorkoutInput) {
  const [session, setSession] = useState<WorkoutSession>(() => createIdleSession(initialWorkout))
  const [visualCue, setVisualCue] = useState<CueEvent | null>(null)
  const [operationLocked, setOperationLocked] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const sessionRef = useRef(session)
  const workoutRef = useRef(initialWorkout)
  const lockedRef = useRef(false)
  const generationRef = useRef(0)
  const audioReadyRef = useRef(false)
  const audioPendingRef = useRef(false)
  const firstCueScheduledRef = useRef(false)
  const cleanupReleaseRef = useRef<(() => void) | null>(null)
  const audioPlayerRef = useRef<AudioCuePlayer | null>(null)
  if (audioPlayerRef.current === null) {
    audioPlayerRef.current = createAudioCuePlayer()
  }

  const setLocked = useCallback((value: boolean) => {
    lockedRef.current = value
    setOperationLocked(value)
  }, [])

  const updateSession = useCallback((next: WorkoutSession) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const clearRelease = useCallback(() => {
    cleanupReleaseRef.current?.()
    cleanupReleaseRef.current = null
  }, [])

  const cancelAudio = useCallback(() => {
    generationRef.current += 1
    audioPendingRef.current = false
    clearRelease()
    audioPlayerRef.current?.cancelScheduled()
  }, [clearRelease])

  const abortStart = useCallback((message: string) => {
    cancelAudio()
    updateSession(resetSession(workoutRef.current))
    setLocked(false)
    setVisualCue(null)
    setStartError(message)
  }, [cancelAudio, setLocked, updateSession])

  const emitCues = useCallback((events: CueEvent[], late = false) => {
    if (events.length === 0) return
    setVisualCue(events[events.length - 1])
    for (const event of events) {
      if (late) continue
      if (event === 'five_second_warning') continue
      if (event === 'phase_switch' && firstCueScheduledRef.current) continue
      void audioPlayerRef.current?.play(event, workoutRef.current.audioEnabled).catch(() => {})
    }
  }, [])

  const prepareAudio = useCallback((firstCueAt: number, token: number) => {
    const attempt = async () => {
      let ready = false
      try {
        ready = (await audioPlayerRef.current?.unlock()) ?? false
      } catch {
        ready = false
      }
      if (token !== generationRef.current || audioReadyRef.current) return
      if (!ready) return false
      audioReadyRef.current = true
      audioPendingRef.current = false
      clearRelease()
      if (firstCueAt > 0) {
        if (!audioPlayerRef.current?.scheduleAt('phase_switch', true, firstCueAt)) {
          abortStart('音声の準備が開始時刻に間に合いませんでした。もう一度スタートしてください。')
          return
        }
        firstCueScheduledRef.current = true
        const leadInSeconds = workoutRef.current.leadInSec
        for (let second = Math.min(3, leadInSeconds); second >= 1; second -= 1) {
          const cueAt = firstCueAt - second * 1000
          if (cueAt - performance.now() >= 25) {
            audioPlayerRef.current?.scheduleCountdownAt(second, true, cueAt)
          }
        }
      }
    }
    return attempt()
  }, [abortStart, clearRelease])

  const attachRelease = useCallback((pointerId: number, firstCueAt: number, token: number) => {
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      clearRelease()
      if (token !== generationRef.current || audioReadyRef.current) return
      void prepareAudio(firstCueAt, token).then((ready) => {
        if (ready === false && token === generationRef.current && !audioReadyRef.current) {
          abortStart('音声を有効にできませんでした。端末の音声設定を確認してください。')
        }
      })
    }
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      clearRelease()
      if (token === generationRef.current && !audioReadyRef.current) {
        abortStart('音声を有効にできませんでした。もう一度スタートしてください。')
      }
    }
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    cleanupReleaseRef.current = () => {
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
    }
  }, [abortStart, clearRelease, prepareAudio])

  const start = useCallback((workout: QuickWorkoutInput, pressedAt: number, pointerId?: number) => {
    const currentPhase = sessionRef.current.phase
    if (currentPhase !== 'idle' && !(currentPhase === 'complete' && !lockedRef.current)) return false
    cancelAudio()
    const token = generationRef.current
    workoutRef.current = workout
    audioReadyRef.current = !workout.audioEnabled
    audioPendingRef.current = workout.audioEnabled
    firstCueScheduledRef.current = false
    setStartError(null)
    setVisualCue(null)
    updateSession(startSession(workout, pressedAt))
    setLocked(true)

    if (workout.audioEnabled) {
      const firstCueAt = workout.leadInSec > 0 ? pressedAt + workout.leadInSec * 1000 : 0
      if (pointerId !== undefined) attachRelease(pointerId, firstCueAt, token)
      void prepareAudio(firstCueAt, token).then((ready) => {
        if (ready === false && pointerId === undefined && token === generationRef.current) {
          abortStart('音声を有効にできませんでした。端末の音声設定を確認してください。')
        }
      })
    }
    return true
  }, [abortStart, attachRelease, cancelAudio, prepareAudio, setLocked, updateSession])

  const advance = useCallback(() => {
    const current = sessionRef.current
    if (!isRunningPhase(current.phase)) return
    const now = performance.now()
    if (audioPendingRef.current && current.phase === 'lead_in' && current.phaseEndsAt !== null && now >= current.phaseEndsAt) {
      abortStart('音声の準備が開始時刻に間に合いませんでした。もう一度スタートしてください。')
      return
    }
    if (audioPendingRef.current && current.phase === 'interval' && current.phaseEndsAt !== null && now >= current.phaseEndsAt) {
      abortStart('音声を有効にできませんでした。もう一度スタートしてください。')
      return
    }
    const transition = tickSession(current, now)
    updateSession(transition.state)
    const late = current.phaseEndsAt !== null && now - current.phaseEndsAt > 500
    emitCues(transition.events, late)
  }, [abortStart, emitCues, updateSession])

  useEffect(() => {
    if (!isRunningPhase(session.phase)) return
    let frame = 0
    const loop = () => {
      advance()
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    const onVisibility = () => {
      if (document.hidden) {
        audioPlayerRef.current?.cancelScheduled()
        if (sessionRef.current.phase === 'lead_in' && workoutRef.current.audioEnabled) {
          cancelAudio()
          audioReadyRef.current = false
          audioPendingRef.current = true
          firstCueScheduledRef.current = false
        }
        return
      }
      const current = sessionRef.current
      if (current.phase === 'lead_in' && audioPendingRef.current && current.phaseEndsAt !== null && performance.now() < current.phaseEndsAt) {
        const token = generationRef.current
        void prepareAudio(current.phaseEndsAt, token).then((ready) => {
          if (ready === false && token === generationRef.current) {
            abortStart('音声を有効にできませんでした。端末の音声設定を確認してください。')
          }
        })
      }
      advance()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [abortStart, advance, cancelAudio, prepareAudio, session.phase])

  useEffect(() => () => {
    generationRef.current += 1
    clearRelease()
    audioPlayerRef.current?.cancelScheduled()
  }, [clearRelease])

  const pause = () => {
    if (lockedRef.current || !isRunningPhase(sessionRef.current.phase)) return false
    cancelAudio()
    const transition = pauseSession(sessionRef.current, performance.now())
    updateSession(transition.state)
    emitCues(transition.events)
    return true
  }

  const resume = () => {
    if (lockedRef.current || sessionRef.current.phase !== 'paused') return false
    const transition = resumeSession(sessionRef.current, performance.now())
    if (!isRunningPhase(transition.state.phase)) return false
    updateSession(transition.state)
    setLocked(true)
    const workout = workoutRef.current
    audioReadyRef.current = !workout.audioEnabled
    audioPendingRef.current = workout.audioEnabled
    firstCueScheduledRef.current = false
    if (workout.audioEnabled) {
      const token = generationRef.current
      const firstCueAt = transition.state.phase === 'lead_in' ? transition.state.phaseEndsAt ?? 0 : 0
      void prepareAudio(firstCueAt, token).then((ready) => {
        if (ready === false && token === generationRef.current) {
          abortStart('音声を有効にできませんでした。端末の音声設定を確認してください。')
        }
      })
    }
    return true
  }

  const reset = () => {
    if (lockedRef.current) return false
    cancelAudio()
    updateSession(resetSession(workoutRef.current))
    setVisualCue(null)
    setStartError(null)
    return true
  }

  return {
    session,
    visualCue,
    operationLocked,
    startError,
    start,
    pause,
    resume,
    reset,
    setLocked,
  }
}

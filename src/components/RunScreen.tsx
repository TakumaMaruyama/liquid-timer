import { useEffect, useState } from 'react'
import { LaneTank } from './LaneTank'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import {
  formatDurationLabel,
  formatSecondsDisplay,
  getEffectivePhase,
  type QuickWorkoutInput,
} from '../lib/timerSession'
import {
  getJapanesePhaseHeadline,
} from '../lib/uiLabels'

interface RunScreenProps {
  workout: QuickWorkoutInput
  onEdit: () => void
}

type TimerDisplayMode = 'seconds' | 'minutes_seconds'

const DISPLAY_MODE_STORAGE_KEY = 'poolside-timer.display-mode'

function getPrimaryActionLabel(phase: ReturnType<typeof getEffectivePhase>) {
  switch (phase) {
    case 'paused':
      return '再開'
    case 'lead_in':
    case 'interval':
    case 'round_rest':
      return '一時停止'
    case 'idle':
    case 'complete':
      return '開始'
  }
}

function getPrimaryActionTone(phase: ReturnType<typeof getEffectivePhase>) {
  return phase === 'lead_in' || phase === 'interval' || phase === 'round_rest'
    ? 'controlButton--secondary'
    : 'controlButton--primary'
}

function loadDisplayMode(): TimerDisplayMode {
  if (typeof window === 'undefined') {
    return 'minutes_seconds'
  }

  const stored = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)
  if (stored === 'seconds' || stored === 'minutes_seconds') {
    return stored
  }

  return 'minutes_seconds'
}

function formatMainDisplay(remainingMs: number, displayMode: TimerDisplayMode) {
  return displayMode === 'minutes_seconds'
    ? formatDurationLabel(remainingMs / 1000)
    : formatSecondsDisplay(remainingMs)
}

function getDisplayModeLabel(displayMode: TimerDisplayMode) {
  return displayMode === 'minutes_seconds' ? '表示切替　分:秒' : '表示切替　秒'
}

export function RunScreen({ workout, onEdit }: RunScreenProps) {
  const [displayMode, setDisplayMode] = useState<TimerDisplayMode>(() => loadDisplayMode())
  const {
    session,
    visualCue,
    start,
    pause,
    resume,
    reset,
    isRunning,
    isWarningWindow,
  } = useWorkoutSession(workout)

  const effectivePhase = getEffectivePhase(session)
  const displayPhase = session.phase === 'paused' ? 'paused' : effectivePhase
  const totalReps = workout.rounds * workout.repsPerRound
  const mainDisplay = formatMainDisplay(session.remainingMs, displayMode)
  const secondaryTimeLabel =
    displayMode === 'minutes_seconds'
      ? `残り ${formatSecondsDisplay(session.remainingMs)}秒`
      : `あと ${formatDurationLabel(session.remainingMs / 1000)}`
  const absoluteRep =
    session.phase === 'idle'
      ? 1
      : Math.min(
          totalReps,
          (session.currentRound - 1) * workout.repsPerRound + session.currentRep,
        )

  const primaryAction =
    session.phase === 'paused'
      ? resume
      : isRunning
        ? pause
        : start

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode)
  }, [displayMode])

  return (
    <section className="runScreen">
      <div
        className="runScreen__panel"
        data-cue={visualCue ?? undefined}
        data-warning={isWarningWindow}
      >
        <header className="runScreen__header">
          <div>
            <div className="runScreen__eyebrow">プールサイドタイマー</div>
            <h1 className="runScreen__title">{workout.title}</h1>
          </div>
          <div className="runScreen__headerMeta">
            <button
              className="runScreen__headerToggle"
              type="button"
              onClick={() =>
                setDisplayMode((current) =>
                  current === 'seconds' ? 'minutes_seconds' : 'seconds',
                )
              }
            >
              {getDisplayModeLabel(displayMode)}
            </button>
          </div>
        </header>

        <div className="runScreen__main">
          <section className="timerHero">
            <div className="timerHero__headline">
              {getJapanesePhaseHeadline(displayPhase)}
            </div>

            <div className="timerHero__display" aria-live="polite">
              <div
                className={`timerHero__value${
                  displayMode === 'minutes_seconds' ? ' timerHero__value--clock' : ''
                }`}
              >
                {mainDisplay}
              </div>
              {displayMode === 'seconds' && <div className="timerHero__unit">秒</div>}
            </div>

            <div className="timerHero__subvalue">
              {secondaryTimeLabel} ・ 進行 {absoluteRep}/{totalReps}
            </div>
          </section>

          <LaneTank session={session} workout={workout} />
        </div>

        <div className="runScreen__actions">
          <button
            className={`controlButton ${getPrimaryActionTone(displayPhase)}`}
            type="button"
            onClick={primaryAction}
          >
            {getPrimaryActionLabel(displayPhase)}
          </button>
          <button className="controlButton controlButton--danger" type="button" onClick={reset}>
            リセット
          </button>
          <button className="controlButton controlButton--secondary" type="button" onClick={onEdit}>
            設定に戻る
          </button>
        </div>
      </div>
    </section>
  )
}

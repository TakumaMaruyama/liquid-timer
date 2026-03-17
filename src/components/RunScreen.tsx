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
  getJapanesePhaseLabel,
} from '../lib/uiLabels'

interface RunScreenProps {
  workout: QuickWorkoutInput
  onEdit: () => void
}

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

export function RunScreen({ workout, onEdit }: RunScreenProps) {
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

  return (
    <section className="runScreen">
      <div
        className="runScreen__panel"
        data-cue={visualCue ?? undefined}
        data-warning={isWarningWindow}
      >
        <header className="runScreen__header">
          <div>
            <div className="runScreen__eyebrow">プールサイド共有タイマー</div>
            <h1 className="runScreen__title">{workout.title}</h1>
          </div>
          <div className="runScreen__headerMeta">
            <span>{workout.rounds}セット</span>
            <span>{totalReps}本</span>
          </div>
        </header>

        <div className="runScreen__main">
          <section className="timerHero">
            <div className="timerHero__meta">
              <span className="timerChip">{getJapanesePhaseLabel(displayPhase)}</span>
              <span className="timerChip">セット {session.currentRound}/{session.totalRounds}</span>
              <span className="timerChip">本 {session.currentRep}/{session.totalRepsInRound}</span>
            </div>

            <div className="timerHero__headline">
              {getJapanesePhaseHeadline(displayPhase)}
            </div>

            <div className="timerHero__display" aria-live="polite">
              <div className="timerHero__value">{formatSecondsDisplay(session.remainingMs)}</div>
              <div className="timerHero__unit">秒</div>
            </div>

            <div className="timerHero__subvalue">
              あと {formatDurationLabel(session.remainingMs / 1000)} ・ 進行 {absoluteRep}/{totalReps}
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

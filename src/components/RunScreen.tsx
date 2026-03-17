import { LaneTank } from './LaneTank'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import {
  formatDurationLabel,
  formatRoundLabel,
  formatSecondsDisplay,
  getCurrentStep,
  getEffectivePhase,
  getStepProgress,
  type QuickWorkoutInput,
} from '../lib/timerSession'

interface RunScreenProps {
  workout: QuickWorkoutInput
  onEdit: () => void
}

function phaseHeading(phase: ReturnType<typeof getEffectivePhase>) {
  switch (phase) {
    case 'lead_in':
      return 'Lead-in'
    case 'interval':
      return 'Next Start'
    case 'round_rest':
      return 'Round Rest'
    case 'paused':
      return 'Paused'
    case 'complete':
      return 'Complete'
    case 'idle':
      return 'Ready'
  }
}

function phaseCopy(phase: ReturnType<typeof getEffectivePhase>) {
  switch (phase) {
    case 'lead_in':
      return '全体スタートまでのカウント。合図と同時に1本目へ入る。'
    case 'interval':
      return '大きい数字は次の出発まで。液体が満ち切ると次の本へ進む。'
    case 'round_rest':
      return 'ラウンド間の休憩。縦のゲートが満ちると次ラウンドが始まる。'
    case 'paused':
      return '進行を停止中。残り時間と液体位置はここで固定される。'
    case 'complete':
      return 'メニュー終了。開始を押すと同じセットをもう一度流せる。'
    case 'idle':
      return 'レーンが整ったら開始。音は最初の開始操作でアンロックする。'
  }
}

export function RunScreen({ workout, onEdit }: RunScreenProps) {
  const {
    session,
    visualCue,
    start,
    pause,
    resume,
    rewind,
    skip,
    reset,
    canRewind,
    canSkip,
    isRunning,
    isWarningWindow,
  } = useWorkoutSession(workout)

  const step = getCurrentStep(session)
  const effectivePhase = getEffectivePhase(session)
  const displayPhase = session.phase === 'paused' ? 'paused' : effectivePhase
  const progress = getStepProgress(session)
  const totalReps = workout.rounds * workout.repsPerRound
  const absoluteRep =
    session.phase === 'idle'
      ? 1
      : Math.min(
          totalReps,
          (session.currentRound - 1) * workout.repsPerRound + session.currentRep,
        )

  return (
    <section className="runScreen">
      <div
        className="runScreen__panel"
        data-cue={visualCue ?? undefined}
        data-warning={isWarningWindow}
      >
        <header className="runScreen__topbar">
          <div>
            <div className="runScreen__eyebrow">Poolside Display</div>
            <h1 className="runScreen__title">{workout.title}</h1>
            <p className="runScreen__lead">遠距離視認を優先した単一共有 Liquid Timer。</p>
          </div>
          <button className="controlButton controlButton--secondary" type="button" onClick={onEdit}>
            設定を編集
          </button>
        </header>

        <div className="runScreen__stage">
          <section className="timerHero">
            <div className="timerHero__meta">
              <span className="timerChip">{phaseHeading(displayPhase)}</span>
              <span className="timerChip">
                {formatRoundLabel(session.currentRound, session.totalRounds)}
              </span>
              <span className="timerChip">
                Rep {session.currentRep}/{session.totalRepsInRound}
              </span>
            </div>

            <div>
              <div className="runScreen__eyebrow">
                {displayPhase === 'paused'
                  ? 'Session Paused'
                  : effectivePhase === 'interval'
                  ? 'Next Start In'
                  : effectivePhase === 'round_rest'
                    ? 'Next Round In'
                    : effectivePhase === 'lead_in'
                      ? 'Session Starts In'
                      : effectivePhase === 'complete'
                        ? 'Workout Finished'
                        : 'Tank Ready'}
              </div>
              <div className="timerHero__clockline">
                <div className="timerHero__value">{formatSecondsDisplay(session.remainingMs)}</div>
                <div className="timerHero__subvalue">
                  {formatDurationLabel(session.remainingMs / 1000)}
                </div>
              </div>
              <h2 className="timerHero__phase">{phaseHeading(displayPhase)}</h2>
              <p className="timerHero__copy">{phaseCopy(displayPhase)}</p>
            </div>

            <div className="timerHero__stats">
              <div className="runStat">
                <span className="metric__label">Progress</span>
                <strong>
                  {absoluteRep} / {totalReps}
                </strong>
              </div>
              <div className="runStat">
                <span className="metric__label">Phase Fill</span>
                <strong>{Math.round(progress * 100)}%</strong>
              </div>
              <div className="runStat">
                <span className="metric__label">Current Step</span>
                <strong>{step?.phase === 'round_rest' ? 'Gate' : `Lane ${session.currentRep}`}</strong>
              </div>
            </div>
          </section>

          <LaneTank session={session} workout={workout} />
        </div>

        <div className="runScreen__actions">
          {(session.phase === 'idle' || session.phase === 'complete') && (
            <button className="controlButton controlButton--primary" type="button" onClick={start}>
              開始
            </button>
          )}

          {isRunning && (
            <button className="controlButton controlButton--secondary" type="button" onClick={pause}>
              一時停止
            </button>
          )}

          {session.phase === 'paused' && (
            <button className="controlButton controlButton--primary" type="button" onClick={resume}>
              再開
            </button>
          )}

          <button
            className="controlButton controlButton--secondary"
            type="button"
            onClick={rewind}
            disabled={!canRewind}
          >
            戻る
          </button>

          <button
            className="controlButton controlButton--secondary"
            type="button"
            onClick={skip}
            disabled={!canSkip}
          >
            スキップ
          </button>

          <button className="controlButton controlButton--danger" type="button" onClick={reset}>
            リセット
          </button>
        </div>
      </div>
    </section>
  )
}

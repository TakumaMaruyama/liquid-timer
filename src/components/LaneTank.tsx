import { Fragment, type CSSProperties } from 'react'
import {
  getCurrentStep,
  getEffectivePhase,
  getStepProgress,
  type QuickWorkoutInput,
  type WorkoutSession,
} from '../lib/timerSession'

interface LaneTankProps {
  session: WorkoutSession
  workout: QuickWorkoutInput
}

function fillStyle(fill: number): CSSProperties {
  return {
    ['--fill' as string]: `${Math.round(fill * 100)}%`,
  }
}

export function LaneTank({ session, workout }: LaneTankProps) {
  const step = getCurrentStep(session)
  const effectivePhase = getEffectivePhase(session)
  const activeProgress = getStepProgress(session)

  return (
    <section className="laneTank">
      <div className="laneTank__header">
        <div>
          <div className="setupCard__eyebrow">Lane Tank</div>
          <h2 className="laneTank__title">ラウンドごとの液体カプセル</h2>
        </div>
        <div className="laneTank__summary">
          {workout.rounds} rounds / {workout.repsPerRound} reps
        </div>
      </div>

      <div className="laneTank__track" role="img" aria-label="Workout progress lane tank">
        {Array.from({ length: workout.rounds }, (_, roundIndex) => {
          const roundNumber = roundIndex + 1

          return (
            <Fragment key={`round-${roundNumber}`}>
              <div className="tankRound">
                <div className="tankRound__label">Round {roundNumber}</div>
                <div
                  className="tankRound__cells"
                  style={{ ['--rep-count' as string]: workout.repsPerRound }}
                >
                  {Array.from({ length: workout.repsPerRound }, (_, repIndex) => {
                    const repNumber = repIndex + 1
                    const isDone =
                      roundNumber < session.currentRound ||
                      (roundNumber === session.currentRound &&
                        repNumber < session.currentRep &&
                        effectivePhase !== 'lead_in')

                    const isLeadInTarget =
                      effectivePhase === 'lead_in' && roundNumber === 1 && repNumber === 1
                    const isActiveRep =
                      (effectivePhase === 'interval' || isLeadInTarget) &&
                      roundNumber === session.currentRound &&
                      repNumber === session.currentRep

                    let fill = isDone ? 1 : 0

                    if (isActiveRep) {
                      fill = activeProgress
                    }

                    if (session.phase === 'complete') {
                      fill = 1
                    }

                    const cellClassName = [
                      'tankCell',
                      isDone || session.phase === 'complete' ? 'tankCell--done' : '',
                      isActiveRep ? 'tankCell--active' : '',
                      !isDone && !isActiveRep ? 'tankCell--queued' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <div className={cellClassName} key={`rep-${roundNumber}-${repNumber}`}>
                        <div className="tankCell__index">{repNumber}</div>
                        <div className="tankCell__liquid" style={fillStyle(fill)} />
                        <div className="tankCell__glass" />
                        <div className="tankCell__badge">
                          {isActiveRep
                            ? step?.phase === 'lead_in'
                              ? 'Lead'
                              : 'Live'
                            : isDone || session.phase === 'complete'
                              ? 'Done'
                              : 'Queued'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {roundNumber < workout.rounds && (
                <RoundGate
                  active={
                    effectivePhase === 'round_rest' &&
                    session.currentRound === roundNumber + 1
                  }
                  complete={session.currentRound > roundNumber + 1 || session.phase === 'complete'}
                  progress={
                    effectivePhase === 'round_rest' && session.currentRound === roundNumber + 1
                      ? activeProgress
                      : session.currentRound > roundNumber + 1 || session.phase === 'complete'
                        ? 1
                        : 0
                  }
                />
              )}
            </Fragment>
          )
        })}
      </div>

      <div className="laneTank__legend">
        <span>
          <i className="laneTank__legendDot laneTank__legendDot--live" />
          current interval
        </span>
        <span>
          <i className="laneTank__legendDot laneTank__legendDot--done" />
          completed reps
        </span>
        <span>
          <i className="laneTank__legendDot laneTank__legendDot--rest" />
          round rest gate
        </span>
      </div>
    </section>
  )
}

interface RoundGateProps {
  active: boolean
  complete: boolean
  progress: number
}

function RoundGate({ active, complete, progress }: RoundGateProps) {
  return (
    <div
      className={['tankGate', active ? 'tankGate--active' : '', complete ? 'tankGate--done' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="tankGate__label">Rest</div>
      <div className="tankGate__column">
        <div className="tankGate__fill" style={fillStyle(progress)} />
      </div>
    </div>
  )
}

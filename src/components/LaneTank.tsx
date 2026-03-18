import { Fragment, type CSSProperties } from 'react'
import {
  getCurrentStep,
  getEffectivePhase,
  getStepProgress,
  type QuickWorkoutInput,
  type WorkoutSession,
} from '../lib/timerSession'
import { getRoundGateState } from '../lib/laneTankState'
import { getTankBadgeLabel, type TankBadgeKind } from '../lib/uiLabels'

interface LaneTankProps {
  session: WorkoutSession
  workout: QuickWorkoutInput
}

function fillStyle(fill: number): CSSProperties {
  return {
    ['--fill' as string]: `${Math.round(fill * 100)}%`,
  }
}

function getTankDensity(workout: QuickWorkoutInput) {
  const totalUnits = workout.rounds * workout.repsPerRound + Math.max(0, workout.rounds - 1)
  return totalUnits >= 24 || workout.repsPerRound >= 8 || workout.rounds >= 5
}

export function LaneTank({ session, workout }: LaneTankProps) {
  const step = getCurrentStep(session)
  const effectivePhase = getEffectivePhase(session)
  const activeProgress = getStepProgress(session)
  const compact = getTankDensity(workout)

  return (
    <section className={`laneTank${compact ? ' laneTank--compact' : ''}`}>
      <div className="laneTank__header">
        <div className="setupCard__eyebrow laneTank__eyebrow">進行タンク</div>
        <div className="laneTank__summary">
          {workout.rounds}セット / {workout.repsPerRound}本
        </div>
      </div>

      <div className="laneTank__track" role="img" aria-label="セット進行を示す液体タンク">
        {Array.from({ length: workout.rounds }, (_, roundIndex) => {
          const roundNumber = roundIndex + 1

          return (
            <Fragment key={`round-${roundNumber}`}>
              <div className="tankRound">
                <div className="tankRound__label">{roundNumber}セット</div>
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

                    if (isActiveRep && effectivePhase === 'interval') {
                      fill = activeProgress
                    }

                    if (session.phase === 'complete') {
                      fill = 1
                    }

                    const badgeKind: TankBadgeKind =
                      isActiveRep && step?.phase === 'lead_in'
                        ? 'lead'
                        : isActiveRep
                          ? 'active'
                          : isDone || session.phase === 'complete'
                            ? 'done'
                            : 'queued'

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
                          {getTankBadgeLabel(badgeKind, compact)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {roundNumber < workout.rounds && (
                <RoundGate
                  compact={compact}
                  {...getRoundGateState(session, roundNumber, effectivePhase, activeProgress)}
                />
              )}
            </Fragment>
          )
        })}
      </div>

      <div className="laneTank__legend">
        <span>
          <i className="laneTank__legendDot laneTank__legendDot--live" />
          進行中
        </span>
        <span>
          <i className="laneTank__legendDot laneTank__legendDot--done" />
          完了
        </span>
        <span>
          <i className="laneTank__legendDot laneTank__legendDot--rest" />
          セット間
        </span>
      </div>
    </section>
  )
}

interface RoundGateProps {
  active: boolean
  complete: boolean
  compact: boolean
  progress: number
}

function RoundGate({ active, complete, compact, progress }: RoundGateProps) {
  return (
    <div
      className={['tankGate', active ? 'tankGate--active' : '', complete ? 'tankGate--done' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="tankGate__label">{compact ? '間' : '間隔'}</div>
      <div className="tankGate__column">
        <div className="tankGate__fill" style={fillStyle(progress)} />
      </div>
    </div>
  )
}

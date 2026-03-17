import { getEffectivePhase, type WorkoutSession } from './timerSession'

export function getRoundGateState(
  session: WorkoutSession,
  roundNumber: number,
  effectivePhase: ReturnType<typeof getEffectivePhase>,
  activeProgress: number,
) {
  const nextRoundNumber = roundNumber + 1
  const active = effectivePhase === 'round_rest' && session.currentRound === nextRoundNumber
  const complete =
    session.phase === 'complete' ||
    session.currentRound > nextRoundNumber ||
    (session.currentRound === nextRoundNumber && effectivePhase !== 'round_rest')

  return {
    active,
    complete,
    progress: active ? activeProgress : complete ? 1 : 0,
  }
}

import { describe, expect, it } from 'vitest'
import { getRoundGateState } from '../src/lib/laneTankState'
import {
  getEffectivePhase,
  getStepProgress,
  startSession,
  tickSession,
  type QuickWorkoutInput,
} from '../src/lib/timerSession'

const workout: QuickWorkoutInput = {
  title: 'Gate Test',
  rounds: 2,
  repsPerRound: 2,
  intervalSec: 10,
  roundRestSec: 6,
  leadInSec: 4,
  audioEnabled: true,
}

describe('laneTank gate state', () => {
  it('keeps the round-rest gate filled after rest completes', () => {
    let session = startSession(workout, 0)
    session = tickSession(session, 4000).state

    const duringRest = tickSession(session, 24000).state
    const activeGate = getRoundGateState(
      duringRest,
      1,
      getEffectivePhase(duringRest),
      getStepProgress(duringRest),
    )

    expect(activeGate.active).toBe(true)
    expect(activeGate.complete).toBe(false)
    expect(activeGate.progress).toBe(0)

    const afterRest = tickSession(duringRest, 30000).state
    const completedGate = getRoundGateState(
      afterRest,
      1,
      getEffectivePhase(afterRest),
      getStepProgress(afterRest),
    )

    expect(afterRest.phase).toBe('interval')
    expect(afterRest.currentRound).toBe(2)
    expect(completedGate.active).toBe(false)
    expect(completedGate.complete).toBe(true)
    expect(completedGate.progress).toBe(1)
  })
})

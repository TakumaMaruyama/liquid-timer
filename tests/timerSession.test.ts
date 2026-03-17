import { describe, expect, it } from 'vitest'
import {
  pauseSession,
  resumeSession,
  rewindPhase,
  skipPhase,
  startSession,
  tickSession,
  type QuickWorkoutInput,
} from '../src/lib/timerSession'

const workout: QuickWorkoutInput = {
  title: 'Test Set',
  rounds: 2,
  repsPerRound: 2,
  intervalSec: 10,
  roundRestSec: 6,
  leadInSec: 4,
  audioEnabled: true,
}

describe('timerSession', () => {
  it('progresses through lead-in, interval, round rest, and completion', () => {
    let session = startSession(workout, 0)
    expect(session.phase).toBe('lead_in')

    let transition = tickSession(session, 4000)
    expect(transition.state.phase).toBe('interval')
    expect(transition.state.currentRound).toBe(1)
    expect(transition.state.currentRep).toBe(1)
    expect(transition.events).toContain('phase_switch')

    session = transition.state
    transition = tickSession(session, 24000)
    expect(transition.state.phase).toBe('round_rest')
    expect(transition.state.currentRound).toBe(2)
    expect(transition.state.currentRep).toBe(1)

    transition = tickSession(transition.state, 50000)
    expect(transition.state.phase).toBe('complete')
    expect(transition.events).toContain('workout_complete')
  })

  it('fires the five-second warning only once per step', () => {
    let session = startSession(workout, 0)
    session = tickSession(session, 4000).state

    const firstWarning = tickSession(session, 9001)
    expect(firstWarning.events).toContain('five_second_warning')

    const secondWarning = tickSession(firstWarning.state, 9500)
    expect(secondWarning.events).not.toContain('five_second_warning')
  })

  it('preserves remaining time across pause and resume', () => {
    let session = startSession(workout, 0)
    session = tickSession(session, 4000).state

    const paused = pauseSession(session, 7000)
    expect(paused.state.phase).toBe('paused')
    expect(paused.state.remainingMs).toBe(7000)

    const resumed = resumeSession(paused.state, 9000)
    expect(resumed.state.phase).toBe('interval')
    expect(resumed.state.phaseEndsAt).toBe(16000)
  })

  it('supports rewind and skip controls without corrupting the cursor', () => {
    let session = startSession(workout, 0)
    session = tickSession(session, 4000).state
    session = tickSession(session, 14000).state
    expect(session.currentRep).toBe(2)

    const rewound = rewindPhase(session, 14500)
    expect(rewound.state.currentRep).toBe(1)
    expect(rewound.state.phase).toBe('interval')

    const skipped = skipPhase(rewound.state, 14500)
    expect(skipped.state.currentRep).toBe(2)
    expect(skipped.state.phase).toBe('interval')
  })
})

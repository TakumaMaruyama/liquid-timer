import { describe, expect, it } from 'vitest'
import { draftFromSeconds, validateTimerDraft } from '../src/lib/timerDraft'
import { getWaterFill, pauseSession, resumeSession, startSession, tickSession, type QuickWorkoutInput } from '../src/lib/timerSession'

const oneShot: QuickWorkoutInput = {
  title: 'Timer',
  rounds: 1,
  repsPerRound: 1,
  intervalSec: 10,
  roundRestSec: 0,
  leadInSec: 3,
  audioEnabled: false,
}

describe('simple timer inputs', () => {
  it('converts saved seconds to separate minute and second drafts', () => {
    expect(draftFromSeconds(75, 10)).toEqual({ minutes: '1', seconds: '15', leadIn: '10' })
  })

  it('accepts a completely cleared field and treats one empty duration part as zero', () => {
    expect(validateTimerDraft({ minutes: '', seconds: '10', leadIn: '0' }).value).toEqual({ intervalSec: 10, leadInSec: 0 })
    expect(validateTimerDraft({ minutes: '2', seconds: '', leadIn: '5' }).value).toEqual({ intervalSec: 120, leadInSec: 5 })
    expect(validateTimerDraft({ minutes: '', seconds: '', leadIn: '0' }).value).toBeNull()
  })

  it('rejects invalid and zero values without coercing the displayed draft', () => {
    for (const draft of [
      { minutes: '0', seconds: '0', leadIn: '10' },
      { minutes: '1.5', seconds: '0', leadIn: '10' },
      { minutes: '-1', seconds: '0', leadIn: '10' },
      { minutes: '1', seconds: '60', leadIn: '10' },
      { minutes: '1', seconds: '1', leadIn: '' },
      { minutes: '1', seconds: '1', leadIn: '-2' },
    ]) {
      expect(validateTimerDraft(draft).value).toBeNull()
    }
  })
})

describe('one-shot water and timing', () => {
  it('stays empty during prep, fills in proportion to elapsed main time, then remains full', () => {
    let session = startSession(oneShot, 1000)
    expect(session.phase).toBe('lead_in')
    expect(getWaterFill(session)).toBe(0)
    session = tickSession(session, 4000).state
    expect(session.phase).toBe('interval')
    expect(getWaterFill(session)).toBe(0)
    session = tickSession(session, 9000).state
    expect(getWaterFill(session)).toBe(.5)
    session = tickSession(session, 14000).state
    expect(session.phase).toBe('complete')
    expect(getWaterFill(session)).toBe(1)
    expect(tickSession(session, 20000).state).toEqual(session)
  })

  it('freezes the water while paused and continues from the same level on resume', () => {
    let session = startSession(oneShot, 1000)
    session = tickSession(session, 6000).state
    session = pauseSession(session, 7000).state
    expect(getWaterFill(session)).toBeCloseTo(.3)
    expect(getWaterFill(tickSession(session, 30000).state)).toBeCloseTo(.3)
    session = resumeSession(session, 30000).state
    expect(getWaterFill(session)).toBeCloseTo(.3)
    expect(getWaterFill(tickSession(session, 35000).state)).toBeCloseTo(.8)
  })

  it('starts the main timer at the original press time when prep is zero', () => {
    const session = startSession({ ...oneShot, leadInSec: 0 }, 1234)
    expect(session.phase).toBe('interval')
    expect(session.phaseEndsAt).toBe(11234)
  })
})

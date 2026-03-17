export interface QuickWorkoutInput {
  title: string
  rounds: number
  repsPerRound: number
  intervalSec: number
  roundRestSec: number
  leadInSec: number
  audioEnabled: boolean
}

export type TimerPhase =
  | 'idle'
  | 'lead_in'
  | 'interval'
  | 'round_rest'
  | 'complete'
  | 'paused'

export type CueEvent =
  | 'five_second_warning'
  | 'phase_switch'
  | 'workout_complete'

type ActivePhase = Exclude<TimerPhase, 'idle' | 'paused' | 'complete'>

export interface TimerSessionState {
  currentRound: number
  totalRounds: number
  currentRep: number
  totalRepsInRound: number
  phase: TimerPhase
  phaseEndsAt: number | null
  remainingMs: number
}

export interface WorkoutPhaseStep {
  phase: ActivePhase
  round: number
  rep: number
  durationMs: number
}

export interface WorkoutSession extends TimerSessionState {
  workout: QuickWorkoutInput
  timeline: WorkoutPhaseStep[]
  cursor: number
  warningIssuedForCursor: boolean
  pausedPhase: ActivePhase | null
}

export interface SessionTransition {
  state: WorkoutSession
  events: CueEvent[]
}

export const DEFAULT_WORKOUT: QuickWorkoutInput = {
  title: 'メインセット',
  rounds: 4,
  repsPerRound: 6,
  intervalSec: 75,
  roundRestSec: 45,
  leadInSec: 10,
  audioEnabled: true,
}

const WARNING_THRESHOLD_MS = 5000

export function normalizeWorkoutInput(input: QuickWorkoutInput): QuickWorkoutInput {
  return {
    ...input,
    title: input.title.trim() || 'メインセット',
    rounds: clampInteger(input.rounds, 1),
    repsPerRound: clampInteger(input.repsPerRound, 1),
    intervalSec: clampInteger(input.intervalSec, 1),
    roundRestSec: clampInteger(input.roundRestSec, 0),
    leadInSec: clampInteger(input.leadInSec, 0),
    audioEnabled: Boolean(input.audioEnabled),
  }
}

export function buildTimeline(workout: QuickWorkoutInput): WorkoutPhaseStep[] {
  const timeline: WorkoutPhaseStep[] = []

  if (workout.leadInSec > 0) {
    timeline.push({
      phase: 'lead_in',
      round: 1,
      rep: 1,
      durationMs: workout.leadInSec * 1000,
    })
  }

  for (let round = 1; round <= workout.rounds; round += 1) {
    for (let rep = 1; rep <= workout.repsPerRound; rep += 1) {
      timeline.push({
        phase: 'interval',
        round,
        rep,
        durationMs: workout.intervalSec * 1000,
      })
    }

    if (round < workout.rounds && workout.roundRestSec > 0) {
      timeline.push({
        phase: 'round_rest',
        round: round + 1,
        rep: 1,
        durationMs: workout.roundRestSec * 1000,
      })
    }
  }

  return timeline
}

export function createIdleSession(input: QuickWorkoutInput): WorkoutSession {
  const workout = normalizeWorkoutInput(input)
  const timeline = buildTimeline(workout)
  const firstStep = timeline[0]

  return {
    workout,
    timeline,
    cursor: 0,
    warningIssuedForCursor: false,
    pausedPhase: null,
    currentRound: firstStep?.round ?? 1,
    totalRounds: workout.rounds,
    currentRep: firstStep?.rep ?? 1,
    totalRepsInRound: workout.repsPerRound,
    phase: 'idle',
    phaseEndsAt: null,
    remainingMs: firstStep?.durationMs ?? 0,
  }
}

export function startSession(input: QuickWorkoutInput, now: number): WorkoutSession {
  const workout = normalizeWorkoutInput(input)
  const timeline = buildTimeline(workout)

  if (timeline.length === 0) {
    return {
      ...createIdleSession(workout),
      phase: 'complete',
      remainingMs: 0,
    }
  }

  return createSessionAtCursor({
    workout,
    timeline,
    cursor: 0,
    startedAt: now,
  })
}

export function resetSession(input: QuickWorkoutInput) {
  return createIdleSession(input)
}

export function tickSession(session: WorkoutSession, now: number): SessionTransition {
  if (!isRunningPhase(session.phase)) {
    return { state: session, events: [] }
  }

  let nextState = session
  const events: CueEvent[] = []

  while (
    isRunningPhase(nextState.phase) &&
    nextState.phaseEndsAt !== null &&
    now >= nextState.phaseEndsAt
  ) {
    const transition = moveToNextPhase(nextState, nextState.phaseEndsAt)
    nextState = transition.state
    events.push(...transition.events)
  }

  if (!isRunningPhase(nextState.phase) || nextState.phaseEndsAt === null) {
    return { state: nextState, events }
  }

  const remainingMs = Math.max(0, nextState.phaseEndsAt - now)
  nextState = {
    ...nextState,
    remainingMs,
  }

  if (
    !nextState.warningIssuedForCursor &&
    remainingMs > 0 &&
    remainingMs <= WARNING_THRESHOLD_MS
  ) {
    nextState = {
      ...nextState,
      warningIssuedForCursor: true,
    }
    events.push('five_second_warning')
  }

  return { state: nextState, events }
}

export function pauseSession(session: WorkoutSession, now: number): SessionTransition {
  const transition = tickSession(session, now)
  const nextState = transition.state

  if (!isRunningPhase(nextState.phase)) {
    return transition
  }

  return {
    state: {
      ...nextState,
      pausedPhase: nextState.phase,
      phase: 'paused',
      phaseEndsAt: null,
    },
    events: transition.events,
  }
}

export function resumeSession(session: WorkoutSession, now: number): SessionTransition {
  if (session.phase !== 'paused' || session.pausedPhase === null) {
    return { state: session, events: [] }
  }

  return {
    state: {
      ...session,
      phase: session.pausedPhase,
      pausedPhase: null,
      phaseEndsAt: now + session.remainingMs,
    },
    events: [],
  }
}

export function skipPhase(session: WorkoutSession, now: number): SessionTransition {
  const transition = tickSession(session, now)
  const nextState = transition.state

  if (nextState.phase === 'complete' || nextState.phase === 'idle') {
    return transition
  }

  return {
    state: jumpToCursor(
      nextState,
      nextState.cursor + 1,
      now,
      nextState.phase === 'paused',
    ),
    events: transition.events,
  }
}

export function rewindPhase(session: WorkoutSession, now: number): SessionTransition {
  const transition = tickSession(session, now)
  const nextState = transition.state

  if (nextState.phase === 'idle') {
    return transition
  }

  const cursor =
    nextState.phase === 'complete'
      ? nextState.timeline.length - 1
      : Math.max(0, nextState.cursor - 1)

  return {
    state: jumpToCursor(nextState, cursor, now, nextState.phase === 'paused'),
    events: transition.events,
  }
}

export function getCurrentStep(session: WorkoutSession) {
  if (session.phase === 'idle' || session.phase === 'complete') {
    return session.timeline[Math.min(session.cursor, session.timeline.length - 1)] ?? null
  }

  return session.timeline[session.cursor] ?? null
}

export function getEffectivePhase(session: WorkoutSession): TimerPhase {
  if (session.phase !== 'paused') {
    return session.phase
  }

  return session.pausedPhase ?? 'paused'
}

export function getStepProgress(session: WorkoutSession) {
  const step = getCurrentStep(session)
  const effectivePhase = getEffectivePhase(session)

  if (session.phase === 'complete') {
    return 1
  }

  if (!step || effectivePhase === 'idle') {
    return 0
  }

  if (step.durationMs === 0) {
    return 1
  }

  return clamp(1 - session.remainingMs / step.durationMs, 0, 1)
}

export function getTotalWorkoutSeconds(workout: QuickWorkoutInput) {
  const normalized = normalizeWorkoutInput(workout)
  const repSeconds =
    normalized.rounds * normalized.repsPerRound * normalized.intervalSec
  const restSeconds = Math.max(0, normalized.rounds - 1) * normalized.roundRestSec
  return normalized.leadInSec + repSeconds + restSeconds
}

export function formatDurationLabel(seconds: number) {
  const wholeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const remainder = wholeSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function formatSecondsDisplay(remainingMs: number) {
  return Math.max(0, Math.ceil(remainingMs / 1000)).toString()
}

export function getCountdownCueSeconds(
  previousRemainingMs: number,
  currentRemainingMs: number,
) {
  const previousSecond = Math.ceil(Math.max(0, previousRemainingMs) / 1000)
  const currentSecond = Math.ceil(Math.max(0, currentRemainingMs) / 1000)

  if (currentSecond <= 0 || previousSecond <= currentSecond) {
    return []
  }

  const cues: number[] = []
  const startSecond = Math.min(3, previousSecond - 1)
  const endSecond = Math.max(1, currentSecond)

  for (let second = startSecond; second >= endSecond; second -= 1) {
    cues.push(second)
  }

  return cues
}

export function formatRoundLabel(currentRound: number, totalRounds: number) {
  return `セット ${currentRound}/${totalRounds}`
}

export function isRunningPhase(phase: TimerPhase): phase is ActivePhase {
  return phase === 'lead_in' || phase === 'interval' || phase === 'round_rest'
}

function moveToNextPhase(session: WorkoutSession, startedAt: number): SessionTransition {
  const nextCursor = session.cursor + 1

  if (nextCursor >= session.timeline.length) {
    return {
      state: {
        ...session,
        currentRound: session.workout.rounds,
        currentRep: session.workout.repsPerRound,
        totalRepsInRound: session.workout.repsPerRound,
        cursor: session.timeline.length,
        phase: 'complete',
        phaseEndsAt: null,
        remainingMs: 0,
        pausedPhase: null,
        warningIssuedForCursor: true,
      },
      events: ['workout_complete'],
    }
  }

  return {
    state: createSessionAtCursor({
      workout: session.workout,
      timeline: session.timeline,
      cursor: nextCursor,
      startedAt,
    }),
    events: ['phase_switch'],
  }
}

function jumpToCursor(
  session: WorkoutSession,
  cursor: number,
  now: number,
  keepPaused: boolean,
) {
  if (cursor < 0 || session.timeline.length === 0) {
    return createIdleSession(session.workout)
  }

  if (cursor >= session.timeline.length) {
    return {
      ...createIdleSession(session.workout),
      phase: 'complete' as const,
      cursor: session.timeline.length,
      currentRound: session.workout.rounds,
      currentRep: session.workout.repsPerRound,
      remainingMs: 0,
    }
  }

  const step = session.timeline[cursor]
  const baseSession = createSessionAtCursor({
    workout: session.workout,
    timeline: session.timeline,
    cursor,
    startedAt: now,
  })

  if (!keepPaused) {
    return baseSession
  }

  return {
    ...baseSession,
    phase: 'paused' as const,
    pausedPhase: step.phase,
    phaseEndsAt: null,
  }
}

function createSessionAtCursor({
  workout,
  timeline,
  cursor,
  startedAt,
}: {
  workout: QuickWorkoutInput
  timeline: WorkoutPhaseStep[]
  cursor: number
  startedAt: number
}): WorkoutSession {
  const step = timeline[cursor]

  return {
    workout,
    timeline,
    cursor,
    warningIssuedForCursor: false,
    pausedPhase: null,
    currentRound: step.round,
    totalRounds: workout.rounds,
    currentRep: step.rep,
    totalRepsInRound: workout.repsPerRound,
    phase: step.phase,
    phaseEndsAt: startedAt + step.durationMs,
    remainingMs: step.durationMs,
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function clampInteger(value: number, minimum: number) {
  return Math.max(minimum, Math.round(value))
}

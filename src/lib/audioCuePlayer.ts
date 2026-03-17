import type { CueEvent } from './timerSession'

export interface AudioCuePlayer {
  unlock: () => Promise<boolean>
  play: (event: CueEvent, enabled: boolean) => Promise<void>
  playCountdownTick: (second: number, enabled: boolean) => Promise<void>
}

interface ToneStep {
  delay: number
  duration: number
  frequency: number
  gain: number
  overtone?: number
  overtoneGain?: number
  waveform: OscillatorType
}

const warningPitch = {
  frequency: 1760,
  overtone: 880,
}

const cueMap: Record<CueEvent, ToneStep[]> = {
  five_second_warning: [
    {
      delay: 0,
      duration: 0.09,
      frequency: warningPitch.frequency,
      gain: 0.085,
      overtone: warningPitch.overtone,
      overtoneGain: 0.03,
      waveform: 'square',
    },
    {
      delay: 0.16,
      duration: 0.09,
      frequency: warningPitch.frequency,
      gain: 0.085,
      overtone: warningPitch.overtone,
      overtoneGain: 0.03,
      waveform: 'square',
    },
  ],
  phase_switch: [
    {
      delay: 0,
      duration: 0.13,
      frequency: 1180,
      gain: 0.075,
      overtone: 590,
      overtoneGain: 0.024,
      waveform: 'square',
    },
  ],
  workout_complete: [
    {
      delay: 0,
      duration: 0.1,
      frequency: 740,
      gain: 0.055,
      waveform: 'triangle',
    },
    {
      delay: 0.14,
      duration: 0.1,
      frequency: 980,
      gain: 0.06,
      waveform: 'triangle',
    },
    {
      delay: 0.28,
      duration: 0.18,
      frequency: 1320,
      gain: 0.065,
      waveform: 'triangle',
    },
  ],
}

const countdownCueMap: Record<1 | 2 | 3, ToneStep[]> = {
  3: [
    {
      delay: 0,
      duration: 0.08,
      frequency: warningPitch.frequency,
      gain: 0.07,
      overtone: warningPitch.overtone,
      overtoneGain: 0.024,
      waveform: 'square',
    },
  ],
  2: [
    {
      delay: 0,
      duration: 0.08,
      frequency: warningPitch.frequency,
      gain: 0.074,
      overtone: warningPitch.overtone,
      overtoneGain: 0.026,
      waveform: 'square',
    },
  ],
  1: [
    {
      delay: 0,
      duration: 0.09,
      frequency: warningPitch.frequency,
      gain: 0.082,
      overtone: warningPitch.overtone,
      overtoneGain: 0.03,
      waveform: 'square',
    },
  ],
}

export function createAudioCuePlayer(): AudioCuePlayer {
  let context: AudioContext | null = null

  const ensureContext = async () => {
    if (typeof window === 'undefined' || !('AudioContext' in window)) {
      return null
    }

    context ??= new window.AudioContext()

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        return context
      }
    }

    return context
  }

  const unlock = async () => {
    const ctx = await ensureContext()
    if (!ctx) {
      return false
    }

    try {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime)
      oscillator.frequency.setValueAtTime(440, ctx.currentTime)
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.01)
    } catch {
      return false
    }

    return ctx.state === 'running'
  }

  const scheduleTone = (
    ctx: AudioContext,
    startAt: number,
    frequency: number,
    duration: number,
    gain: number,
    waveform: OscillatorType,
  ) => {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = waveform
    oscillator.frequency.setValueAtTime(frequency, startAt)
    gainNode.gain.setValueAtTime(0.0001, startAt)
    gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.008)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + duration + 0.02)
  }

  const play = async (event: CueEvent, enabled: boolean) => {
    if (!enabled) {
      return
    }

    const ctx = await ensureContext()
    if (!ctx || ctx.state !== 'running') {
      return
    }

    const startAt = ctx.currentTime + 0.01

    for (const step of cueMap[event]) {
      const toneStart = startAt + step.delay
      scheduleTone(
        ctx,
        toneStart,
        step.frequency,
        step.duration,
        step.gain,
        step.waveform,
      )

      if (step.overtone && step.overtoneGain) {
        scheduleTone(
          ctx,
          toneStart,
          step.overtone,
          step.duration,
          step.overtoneGain,
          'triangle',
        )
      }
    }
  }

  const playCountdownTick = async (second: number, enabled: boolean) => {
    if (!enabled || second < 1 || second > 3) {
      return
    }

    const ctx = await ensureContext()
    if (!ctx || ctx.state !== 'running') {
      return
    }

    const startAt = ctx.currentTime + 0.01

    for (const step of countdownCueMap[second as 1 | 2 | 3]) {
      const toneStart = startAt + step.delay
      scheduleTone(
        ctx,
        toneStart,
        step.frequency,
        step.duration,
        step.gain,
        step.waveform,
      )

      if (step.overtone && step.overtoneGain) {
        scheduleTone(
          ctx,
          toneStart,
          step.overtone,
          step.duration,
          step.overtoneGain,
          'triangle',
        )
      }
    }
  }

  return {
    unlock,
    play,
    playCountdownTick,
  }
}

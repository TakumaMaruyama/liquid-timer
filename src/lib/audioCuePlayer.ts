import type { CueEvent } from './timerSession'

export interface AudioCuePlayer {
  unlock: () => Promise<boolean>
  play: (event: CueEvent, enabled: boolean) => Promise<void>
}

interface ToneStep {
  delay: number
  duration: number
  frequency: number
  gain: number
}

const cueMap: Record<CueEvent, ToneStep[]> = {
  five_second_warning: [{ delay: 0, duration: 0.07, frequency: 880, gain: 0.04 }],
  phase_switch: [{ delay: 0, duration: 0.11, frequency: 640, gain: 0.05 }],
  workout_complete: [
    { delay: 0, duration: 0.1, frequency: 520, gain: 0.045 },
    { delay: 0.14, duration: 0.11, frequency: 660, gain: 0.05 },
    { delay: 0.28, duration: 0.16, frequency: 820, gain: 0.055 },
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
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.type = event === 'phase_switch' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(step.frequency, startAt + step.delay)
      gainNode.gain.setValueAtTime(0.0001, startAt + step.delay)
      gainNode.gain.linearRampToValueAtTime(step.gain, startAt + step.delay + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + step.delay + step.duration,
      )
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.start(startAt + step.delay)
      oscillator.stop(startAt + step.delay + step.duration + 0.02)
    }
  }

  return {
    unlock,
    play,
  }
}

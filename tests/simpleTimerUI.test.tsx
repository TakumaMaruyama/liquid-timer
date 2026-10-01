// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3000/"}
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SetupScreen } from '../src/components/SetupScreen'
import { RunScreen } from '../src/components/RunScreen'
import App from '../src/App'
import { useWorkoutSession } from '../src/hooks/useWorkoutSession'
import { validateTimerDraft, type TimerDraft } from '../src/lib/timerDraft'
import { type QuickWorkoutInput } from '../src/lib/timerSession'
import { loadStoredPresetState, saveStoredPresetState } from '../src/lib/presetStore'

const audio = vi.hoisted(() => ({
  unlock: vi.fn<() => Promise<boolean>>(),
  scheduleAt: vi.fn(() => true),
  scheduleCountdownAt: vi.fn(() => true),
  cancelScheduled: vi.fn(),
  play: vi.fn(async () => {}),
  playCountdownTick: vi.fn(async () => {}),
}))

vi.mock('../src/lib/audioCuePlayer', () => ({
  createAudioCuePlayer: () => audio,
}))

const workout: QuickWorkoutInput = {
  title: 'Timer', rounds: 1, repsPerRound: 1, intervalSec: 10, roundRestSec: 0, leadInSec: 3, audioEnabled: true,
}

let host: HTMLDivElement
let root: Root
let now = 1000
let frame: FrameRequestCallback | null = null

beforeEach(() => {
  const stored = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value) },
      clear: () => stored.clear(),
    },
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  now = 1000
  frame = null
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  audio.unlock.mockReset().mockResolvedValue(true)
  audio.scheduleAt.mockClear().mockReturnValue(true)
  audio.scheduleCountdownAt.mockClear().mockReturnValue(true)
  audio.cancelScheduled.mockClear()
  audio.play.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function pointerEvent(name: string, id = 1, x = 10, y = 10) {
  const event = new Event(name, { bubbles: true }) as PointerEvent
  Object.defineProperties(event, {
    pointerId: { value: id },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
  })
  return event
}

describe('setup interactions', () => {
  it('allows the final digit to be deleted, keeps blank through blur, and launches from the current draft on pointerdown', async () => {
    let launched: { seconds: number; pressedAt: number } | null = null
    function Harness() {
      const [draft, setDraft] = useState<TimerDraft>({ minutes: '1', seconds: '10', leadIn: '10' })
      const valid = validateTimerDraft(draft)
      return <SetupScreen draft={draft} errors={valid.errors} canStart={valid.value !== null} audioEnabled error={null}
        onDraftChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        onAudioChange={() => {}}
        onLaunch={(pressedAt) => { launched = { seconds: validateTimerDraft(draft).value?.intervalSec ?? -1, pressedAt } }} />
    }
    await act(async () => root.render(<Harness />))
    const minutes = host.querySelector<HTMLInputElement>('#minutes')!
    const seconds = host.querySelector<HTMLInputElement>('#seconds')!
    await act(async () => { setInput(minutes, ''); minutes.dispatchEvent(new Event('blur', { bubbles: true })) })
    expect(minutes.value).toBe('')
    await act(async () => setInput(seconds, ''))
    expect(seconds.value).toBe('')
    expect(host.querySelector<HTMLButtonElement>('.startButton')?.disabled).toBe(true)
    await act(async () => setInput(seconds, '42'))
    expect(host.querySelector<HTMLButtonElement>('.startButton')?.disabled).toBe(false)
    await act(async () => host.querySelector<HTMLButtonElement>('.startButton')!.dispatchEvent(pointerEvent('pointerdown')))
    expect(launched).toEqual({ seconds: 42, pressedAt: 1000 })
  })

  it('starts on keyboard keydown without repeating while a key is held', async () => {
    let launches = 0
    const draft = { minutes: '0', seconds: '10', leadIn: '0' }
    await act(async () => root.render(<SetupScreen draft={draft} errors={{}} canStart audioEnabled={false} error={null}
      onDraftChange={() => {}} onAudioChange={() => {}} onLaunch={() => { launches += 1 }} />))
    const start = host.querySelector<HTMLButtonElement>('.startButton')!
    await act(async () => start.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    await act(async () => start.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true })))
    await act(async () => start.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })))
    expect(launches).toBe(1)
  })

  it('inherits the selected old preset and changes only its timing and sound settings', async () => {
    saveStoredPresetState(window.localStorage, {
      selectedPresetId: 'second',
      presets: [
        { id: 'first', name: 'Old A', workout: { ...workout, intervalSec: 45 }, createdAt: 1, updatedAt: 1 },
        { id: 'second', name: 'Old B', workout: { ...workout, rounds: 4, repsPerRound: 6, roundRestSec: 45, intervalSec: 125, leadInSec: 2, audioEnabled: false }, createdAt: 2, updatedAt: 2 },
      ],
    })
    await act(async () => root.render(<App />))
    expect(host.querySelector<HTMLInputElement>('#minutes')?.value).toBe('2')
    expect(host.querySelector<HTMLInputElement>('#seconds')?.value).toBe('5')
    await act(async () => setInput(host.querySelector<HTMLInputElement>('#minutes')!, '1'))
    await act(async () => setInput(host.querySelector<HTMLInputElement>('#seconds')!, '20'))
    await act(async () => host.querySelector<HTMLButtonElement>('.startButton')!.dispatchEvent(pointerEvent('pointerdown')))
    expect(host.textContent).toContain('設定時間 1:20')
    const stored = loadStoredPresetState(window.localStorage)
    expect(stored.selectedPresetId).toBe('second')
    expect(stored.presets[0].workout.intervalSec).toBe(45)
    expect(stored.presets[1].workout).toMatchObject({ rounds: 4, repsPerRound: 6, roundRestSec: 45, intervalSec: 80, leadInSec: 2, audioEnabled: false })
  })

  it('activates audio on pointer release after the setup screen has unmounted', async () => {
    audio.unlock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    await act(async () => root.render(<App />))
    await act(async () => host.querySelector<HTMLButtonElement>('.startButton')!.dispatchEvent(pointerEvent('pointerdown', 9)))
    expect(host.querySelector('.setupScreen')).toBeNull()
    expect(host.querySelector('.runScreen')).not.toBeNull()
    await act(async () => window.dispatchEvent(pointerEvent('pointerup', 9)))
    expect(audio.scheduleAt).toHaveBeenCalledWith('phase_switch', true, 11000)
    expect(host.textContent).toContain('開始準備')
  })

  it('returns to the same settings with a reason when audio initialization throws', async () => {
    audio.unlock.mockRejectedValue(new Error('AudioContext failed'))
    await act(async () => root.render(<App />))
    const start = host.querySelector<HTMLButtonElement>('.startButton')!
    await act(async () => start.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(host.querySelector('.runScreen')).toBeNull()
    expect(host.querySelector('.setupScreen')).not.toBeNull()
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/音声/)
    expect(host.querySelector<HTMLInputElement>('#minutes')?.value).toBe('4')
    expect(host.querySelector<HTMLInputElement>('#seconds')?.value).toBe('0')
  })
})

describe('press timing and audio failure', () => {
  let timer: ReturnType<typeof useWorkoutSession>
  async function mountTimer() {
    function Harness() {
      const hook = useWorkoutSession(workout)
      useEffect(() => { timer = hook })
      return <div>{hook.session.phase}:{hook.operationLocked ? 'locked' : 'open'}</div>
    }
    await act(async () => root.render(<Harness />))
  }

  it('starts immediately, uses the press timestamp for the first cue, and ignores a second start', async () => {
    let resolve!: (value: boolean) => void
    audio.unlock.mockReturnValue(new Promise((done) => { resolve = done }))
    await mountTimer()
    await act(async () => { expect(timer.start(workout, 1000)).toBe(true) })
    expect(timer.session.phase).toBe('lead_in')
    expect(timer.session.phaseEndsAt).toBe(4000)
    expect(timer.operationLocked).toBe(true)
    expect(timer.start(workout, 1000)).toBe(false)
    now = 1400
    await act(async () => resolve(true))
    expect(audio.scheduleAt).toHaveBeenCalledWith('phase_switch', true, 4000)
  })

  it('aborts on a rejected audio initialization and keeps the session editable', async () => {
    audio.unlock.mockRejectedValue(new Error('AudioContext denied'))
    await mountTimer()
    await act(async () => { timer.start(workout, 1000) })
    expect(timer.session.phase).toBe('idle')
    expect(timer.operationLocked).toBe(false)
    expect(timer.startError).toMatch(/音声/)
  })

  it('does not let an old audio promise schedule a cue after reset', async () => {
    let resolve!: (value: boolean) => void
    audio.unlock.mockReturnValue(new Promise((done) => { resolve = done }))
    await mountTimer()
    await act(async () => { timer.start(workout, 1000) })
    await act(async () => { timer.setLocked(false); expect(timer.reset()).toBe(true) })
    await act(async () => resolve(true))
    expect(timer.session.phase).toBe('idle')
    expect(audio.scheduleAt).not.toHaveBeenCalled()
  })

  it('stops when audio is still pending at the first-cue deadline', async () => {
    audio.unlock.mockReturnValue(new Promise(() => {}))
    await mountTimer()
    await act(async () => { timer.start(workout, 1000) })
    now = 1001
    await act(async () => frame?.(now))
    expect(audio.play).not.toHaveBeenCalled()
    now = 4000
    await act(async () => frame?.(now))
    expect(timer.session.phase).toBe('idle')
    expect(timer.startError).toMatch(/間に合いません/)
    expect(audio.scheduleAt).not.toHaveBeenCalled()
  })

  it('starts with zero prep without requiring a start cue and rejects late audio at completion', async () => {
    audio.unlock.mockReturnValue(new Promise(() => {}))
    await mountTimer()
    await act(async () => { timer.start({ ...workout, leadInSec: 0, intervalSec: 1 }, 1000) })
    expect(timer.session.phase).toBe('interval')
    expect(timer.session.phaseEndsAt).toBe(2000)
    expect(audio.scheduleAt).not.toHaveBeenCalled()
    now = 2000
    await act(async () => frame?.(now))
    expect(timer.session.phase).toBe('idle')
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('retries sound activation on pointer release after the setup button has gone', async () => {
    audio.unlock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    await mountTimer()
    await act(async () => { timer.start(workout, 1000, 7) })
    expect(timer.session.phase).toBe('lead_in')
    expect(audio.scheduleAt).not.toHaveBeenCalled()
    await act(async () => window.dispatchEvent(pointerEvent('pointerup', 7)))
    expect(audio.scheduleAt).toHaveBeenCalledTimes(1)
    expect(audio.scheduleAt).toHaveBeenCalledWith('phase_switch', true, 4000)
  })

  it('discards hidden-page reservations and only reschedules future cues after return', async () => {
    await mountTimer()
    await act(async () => { timer.start(workout, 1000) })
    expect(audio.scheduleAt).toHaveBeenCalledTimes(1)
    const hidden = vi.spyOn(document, 'hidden', 'get')
    hidden.mockReturnValue(true)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(audio.cancelScheduled).toHaveBeenCalled()
    now = 2000
    hidden.mockReturnValue(false)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(audio.scheduleAt).toHaveBeenCalledTimes(2)
    hidden.mockReturnValue(true)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    now = 5000
    hidden.mockReturnValue(false)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(timer.session.phase).toBe('idle')
    expect(audio.scheduleAt).toHaveBeenCalledTimes(2)
  })
})

describe('waterproof operation lock', () => {
  let timer: ReturnType<typeof useWorkoutSession>
  async function mountRun() {
    function Harness() {
      const hook = useWorkoutSession({ ...workout, audioEnabled: false })
      useEffect(() => { timer = hook })
      return <RunScreen timer={hook} onEdit={() => {}} onAbort={() => {}} />
    }
    await act(async () => root.render(<Harness />))
    await act(async () => { timer.start({ ...workout, audioEnabled: false }, 1000) })
  }

  it('keeps controls unavailable until a two-second hold is released, including a trailing click', async () => {
    await mountRun()
    const lock = host.querySelector<HTMLButtonElement>('.lockButton')!
    vi.spyOn(lock, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)
    expect(host.textContent).not.toContain('一時停止')
    await act(async () => lock.dispatchEvent(pointerEvent('pointerdown')))
    now = 2999
    await act(async () => lock.dispatchEvent(pointerEvent('pointerup')))
    expect(timer.operationLocked).toBe(true)
    await act(async () => lock.dispatchEvent(pointerEvent('pointerdown')))
    now = 5000
    await act(async () => lock.dispatchEvent(pointerEvent('pointerup')))
    await act(async () => lock.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(timer.operationLocked).toBe(false)
    expect(host.textContent).toContain('一時停止')
  })

  it('cancels unlock when a second finger touches outside the button', async () => {
    await mountRun()
    const lock = host.querySelector<HTMLButtonElement>('.lockButton')!
    vi.spyOn(lock, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)
    await act(async () => lock.dispatchEvent(pointerEvent('pointerdown', 1)))
    await act(async () => document.body.dispatchEvent(pointerEvent('pointerdown', 2)))
    now = 4000
    await act(async () => lock.dispatchEvent(pointerEvent('pointerup', 1)))
    expect(timer.operationLocked).toBe(true)
  })

  it('cancels an outside move, pointer cancellation, and hiding the page', async () => {
    await mountRun()
    const lock = host.querySelector<HTMLButtonElement>('.lockButton')!
    vi.spyOn(lock, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)
    await act(async () => lock.dispatchEvent(pointerEvent('pointerdown', 1)))
    await act(async () => lock.dispatchEvent(pointerEvent('pointermove', 1, 150, 150)))
    now = 4000
    await act(async () => lock.dispatchEvent(pointerEvent('pointerup', 1)))
    expect(timer.operationLocked).toBe(true)

    await act(async () => lock.dispatchEvent(pointerEvent('pointerdown', 2)))
    await act(async () => lock.dispatchEvent(pointerEvent('pointercancel', 2)))
    now = 7000
    await act(async () => lock.dispatchEvent(pointerEvent('pointerup', 2)))
    expect(timer.operationLocked).toBe(true)

    await act(async () => lock.dispatchEvent(pointerEvent('pointerdown', 3)))
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    hidden.mockReturnValue(false)
    now = 10000
    await act(async () => lock.dispatchEvent(pointerEvent('pointerup', 3)))
    expect(timer.operationLocked).toBe(true)
  })

  it('supports keyboard hold, relocks on resume and restart, and stays locked at completion', async () => {
    await mountRun()
    const lock = host.querySelector<HTMLButtonElement>('.lockButton')!
    await act(async () => lock.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })))
    now = 3000
    await act(async () => lock.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })))
    await act(async () => lock.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(timer.operationLocked).toBe(false)
    await act(async () => { expect(timer.pause()).toBe(true) })
    expect(timer.session.phase).toBe('paused')
    await act(async () => { expect(timer.resume()).toBe(true) })
    expect(timer.operationLocked).toBe(true)
    now = 15000
    await act(async () => frame?.(now))
    expect(timer.session.phase).toBe('complete')
    expect(timer.operationLocked).toBe(true)
    expect(host.textContent).not.toContain('もう一度')
    await act(async () => timer.setLocked(false))
    expect(host.textContent).toContain('もう一度')
    await act(async () => { expect(timer.start({ ...workout, audioEnabled: false }, now)).toBe(true) })
    expect(timer.operationLocked).toBe(true)
    expect(timer.session.phase).toBe('lead_in')
  })
})

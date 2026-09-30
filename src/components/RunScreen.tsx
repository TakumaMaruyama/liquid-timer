import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { LaneTank } from './LaneTank'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { formatDurationLabel, getEffectivePhase } from '../lib/timerSession'

interface RunScreenProps {
  timer: ReturnType<typeof useWorkoutSession>
  onEdit: () => void
  onAbort: () => void
}

const HOLD_MS = 2000

export function RunScreen({ timer, onEdit, onAbort }: RunScreenProps) {
  const { session, operationLocked, startError } = timer
  const [holdProgress, setHoldProgress] = useState(0)
  const pointerHoldRef = useRef<{ id: number; startedAt: number } | null>(null)
  const keyboardHoldRef = useRef<{ key: string; startedAt: number } | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const effectivePhase = getEffectivePhase(session)
  const phaseLabel = session.phase === 'complete'
    ? '終了'
    : session.phase === 'paused'
      ? '一時停止'
      : effectivePhase === 'lead_in'
        ? '開始準備'
        : '計測中'

  useEffect(() => {
    if (session.phase === 'idle' && startError) onAbort()
  }, [onAbort, session.phase, startError])

  const cancelHold = () => {
    pointerHoldRef.current = null
    keyboardHoldRef.current = null
    if (progressIntervalRef.current !== null) window.clearInterval(progressIntervalRef.current)
    progressIntervalRef.current = null
    setHoldProgress(0)
  }

  useEffect(() => {
    const onBlur = () => cancelHold()
    const onVisibility = () => { if (document.hidden) cancelHold() }
    const onOtherPointer = (event: globalThis.PointerEvent) => {
      if (pointerHoldRef.current && event.pointerId !== pointerHoldRef.current.id) cancelHold()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pointerdown', onOtherPointer, true)
    return () => {
      if (progressIntervalRef.current !== null) window.clearInterval(progressIntervalRef.current)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointerdown', onOtherPointer, true)
    }
  }, [])

  const startProgress = () => {
    if (progressIntervalRef.current !== null) window.clearInterval(progressIntervalRef.current)
    setHoldProgress(0)
    progressIntervalRef.current = window.setInterval(() => {
      const startedAt = pointerHoldRef.current?.startedAt ?? keyboardHoldRef.current?.startedAt
      if (startedAt === undefined) return
      setHoldProgress(Math.min(1, (performance.now() - startedAt) / HOLD_MS))
    }, 40)
  }

  const finishHold = (startedAt: number) => {
    const elapsed = performance.now() - startedAt
    cancelHold()
    if (elapsed >= HOLD_MS && !document.hidden) timer.setLocked(false)
  }

  const onUnlockPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || pointerHoldRef.current || keyboardHoldRef.current) {
      cancelHold()
      return
    }
    pointerHoldRef.current = { id: event.pointerId, startedAt: performance.now() }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture unavailable */ }
    startProgress()
  }

  const onUnlockPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerHoldRef.current?.id !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      cancelHold()
    }
  }

  const onUnlockPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const hold = pointerHoldRef.current
    if (!hold || hold.id !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      cancelHold()
      return
    }
    finishHold(hold.startedAt)
  }

  const onUnlockKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (event.repeat || keyboardHoldRef.current || pointerHoldRef.current) return
    keyboardHoldRef.current = { key: event.key, startedAt: performance.now() }
    startProgress()
  }

  const onUnlockKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (keyboardHoldRef.current?.key !== event.key) return
    event.preventDefault()
    finishHold(keyboardHoldRef.current.startedAt)
  }

  const onRestartPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.isPrimary && event.button === 0) timer.start(session.workout, performance.now(), event.pointerId)
  }
  const onRestartKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault()
      timer.start(session.workout, performance.now())
    }
  }

  const unlockedActions = session.phase === 'complete'
    ? (
      <>
        <button className="controlButton controlButton--primary" type="button" onPointerDown={onRestartPointerDown} onKeyDown={onRestartKeyDown} onClick={(event) => { if (event.detail === 0) timer.start(session.workout, performance.now()) }}>もう一度</button>
        <button className="controlButton controlButton--secondary" type="button" onClick={onEdit}>時間を変更</button>
      </>
    ) : (
      <>
        <button className="controlButton controlButton--primary" type="button" onClick={session.phase === 'paused' ? timer.resume : timer.pause}>{session.phase === 'paused' ? '再開' : '一時停止'}</button>
        <button className="controlButton controlButton--secondary" type="button" onClick={onEdit}>リセットして設定へ</button>
      </>
    )

  return (
    <section className="runScreen">
      <div className="runPanel">
        <header className="runHeader">
          <div><span className="eyebrow">LIQUID TIMER</span><h1>水が満ちるまで</h1></div>
          {operationLocked ? (
            <button key="unlock" className="lockButton" type="button" aria-label="2秒長押しして離すと操作ロックを解除" onPointerDown={onUnlockPointerDown} onPointerMove={onUnlockPointerMove} onPointerUp={onUnlockPointerUp} onPointerCancel={cancelHold} onLostPointerCapture={cancelHold} onKeyDown={onUnlockKeyDown} onKeyUp={onUnlockKeyUp} onBlur={cancelHold} onClick={(event) => event.preventDefault()}>
              <span className="lockButton__progress" style={{ width: (holdProgress * 100) + '%' }} />
              <span>🔒 2秒長押しで解除</span>
            </button>
          ) : (
            <button key="relock" className="lockButton lockButton--open" type="button" onClick={() => timer.setLocked(true)}>🔓 再ロック</button>
          )}
        </header>

        <div className="runBody">
          <div className="runMeta"><span className="runStatus">{phaseLabel}</span><span className="runDuration">設定時間 {formatDurationLabel(session.workout.intervalSec)}</span></div>
          <div className="tankStage">
            <LaneTank session={session} />
            <div className="tankClock" aria-live="off">
              <span>{effectivePhase === 'lead_in' ? '開始まで' : '残り時間'}</span>
              <strong>{formatDurationLabel(session.remainingMs / 1000)}</strong>
            </div>
          </div>
          {session.phase === 'paused' && <p className="runMessage">水位を止めています</p>}
          {session.phase === 'complete' && <p className="runMessage">計測が終わりました</p>}
        </div>

        <footer className="runFooter">
          {operationLocked ? <span className="runFooter__locked">操作をロック中 · 解除するには右上を2秒長押し</span> : unlockedActions}
        </footer>
      </div>
    </section>
  )
}

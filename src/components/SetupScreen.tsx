import { type KeyboardEvent, type PointerEvent } from 'react'
import { type TimerDraft } from '../lib/timerDraft'

interface SetupScreenProps {
  draft: TimerDraft
  errors: Partial<Record<keyof TimerDraft, string>>
  canStart: boolean
  audioEnabled: boolean
  error: string | null
  onDraftChange: (field: keyof TimerDraft, value: string) => void
  onAudioChange: (enabled: boolean) => void
  onLaunch: (pressedAt: number, pointerId?: number) => void
}

export function SetupScreen({ draft, errors, canStart, audioEnabled, error, onDraftChange, onAudioChange, onLaunch }: SetupScreenProps) {
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.isPrimary && event.button === 0 && canStart) {
      onLaunch(performance.now(), event.pointerId)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && canStart) {
      event.preventDefault()
      onLaunch(performance.now())
    }
  }

  return (
    <section className="setupScreen">
      <div className="setupPanel">
        <header className="setupHeader">
          <span className="eyebrow">LIQUID TIMER</span>
          <h1>水が満ちるまで、集中する。</h1>
          <p>時間を決めて、スタートを押すだけ。</p>
        </header>

        <div className="setupContent">
          <div className="setupSection">
            <div className="setupSection__heading"><span>01</span><h2>計測時間</h2></div>
            <div className="durationFields">
              <div className="field">
                <label htmlFor="minutes">分</label>
                <input id="minutes" type="text" inputMode="numeric" pattern="[0-9]*" value={draft.minutes} onChange={(event) => onDraftChange('minutes', event.target.value)} aria-invalid={Boolean(errors.minutes)} aria-describedby={errors.minutes ? 'minutes-error' : undefined} />
                {errors.minutes && <small id="minutes-error" className="fieldError">{errors.minutes}</small>}
              </div>
              <span className="durationSeparator">:</span>
              <div className="field">
                <label htmlFor="seconds">秒</label>
                <input id="seconds" type="text" inputMode="numeric" pattern="[0-9]*" value={draft.seconds} onChange={(event) => onDraftChange('seconds', event.target.value)} aria-invalid={Boolean(errors.seconds)} aria-describedby={errors.seconds ? 'seconds-error' : undefined} />
                {errors.seconds && <small id="seconds-error" className="fieldError">{errors.seconds}</small>}
              </div>
            </div>
          </div>

          <div className="setupSection">
            <div className="setupSection__heading"><span>02</span><h2>開始前のカウントダウン</h2></div>
            <div className="field field--lead">
              <label htmlFor="leadIn">準備する秒数</label>
              <div className="unitInput"><input id="leadIn" type="text" inputMode="numeric" pattern="[0-9]*" value={draft.leadIn} onChange={(event) => onDraftChange('leadIn', event.target.value)} aria-invalid={Boolean(errors.leadIn)} aria-describedby={errors.leadIn ? 'lead-error' : undefined} /><span>秒</span></div>
              {errors.leadIn && <small id="lead-error" className="fieldError">{errors.leadIn}</small>}
              <small className="fieldHint">0秒なら、すぐに計測を始めます。</small>
            </div>
          </div>

          <label className="soundToggle" htmlFor="audioEnabled">
            <span><strong>音の合図</strong><small>カウントダウンと終了を音で知らせます</small></span>
            <input id="audioEnabled" type="checkbox" checked={audioEnabled} onChange={(event) => onAudioChange(event.target.checked)} />
          </label>
        </div>

        <div className="setupActions">
          {error && <p className="startError" role="alert">{error}</p>}
          <button className="controlButton controlButton--primary startButton" type="button" disabled={!canStart} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onClick={(event) => { if (event.detail === 0 && canStart) onLaunch(performance.now()) }}>スタート<span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>
  )
}

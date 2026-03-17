import type { ChangeEvent, FormEvent } from 'react'
import {
  DEFAULT_WORKOUT,
  formatDurationLabel,
  getTotalWorkoutSeconds,
  normalizeWorkoutInput,
  type QuickWorkoutInput,
} from '../lib/timerSession'

interface SetupScreenProps {
  draft: QuickWorkoutInput
  onChange: (next: QuickWorkoutInput) => void
  onLaunch: () => void
}

function parsePositiveInteger(value: string, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(minimum, parsed)
}

export function SetupScreen({ draft, onChange, onLaunch }: SetupScreenProps) {
  const normalized = normalizeWorkoutInput(draft)
  const totalSeconds = getTotalWorkoutSeconds(normalized)
  const totalReps = normalized.rounds * normalized.repsPerRound

  const handleNumberChange =
    (
      field: keyof Pick<
        QuickWorkoutInput,
        'rounds' | 'repsPerRound' | 'intervalSec' | 'roundRestSec' | 'leadInSec'
      >,
      minimum: number,
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...draft,
        [field]: parsePositiveInteger(event.target.value, draft[field], minimum),
      })
    }

  const handleAudioToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...draft,
      audioEnabled: event.target.checked,
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLaunch()
  }

  return (
    <section className="setupScreen">
      <section className="glassPanel setupPanel">
        <form className="setupForm" onSubmit={handleSubmit}>
          <div className="setupForm__layout">
            <section className="setupForm__main">
              <header className="setupForm__header">
                <div className="setupCard__eyebrow">プールサイド共有タイマー</div>
                <h2>練習メニュー入力</h2>
                <p>横向きタブレットでそのまま操作しやすいサイズに整理しています。</p>
              </header>

              <div className="setupForm__stack">
                <div className="field">
                  <label htmlFor="repsPerRound">本数</label>
                  <input
                    id="repsPerRound"
                    name="repsPerRound"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={draft.repsPerRound}
                    onChange={handleNumberChange('repsPerRound', 1)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="rounds">セット数</label>
                  <input
                    id="rounds"
                    name="rounds"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={draft.rounds}
                    onChange={handleNumberChange('rounds', 1)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="intervalSec">サイクル秒数</label>
                  <input
                    id="intervalSec"
                    name="intervalSec"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={draft.intervalSec}
                    onChange={handleNumberChange('intervalSec', 1)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="roundRestSec">セット間秒数</label>
                  <input
                    id="roundRestSec"
                    name="roundRestSec"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.roundRestSec}
                    onChange={handleNumberChange('roundRestSec', 0)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="leadInSec">カウントダウン秒数</label>
                  <input
                    id="leadInSec"
                    name="leadInSec"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.leadInSec}
                    onChange={handleNumberChange('leadInSec', 0)}
                  />
                </div>

                <div className="toggleField">
                  <label htmlFor="audioEnabled">
                    <input
                      id="audioEnabled"
                      name="audioEnabled"
                      type="checkbox"
                      checked={draft.audioEnabled}
                      onChange={handleAudioToggle}
                    />
                    音の合図を有効化
                  </label>
                  <span className="field__hint">切り替え時と残り5秒で鳴ります</span>
                </div>
              </div>
            </section>

            <aside className="setupSummary">
              <div className="setupSummary__kicker">開始前の確認</div>
              <h3 className="setupSummary__title">{normalized.title}</h3>
              <p className="setupSummary__copy">
                8-9インチの横画面で、入力と開始操作を1画面で完結させる構成です。
              </p>

              <div className="setupSummary__metrics">
                <div className="metric">
                  <span className="metric__label">合計時間</span>
                  <span className="metric__value">{formatDurationLabel(totalSeconds)}</span>
                </div>
                <div className="metric">
                  <span className="metric__label">総本数</span>
                  <span className="metric__value">{totalReps}</span>
                </div>
                <div className="metric">
                  <span className="metric__label">セット数</span>
                  <span className="metric__value">{normalized.rounds}</span>
                </div>
              </div>

              <div className="setupSummary__note">
                プールサイドで置いたままでも押しやすいよう、開始ボタンを大きめにしています。
              </div>

              <div className="setupForm__actions setupForm__actions--stack">
                <button className="controlButton controlButton--primary" type="submit">
                  開始画面へ
                </button>
                <button
                  className="controlButton controlButton--secondary"
                  type="button"
                  onClick={() => onChange(DEFAULT_WORKOUT)}
                >
                  初期値に戻す
                </button>
              </div>
            </aside>
          </div>
        </form>
      </section>
    </section>
  )
}

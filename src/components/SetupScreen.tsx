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

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...draft,
      title: event.target.value,
    })
  }

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
      <div className="setupScreen__layout">
        <aside className="setupCard">
          <div className="setupCard__eyebrow">Liquid Timer v1</div>
          <h1 className="setupCard__title">Lane Tank</h1>
          <p className="setupCard__lead">
            競泳練習のサイクル管理を、遠くからでも読める大きなカウントダウンと液体の流れで見せる。
          </p>
          <div className="setupCard__ribbon">
            <span className="setupCard__ribbonDot" />
            プールサイド用の共有タイマー
          </div>
          <div className="setupCard__notes">
            <div className="setupNote">
              <strong>Lead-in</strong> は全体スタート前のカウント。
            </div>
            <div className="setupNote">
              <strong>Interval</strong> は次の出発までのサイクル秒数。
            </div>
            <div className="setupNote">
              <strong>Round Rest</strong> はラウンド間のまとまった休憩。
            </div>
          </div>
        </aside>

        <section className="glassPanel setupPanel">
          <header className="setupPanel__header">
            <div>
              <div className="setupCard__eyebrow">Quick Input</div>
              <h2>今日のセットをその場で作る</h2>
              <p>
                最小入力だけでメニューを組み、実行画面で開始・一時停止・戻る・スキップを操作できる。
              </p>
            </div>
          </header>

          <div className="setupPanel__summary">
            <div className="metric">
              <span className="metric__label">Total Time</span>
              <span className="metric__value">{formatDurationLabel(totalSeconds)}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Total Reps</span>
              <span className="metric__value">{totalReps}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Visual Mode</span>
              <span className="metric__value">Lane Tank</span>
            </div>
          </div>

          <form className="setupForm" onSubmit={handleSubmit}>
            <div className="setupForm__grid">
              <div className="field field--wide">
                <label htmlFor="title">練習名</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={draft.title}
                  onChange={handleTextChange}
                  placeholder="Main Set"
                />
              </div>

              <div className="field">
                <label htmlFor="rounds">ラウンド数</label>
                <input
                  id="rounds"
                  name="rounds"
                  type="number"
                  min={1}
                  value={draft.rounds}
                  onChange={handleNumberChange('rounds', 1)}
                />
              </div>

              <div className="field">
                <label htmlFor="repsPerRound">1ラウンドの本数</label>
                <input
                  id="repsPerRound"
                  name="repsPerRound"
                  type="number"
                  min={1}
                  value={draft.repsPerRound}
                  onChange={handleNumberChange('repsPerRound', 1)}
                />
              </div>

              <div className="field">
                <label htmlFor="intervalSec">サイクル秒数</label>
                <input
                  id="intervalSec"
                  name="intervalSec"
                  type="number"
                  min={1}
                  value={draft.intervalSec}
                  onChange={handleNumberChange('intervalSec', 1)}
                />
                <span className="field__hint">次のスタートまでの秒数</span>
              </div>

              <div className="field">
                <label htmlFor="roundRestSec">ラウンド間休憩</label>
                <input
                  id="roundRestSec"
                  name="roundRestSec"
                  type="number"
                  min={0}
                  value={draft.roundRestSec}
                  onChange={handleNumberChange('roundRestSec', 0)}
                />
                <span className="field__hint">0秒ならそのまま次ラウンド</span>
              </div>

              <div className="field">
                <label htmlFor="leadInSec">Lead-in 秒数</label>
                <input
                  id="leadInSec"
                  name="leadInSec"
                  type="number"
                  min={0}
                  value={draft.leadInSec}
                  onChange={handleNumberChange('leadInSec', 0)}
                />
                <span className="field__hint">開始前の合図用</span>
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
                <span className="field__hint">切り替え時と残り5秒</span>
              </div>
            </div>

            <div className="setupForm__actions">
              <button className="controlButton controlButton--primary" type="submit">
                実行画面へ
              </button>
              <button
                className="controlButton controlButton--secondary"
                type="button"
                onClick={() => onChange(DEFAULT_WORKOUT)}
              >
                初期値に戻す
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}

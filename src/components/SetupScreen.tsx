import { useState, type ChangeEvent, type FocusEvent, type FormEvent } from 'react'
import { type PresetStore, type WorkoutPreset } from '../lib/presetStore'
import {
  DEFAULT_WORKOUT,
  formatDurationLabel,
  getTotalWorkoutSeconds,
  normalizeWorkoutInput,
} from '../lib/timerSession'

interface SetupScreenProps {
  presetStore: PresetStore
  onLaunch: () => void
}

type NumericFieldKey =
  | 'rounds'
  | 'repsPerRound'
  | 'intervalSec'
  | 'roundRestSec'
  | 'leadInSec'

function parsePositiveInteger(value: string, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(minimum, parsed)
}

function formatPresetSummary(preset: WorkoutPreset) {
  return `${preset.workout.repsPerRound}本 / ${preset.workout.rounds}セット / ${preset.workout.intervalSec}秒`
}

export function SetupScreen({ presetStore, onLaunch }: SetupScreenProps) {
  const presets = presetStore.list()
  const selectedPreset = presetStore.selectedPreset
  const normalized = normalizeWorkoutInput(selectedPreset.workout)
  const totalSeconds = getTotalWorkoutSeconds(normalized)
  const totalReps = normalized.rounds * normalized.repsPerRound
  const [editingNumberField, setEditingNumberField] = useState<{
    field: NumericFieldKey
    value: string
  } | null>(null)

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    presetStore.update(selectedPreset.id, {
      name: event.target.value,
    })
  }

  const handleNumberChange =
    (field: NumericFieldKey, minimum: number) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value

      setEditingNumberField({
        field,
        value: nextValue,
      })

      if (nextValue === '') {
        return
      }

      const parsed = Number.parseInt(nextValue, 10)
      if (Number.isNaN(parsed)) {
        return
      }

      presetStore.update(selectedPreset.id, {
        workout: {
          ...selectedPreset.workout,
          [field]: Math.max(minimum, parsed),
        },
      })
    }

  const handleNumberBlur =
    (field: NumericFieldKey, minimum: number) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const committedValue = parsePositiveInteger(
        event.target.value,
        normalized[field],
        minimum,
      )

      setEditingNumberField(null)

      presetStore.update(selectedPreset.id, {
        workout: {
          ...selectedPreset.workout,
          [field]: committedValue,
        },
      })
    }

  const handleNumberFocus = (field: NumericFieldKey) => () => {
    setEditingNumberField({
      field,
      value: normalized[field].toString(),
    })
  }

  const getNumberInputValue = (field: NumericFieldKey) =>
    editingNumberField?.field === field
      ? editingNumberField.value
      : normalized[field].toString()

  const handleAudioToggle = (event: ChangeEvent<HTMLInputElement>) => {
    presetStore.update(selectedPreset.id, {
      workout: {
        ...selectedPreset.workout,
        audioEnabled: event.target.checked,
      },
    })
  }

  const handleResetPreset = () => {
    presetStore.update(selectedPreset.id, {
      workout: {
        ...DEFAULT_WORKOUT,
        title: selectedPreset.name,
      },
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLaunch()
  }

  return (
    <section className="setupScreen">
      <section className="glassPanel setupPanel">
        <div className="setupWorkspace">
          <aside className="presetSidebar">
            <div className="presetSidebar__header">
              <div>
                <div className="setupCard__eyebrow">この端末に保存</div>
                <h2 className="presetSidebar__title">保存済みセット</h2>
              </div>
              <span className="presetSidebar__count">{presets.length}件</span>
            </div>

            <div className="presetSidebar__actions">
              <button
                className="controlButton controlButton--primary"
                type="button"
                onClick={presetStore.create}
              >
                新規作成
              </button>
              <button
                className="controlButton controlButton--secondary"
                type="button"
                onClick={() => presetStore.duplicate(selectedPreset.id)}
              >
                複製
              </button>
              <button
                className="controlButton controlButton--danger"
                type="button"
                onClick={() => presetStore.delete(selectedPreset.id)}
              >
                削除
              </button>
            </div>

            <div className="presetSidebar__list">
              {presets.map((preset) => {
                const isSelected = preset.id === presetStore.getSelectedPresetId()

                return (
                  <button
                    key={preset.id}
                    className={`presetCard${isSelected ? ' presetCard--selected' : ''}`}
                    type="button"
                    onClick={() => presetStore.setSelectedPresetId(preset.id)}
                  >
                    <span className="presetCard__name">{preset.name}</span>
                    <span className="presetCard__summary">{formatPresetSummary(preset)}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <form className="setupForm" onSubmit={handleSubmit}>
            <div className="setupForm__layout">
              <section className="setupForm__main">
                <header className="setupForm__header">
                  <div className="setupCard__eyebrow">選択中のセット</div>
                  <h2>メニュー編集</h2>
                  <p>変更内容はこの端末に自動保存されます。</p>
                </header>

                <div className="field field--name">
                  <label htmlFor="presetName">セット名</label>
                  <input
                    id="presetName"
                    name="presetName"
                    type="text"
                    value={selectedPreset.name}
                    onChange={handleNameChange}
                    placeholder="メインセット"
                  />
                </div>

                <div className="setupForm__stack">
                  <div className="field">
                    <label htmlFor="repsPerRound">本数</label>
                    <input
                      id="repsPerRound"
                      name="repsPerRound"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={getNumberInputValue('repsPerRound')}
                      onFocus={handleNumberFocus('repsPerRound')}
                      onChange={handleNumberChange('repsPerRound', 1)}
                      onBlur={handleNumberBlur('repsPerRound', 1)}
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
                      value={getNumberInputValue('rounds')}
                      onFocus={handleNumberFocus('rounds')}
                      onChange={handleNumberChange('rounds', 1)}
                      onBlur={handleNumberBlur('rounds', 1)}
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
                      value={getNumberInputValue('intervalSec')}
                      onFocus={handleNumberFocus('intervalSec')}
                      onChange={handleNumberChange('intervalSec', 1)}
                      onBlur={handleNumberBlur('intervalSec', 1)}
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
                      value={getNumberInputValue('roundRestSec')}
                      onFocus={handleNumberFocus('roundRestSec')}
                      onChange={handleNumberChange('roundRestSec', 0)}
                      onBlur={handleNumberBlur('roundRestSec', 0)}
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
                      value={getNumberInputValue('leadInSec')}
                      onFocus={handleNumberFocus('leadInSec')}
                      onChange={handleNumberChange('leadInSec', 0)}
                      onBlur={handleNumberBlur('leadInSec', 0)}
                    />
                  </div>

                  <div className="toggleField">
                    <label htmlFor="audioEnabled">
                      <input
                        id="audioEnabled"
                        name="audioEnabled"
                        type="checkbox"
                        checked={normalized.audioEnabled}
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
                <h3 className="setupSummary__title">{selectedPreset.name}</h3>
                <p className="setupSummary__copy">
                  この端末だけに保存されます。別のタブレットには自動共有されません。
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

                <div className="setupForm__actions setupForm__actions--stack">
                  <button className="controlButton controlButton--primary" type="submit">
                    開始
                  </button>
                  <button
                    className="controlButton controlButton--secondary"
                    type="button"
                    onClick={handleResetPreset}
                  >
                    このセットを初期値に戻す
                  </button>
                </div>
              </aside>
            </div>
          </form>
        </div>
      </section>
    </section>
  )
}

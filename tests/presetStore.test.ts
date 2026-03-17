import { describe, expect, it } from 'vitest'
import {
  createDefaultStoredPresetState,
  createPresetInState,
  deletePresetInState,
  duplicatePresetInState,
  getSelectedPreset,
  loadStoredPresetState,
  saveStoredPresetState,
  setSelectedPresetIdInState,
  updatePresetInState,
  type StoredPresetState,
} from '../src/lib/presetStore'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const bucket = new Map(Object.entries(initial))

  return {
    getItem(key: string) {
      return bucket.get(key) ?? null
    },
    setItem(key: string, value: string) {
      bucket.set(key, value)
    },
  }
}

function getSelectedId(state: StoredPresetState) {
  return getSelectedPreset(state).id
}

describe('presetStore', () => {
  it('creates a default preset when storage is empty', () => {
    const storage = createMemoryStorage()

    const state = loadStoredPresetState(storage)

    expect(state.presets).toHaveLength(1)
    expect(state.selectedPresetId).toBe(state.presets[0].id)
    expect(state.presets[0].name).toBe('メインセット')
    expect(state.presets[0].workout.title).toBe('メインセット')
  })

  it('recovers when storage JSON is corrupted', () => {
    const storage = createMemoryStorage({
      'liquid-timer.presets.v1': '{broken-json',
    })

    const state = loadStoredPresetState(storage)

    expect(state.presets).toHaveLength(1)
    expect(state.selectedPresetId).toBe(state.presets[0].id)
  })

  it('saves and reloads presets from local storage', () => {
    const storage = createMemoryStorage()
    const original = createDefaultStoredPresetState(100)
    const updated = updatePresetInState(
      original,
      original.selectedPresetId,
      {
        name: '朝練ショート',
        workout: {
          ...original.presets[0].workout,
          rounds: 3,
          repsPerRound: 8,
          intervalSec: 50,
        },
      },
      200,
    )

    saveStoredPresetState(storage, updated)
    const reloaded = loadStoredPresetState(storage)

    expect(reloaded.presets).toHaveLength(1)
    expect(reloaded.selectedPresetId).toBe(updated.selectedPresetId)
    expect(reloaded.presets[0].name).toBe('朝練ショート')
    expect(reloaded.presets[0].workout.rounds).toBe(3)
    expect(reloaded.presets[0].workout.repsPerRound).toBe(8)
    expect(reloaded.presets[0].workout.intervalSec).toBe(50)
  })

  it('updates preset name and keeps workout title in sync', () => {
    const state = createDefaultStoredPresetState(100)
    const updated = updatePresetInState(
      state,
      state.selectedPresetId,
      {
        name: 'メインセット A',
        workout: {
          ...state.presets[0].workout,
          title: 'ignored-title',
          roundRestSec: 30,
        },
      },
      300,
    )

    const selected = getSelectedPreset(updated)
    expect(selected.name).toBe('メインセット A')
    expect(selected.workout.title).toBe('メインセット A')
    expect(selected.workout.roundRestSec).toBe(30)
    expect(selected.updatedAt).toBe(300)
  })

  it('creates, duplicates, and selects the new preset', () => {
    const initial = createDefaultStoredPresetState(100)
    const created = createPresetInState(initial, 150)
    const createdPreset = getSelectedPreset(created)
    expect(created.presets).toHaveLength(2)
    expect(createdPreset.name).toBe('新しいセット')

    const duplicated = duplicatePresetInState(created, created.selectedPresetId, 180)
    const duplicatedPreset = getSelectedPreset(duplicated)
    expect(duplicated.presets).toHaveLength(3)
    expect(duplicatedPreset.name).toBe('新しいセット（コピー）')
    expect(duplicatedPreset.workout.title).toBe('新しいセット（コピー）')
  })

  it('switches selected preset only when the target exists', () => {
    const initial = createDefaultStoredPresetState(100)
    const expanded = createPresetInState(initial, 150)
    const secondId = expanded.presets[1].id

    const selected = setSelectedPresetIdInState(expanded, secondId)
    expect(getSelectedId(selected)).toBe(secondId)

    const unchanged = setSelectedPresetIdInState(selected, 'missing-id')
    expect(getSelectedId(unchanged)).toBe(secondId)
  })

  it('deletes presets safely and regenerates a default when the last preset is removed', () => {
    const initial = createDefaultStoredPresetState(100)
    const withExtra = createPresetInState(initial, 150)
    const extraId = withExtra.selectedPresetId

    const afterDelete = deletePresetInState(withExtra, extraId, 200)
    expect(afterDelete.presets).toHaveLength(1)
    expect(afterDelete.selectedPresetId).toBe(initial.selectedPresetId)

    const regenerated = deletePresetInState(afterDelete, afterDelete.selectedPresetId, 250)
    expect(regenerated.presets).toHaveLength(1)
    expect(regenerated.presets[0].name).toBe('メインセット')
    expect(regenerated.selectedPresetId).toBe(regenerated.presets[0].id)
  })

  it('sanitizes unexpected stored data and falls back to the first valid preset', () => {
    const storage = createMemoryStorage({
      'liquid-timer.presets.v1': JSON.stringify({
        presets: [
          {
            id: 'valid-a',
            name: 'スプリント',
            workout: {
              title: 'ignored',
              rounds: 2,
              repsPerRound: 4,
              intervalSec: 55,
              roundRestSec: 20,
              leadInSec: 5,
              audioEnabled: false,
            },
          },
          {
            id: 'broken',
            name: 'invalid',
            workout: null,
          },
        ],
        selectedPresetId: 'missing-id',
      }),
    })

    const state = loadStoredPresetState(storage)

    expect(state.presets).toHaveLength(1)
    expect(state.selectedPresetId).toBe('valid-a')
    expect(state.presets[0].name).toBe('スプリント')
    expect(state.presets[0].workout.title).toBe('スプリント')
  })
})

import { useCallback, useMemo, useState } from 'react'
import {
  createPresetInState,
  deletePresetInState,
  duplicatePresetInState,
  getSelectedPreset,
  loadStoredPresetState,
  saveStoredPresetState,
  setSelectedPresetIdInState,
  updatePresetInState,
  type PresetStore,
  type StoredPresetState,
} from '../lib/presetStore'

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function usePresetStore(): PresetStore {
  const storage = getBrowserStorage()
  const [state, setState] = useState<StoredPresetState>(() => loadStoredPresetState(storage))

  const commit = useCallback(
    (updater: (current: StoredPresetState) => StoredPresetState) => {
      setState((current) => {
        const next = updater(current)
        saveStoredPresetState(storage, next)
        return next
      })
    },
    [storage],
  )

  const create = useCallback(() => {
    commit((current) => createPresetInState(current))
  }, [commit])

  const update = useCallback<PresetStore['update']>(
    (id, changes) => {
      commit((current) => updatePresetInState(current, id, changes))
    },
    [commit],
  )

  const duplicate = useCallback((id: string) => {
    commit((current) => duplicatePresetInState(current, id))
  }, [commit])

  const remove = useCallback((id: string) => {
    commit((current) => deletePresetInState(current, id))
  }, [commit])

  const setSelectedPresetId = useCallback((id: string) => {
    commit((current) => setSelectedPresetIdInState(current, id))
  }, [commit])

  const selectedPreset = useMemo(() => getSelectedPreset(state), [state])

  return {
    presets: state.presets,
    selectedPreset,
    list: () => state.presets,
    create,
    update,
    delete: remove,
    duplicate,
    getSelectedPresetId: () => state.selectedPresetId,
    setSelectedPresetId,
  }
}

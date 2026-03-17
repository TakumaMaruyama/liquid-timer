import { DEFAULT_WORKOUT, normalizeWorkoutInput, type QuickWorkoutInput } from './timerSession'

const PRESET_STORAGE_KEY = 'liquid-timer.presets.v1'

export interface WorkoutPreset {
  id: string
  name: string
  workout: QuickWorkoutInput
  createdAt: number
  updatedAt: number
}

export interface StoredPresetState {
  presets: WorkoutPreset[]
  selectedPresetId: string
}

export interface PresetStore {
  presets: WorkoutPreset[]
  selectedPreset: WorkoutPreset
  list: () => WorkoutPreset[]
  create: () => void
  update: (
    id: string,
    changes: {
      name?: string
      workout?: QuickWorkoutInput
    },
  ) => void
  delete: (id: string) => void
  duplicate: (id: string) => void
  getSelectedPresetId: () => string
  setSelectedPresetId: (id: string) => void
}

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface PresetCandidate {
  id?: unknown
  name?: unknown
  workout?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

interface StoredStateCandidate {
  presets?: unknown
  selectedPresetId?: unknown
}

export function createDefaultPreset(now = Date.now(), name = 'メインセット'): WorkoutPreset {
  return {
    id: createPresetId(),
    name,
    workout: {
      ...normalizeWorkoutInput(DEFAULT_WORKOUT),
      title: name,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultStoredPresetState(now = Date.now()): StoredPresetState {
  const preset = createDefaultPreset(now)
  return {
    presets: [preset],
    selectedPresetId: preset.id,
  }
}

export function loadStoredPresetState(storage: StorageLike | null): StoredPresetState {
  if (!storage) {
    return createDefaultStoredPresetState()
  }

  try {
    const raw = storage.getItem(PRESET_STORAGE_KEY)
    if (!raw) {
      return createDefaultStoredPresetState()
    }

    const parsed = JSON.parse(raw) as StoredStateCandidate
    return sanitizeStoredPresetState(parsed)
  } catch {
    return createDefaultStoredPresetState()
  }
}

export function saveStoredPresetState(
  storage: StorageLike | null,
  state: StoredPresetState,
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable or quota exceeded; keep app usable in-memory.
  }
}

export function createPresetInState(
  state: StoredPresetState,
  now = Date.now(),
): StoredPresetState {
  const preset = createDefaultPreset(
    now,
    getUniquePresetName(state.presets, '新しいセット'),
  )

  return {
    presets: [...state.presets, preset],
    selectedPresetId: preset.id,
  }
}

export function updatePresetInState(
  state: StoredPresetState,
  id: string,
  changes: {
    name?: string
    workout?: QuickWorkoutInput
  },
  now = Date.now(),
): StoredPresetState {
  const nextPresets = state.presets.map((preset) => {
    if (preset.id !== id) {
      return preset
    }

    const nextName = normalizePresetName(changes.name ?? preset.name)
    const nextWorkout = normalizeWorkoutInput(changes.workout ?? preset.workout)

    return {
      ...preset,
      name: nextName,
      workout: {
        ...nextWorkout,
        title: nextName,
      },
      updatedAt: now,
    }
  })

  return sanitizeStoredPresetState({
    presets: nextPresets,
    selectedPresetId: state.selectedPresetId,
  })
}

export function duplicatePresetInState(
  state: StoredPresetState,
  id: string,
  now = Date.now(),
): StoredPresetState {
  const source = state.presets.find((preset) => preset.id === id)
  if (!source) {
    return state
  }

  const name = getUniquePresetName(state.presets, `${source.name}（コピー）`)
  const duplicate: WorkoutPreset = {
    id: createPresetId(),
    name,
    workout: {
      ...normalizeWorkoutInput(source.workout),
      title: name,
    },
    createdAt: now,
    updatedAt: now,
  }

  return {
    presets: [...state.presets, duplicate],
    selectedPresetId: duplicate.id,
  }
}

export function deletePresetInState(
  state: StoredPresetState,
  id: string,
  now = Date.now(),
): StoredPresetState {
  const deletingIndex = state.presets.findIndex((preset) => preset.id === id)
  if (deletingIndex === -1) {
    return state
  }

  const nextPresets = state.presets.filter((preset) => preset.id !== id)

  if (nextPresets.length === 0) {
    return createDefaultStoredPresetState(now)
  }

  const fallbackIndex = Math.max(0, deletingIndex - 1)
  const fallbackPreset = nextPresets[fallbackIndex] ?? nextPresets[0]

  return {
    presets: nextPresets,
    selectedPresetId:
      state.selectedPresetId === id ? fallbackPreset.id : state.selectedPresetId,
  }
}

export function setSelectedPresetIdInState(
  state: StoredPresetState,
  id: string,
): StoredPresetState {
  if (!state.presets.some((preset) => preset.id === id)) {
    return state
  }

  return {
    ...state,
    selectedPresetId: id,
  }
}

export function getSelectedPreset(state: StoredPresetState): WorkoutPreset {
  return (
    state.presets.find((preset) => preset.id === state.selectedPresetId) ??
    state.presets[0] ??
    createDefaultPreset()
  )
}

function sanitizeStoredPresetState(candidate: StoredStateCandidate): StoredPresetState {
  const now = Date.now()
  const rawPresets = Array.isArray(candidate.presets) ? candidate.presets : []
  const presets = rawPresets
    .map((preset, index) => sanitizePreset(preset as PresetCandidate, index, now))
    .filter((preset): preset is WorkoutPreset => preset !== null)

  if (presets.length === 0) {
    return createDefaultStoredPresetState(now)
  }

  const selectedPresetId =
    typeof candidate.selectedPresetId === 'string' &&
    presets.some((preset) => preset.id === candidate.selectedPresetId)
      ? candidate.selectedPresetId
      : presets[0].id

  return {
    presets,
    selectedPresetId,
  }
}

function sanitizePreset(
  candidate: PresetCandidate,
  index: number,
  fallbackTime: number,
): WorkoutPreset | null {
  const rawWorkout =
    typeof candidate.workout === 'object' && candidate.workout !== null
      ? (candidate.workout as Partial<QuickWorkoutInput>)
      : null

  if (!rawWorkout) {
    return null
  }

  const name = normalizePresetName(
    typeof candidate.name === 'string'
      ? candidate.name
      : typeof rawWorkout.title === 'string'
        ? rawWorkout.title
        : `メインセット ${index + 1}`,
  )

  const workout = normalizeWorkoutInput({
    title: name,
    rounds: typeof rawWorkout.rounds === 'number' ? rawWorkout.rounds : DEFAULT_WORKOUT.rounds,
    repsPerRound:
      typeof rawWorkout.repsPerRound === 'number'
        ? rawWorkout.repsPerRound
        : DEFAULT_WORKOUT.repsPerRound,
    intervalSec:
      typeof rawWorkout.intervalSec === 'number'
        ? rawWorkout.intervalSec
        : DEFAULT_WORKOUT.intervalSec,
    roundRestSec:
      typeof rawWorkout.roundRestSec === 'number'
        ? rawWorkout.roundRestSec
        : DEFAULT_WORKOUT.roundRestSec,
    leadInSec:
      typeof rawWorkout.leadInSec === 'number'
        ? rawWorkout.leadInSec
        : DEFAULT_WORKOUT.leadInSec,
    audioEnabled:
      typeof rawWorkout.audioEnabled === 'boolean'
        ? rawWorkout.audioEnabled
        : DEFAULT_WORKOUT.audioEnabled,
  })

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.length > 0
        ? candidate.id
        : createPresetId(),
    name,
    workout: {
      ...workout,
      title: name,
    },
    createdAt:
      typeof candidate.createdAt === 'number' ? candidate.createdAt : fallbackTime,
    updatedAt:
      typeof candidate.updatedAt === 'number' ? candidate.updatedAt : fallbackTime,
  }
}

function normalizePresetName(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : 'メインセット'
}

function getUniquePresetName(presets: WorkoutPreset[], baseName: string) {
  const normalizedBase = normalizePresetName(baseName)
  if (!presets.some((preset) => preset.name === normalizedBase)) {
    return normalizedBase
  }

  let suffix = 2
  while (presets.some((preset) => preset.name === `${normalizedBase} ${suffix}`)) {
    suffix += 1
  }

  return `${normalizedBase} ${suffix}`
}

function createPresetId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `preset-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

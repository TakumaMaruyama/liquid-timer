export interface TimerDraft {
  minutes: string
  seconds: string
  leadIn: string
}

export interface ValidTimerDraft {
  intervalSec: number
  leadInSec: number
}

export function draftFromSeconds(intervalSec: number, leadInSec: number): TimerDraft {
  return {
    minutes: String(Math.floor(intervalSec / 60)),
    seconds: String(intervalSec % 60),
    leadIn: String(leadInSec),
  }
}

export function validateTimerDraft(draft: TimerDraft): {
  value: ValidTimerDraft | null
  errors: Partial<Record<keyof TimerDraft, string>>
} {
  const errors: Partial<Record<keyof TimerDraft, string>> = {}
  const integer = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value))

  if (draft.minutes !== '' && !integer(draft.minutes)) {
    errors.minutes = '分は0以上の整数で入力してください'
  }
  if (draft.seconds !== '' && (!integer(draft.seconds) || Number(draft.seconds) > 59)) {
    errors.seconds = '秒は0〜59の整数で入力してください'
  }
  if (draft.minutes === '' && draft.seconds === '') {
    errors.minutes = '分か秒を入力してください'
    errors.seconds = '分か秒を入力してください'
  }
  if (!integer(draft.leadIn)) {
    errors.leadIn = '準備時間は0以上の整数で入力してください'
  }

  const intervalSec = Number(draft.minutes || 0) * 60 + Number(draft.seconds || 0)
  if (!errors.minutes && !errors.seconds && (!Number.isSafeInteger(intervalSec) || intervalSec < 1)) {
    errors.minutes = '計測時間は1秒以上にしてください'
    errors.seconds = '計測時間は1秒以上にしてください'
  }

  return {
    value: Object.keys(errors).length === 0
      ? { intervalSec, leadInSec: Number(draft.leadIn) }
      : null,
    errors,
  }
}

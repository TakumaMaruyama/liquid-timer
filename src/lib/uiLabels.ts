import type { TimerPhase } from './timerSession'

export type TankBadgeKind = 'lead' | 'active' | 'done' | 'queued'

export function getJapanesePhaseLabel(phase: TimerPhase) {
  switch (phase) {
    case 'idle':
      return '待機'
    case 'lead_in':
      return 'カウントダウン'
    case 'interval':
      return 'サイクル'
    case 'round_rest':
      return 'セット間'
    case 'paused':
      return '一時停止'
    case 'complete':
      return '終了'
  }
}

export function getJapanesePhaseHeadline(phase: TimerPhase) {
  switch (phase) {
    case 'idle':
      return '開始準備完了'
    case 'lead_in':
      return 'スタートまで'
    case 'interval':
      return '次のスタートまで'
    case 'round_rest':
      return '次のセットまで'
    case 'paused':
      return '一時停止中'
    case 'complete':
      return 'メニュー終了'
  }
}

export function getTankBadgeLabel(kind: TankBadgeKind, compact: boolean) {
  if (compact) {
    switch (kind) {
      case 'lead':
        return '予'
      case 'active':
        return '進'
      case 'done':
        return '済'
      case 'queued':
        return '待'
    }
  }

  switch (kind) {
    case 'lead':
      return '予告'
    case 'active':
      return '進行'
    case 'done':
      return '完了'
    case 'queued':
      return '待機'
  }
}

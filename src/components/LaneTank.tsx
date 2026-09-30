import { type CSSProperties } from 'react'
import { getWaterFill, type WorkoutSession } from '../lib/timerSession'

interface LaneTankProps {
  session: WorkoutSession
}

export function LaneTank({ session }: LaneTankProps) {
  const fill = getWaterFill(session)
  const style = { ['--fill' as string]: (fill * 100).toFixed(2) + '%' } as CSSProperties

  return (
    <div
      className={'waterTank' + (session.phase === 'paused' ? ' waterTank--paused' : '') + (fill === 0 ? ' waterTank--empty' : '')}
      role="img"
      aria-label={'水位 ' + Math.round(fill * 100) + 'パーセント'}
      style={style}
    >
      <div className="waterTank__water" />
      <div className="waterTank__shine" />
      <div className="waterTank__marks" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
    </div>
  )
}

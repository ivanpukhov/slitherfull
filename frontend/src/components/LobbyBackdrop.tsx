import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { SKINS } from '../hooks/useGame'
import { SnakePreview } from './SnakePreview'

interface LobbyBackdropProps {
  visible: boolean
}

interface LobbySnakeConfig {
  id: string
  position: 'left' | 'right'
  align: 'top' | 'bottom'
  colors: string[]
  length: number
  width: number
  height: number
  delay: number
  drift: number
  float: number
}

export function LobbyBackdrop({ visible }: LobbyBackdropProps) {
  const snakes = useMemo<LobbySnakeConfig[]>(
    () => [
      {
        id: 'lobby-left-primary',
        position: 'left',
        align: 'top',
        colors: SKINS.amber,
        length: 260,
        width: 420,
        height: 220,
        delay: 0,
        drift: 18,
        float: 22
      },
      {
        id: 'lobby-left-secondary',
        position: 'left',
        align: 'bottom',
        colors: SKINS.default,
        length: 220,
        width: 360,
        height: 200,
        delay: 3.2,
        drift: -14,
        float: 18
      },
      {
        id: 'lobby-right-primary',
        position: 'right',
        align: 'top',
        colors: SKINS.crimson,
        length: 300,
        width: 440,
        height: 230,
        delay: 1.4,
        drift: 22,
        float: 26
      },
      {
        id: 'lobby-right-secondary',
        position: 'right',
        align: 'bottom',
        colors: SKINS.violet,
        length: 240,
        width: 360,
        height: 210,
        delay: 4.6,
        drift: -18,
        float: 20
      }
    ],
    []
  )

  if (!visible) {
    return null
  }

  return (
    <div className="lobby-backdrop" aria-hidden="true">
      {snakes.map((config) => (
        <LobbySnake key={config.id} config={config} />
      ))}
    </div>
  )
}

function LobbySnake({ config }: { config: LobbySnakeConfig }) {
  const duration = 18 + Math.abs(config.drift)
  const wrapperStyle = {
    animationDelay: `${config.delay}s`,
    '--lobby-drift': `${config.drift}px`,
    '--lobby-float': `${config.float}px`,
    '--lobby-duration': `${duration}s`
  } as CSSProperties

  const canvasStyle = {
    animationDelay: `${config.delay}s`
  } as CSSProperties

  const figureStyle = {
    animationDelay: `${config.delay * 0.75}s`
  } as CSSProperties

  return (
    <div
      className={`lobby-backdrop__snake lobby-backdrop__snake--${config.position} lobby-backdrop__snake--${config.align}`}
      style={wrapperStyle}
    >
      <div className="lobby-backdrop__snake-canvas" style={canvasStyle}>
        <div className="lobby-backdrop__snake-figure" style={figureStyle}>
          <SnakePreview
            colors={config.colors}
            length={config.length}
            width={config.width}
            height={config.height}
          />
        </div>
      </div>
    </div>
  )
}

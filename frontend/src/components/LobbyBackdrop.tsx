import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
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
  trajectory: {
    originX: number
    originY: number
    amplitudeX: number
    amplitudeY: number
    diagonalScale: number
    diagonalTilt: number
    diagonalSkew: number
    speed: number
    phase: number
    bobAmplitude: number
    bobSpeed: number
    rotationAmplitude: number
    rotationSpeed: number
    scaleAmplitude: number
  }
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
        trajectory: {
          originX: -380,
          originY: -160,
          amplitudeX: 240,
          amplitudeY: 190,
          diagonalScale: 110,
          diagonalTilt: 0.35,
          diagonalSkew: 1.35,
          speed: 0.22,
          phase: 0,
          bobAmplitude: 14,
          bobSpeed: 1.6,
          rotationAmplitude: 4.5,
          rotationSpeed: 0.65,
          scaleAmplitude: 0.035
        }
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
        trajectory: {
          originX: -340,
          originY: 210,
          amplitudeX: 210,
          amplitudeY: 180,
          diagonalScale: 95,
          diagonalTilt: -0.4,
          diagonalSkew: 1.15,
          speed: 0.18,
          phase: 1.1,
          bobAmplitude: 16,
          bobSpeed: 1.4,
          rotationAmplitude: 3.5,
          rotationSpeed: 0.55,
          scaleAmplitude: 0.03
        }
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
        trajectory: {
          originX: 360,
          originY: -150,
          amplitudeX: 260,
          amplitudeY: 210,
          diagonalScale: 130,
          diagonalTilt: -0.45,
          diagonalSkew: 1.4,
          speed: 0.24,
          phase: 0.65,
          bobAmplitude: 18,
          bobSpeed: 1.5,
          rotationAmplitude: 5,
          rotationSpeed: 0.7,
          scaleAmplitude: 0.04
        }
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
        trajectory: {
          originX: 330,
          originY: 220,
          amplitudeX: 220,
          amplitudeY: 200,
          diagonalScale: 120,
          diagonalTilt: 0.42,
          diagonalSkew: 1.25,
          speed: 0.2,
          phase: 1.9,
          bobAmplitude: 17,
          bobSpeed: 1.3,
          rotationAmplitude: 4,
          rotationSpeed: 0.6,
          scaleAmplitude: 0.032
        }
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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<HTMLDivElement>(null)

  const wrapperStyle = {
    '--lobby-x': `${config.trajectory.originX}px`,
    '--lobby-y': `${config.trajectory.originY}px`
  } as CSSProperties

  useEffect(() => {
    const wrapperEl = wrapperRef.current
    const figureEl = figureRef.current

    if (!wrapperEl || !figureEl) {
      return
    }

    let animationFrame = 0
    let startTime: number | null = null

    const { trajectory, delay } = config

    const applyFrame = (elapsedSeconds: number) => {
      const angle = elapsedSeconds * trajectory.speed + trajectory.phase
      const diagonalAngle = angle * trajectory.diagonalSkew
      const diagonalOffset = Math.sin(diagonalAngle) * trajectory.diagonalScale

      const x =
        trajectory.originX +
        Math.cos(angle) * trajectory.amplitudeX +
        diagonalOffset
      const y =
        trajectory.originY +
        Math.sin(angle) * trajectory.amplitudeY +
        diagonalOffset * trajectory.diagonalTilt

      wrapperEl.style.setProperty('--lobby-x', `${x}px`)
      wrapperEl.style.setProperty('--lobby-y', `${y}px`)

      const bob = Math.sin(angle * trajectory.bobSpeed) * trajectory.bobAmplitude
      const scale = 1 + Math.sin(angle * 0.7) * trajectory.scaleAmplitude
      const rotation = Math.sin(angle * trajectory.rotationSpeed) * trajectory.rotationAmplitude

      figureEl.style.transform = `translate3d(0, ${bob}px, 0) scale(${scale}) rotate(${rotation}deg)`
    }

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp
      }

      const elapsed = (timestamp - startTime) / 1000 - delay

      if (elapsed >= 0) {
        applyFrame(elapsed)
      }

      animationFrame = requestAnimationFrame(step)
    }

    applyFrame(0)
    animationFrame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [config])

  return (
    <div
      className={`lobby-backdrop__snake lobby-backdrop__snake--${config.position} lobby-backdrop__snake--${config.align}`}
      style={wrapperStyle}
      ref={wrapperRef}
    >
      <div className="lobby-backdrop__snake-canvas">
        <div className="lobby-backdrop__snake-figure" ref={figureRef}>
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

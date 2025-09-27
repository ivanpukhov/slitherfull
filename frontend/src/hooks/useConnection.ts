import { useCallback, useEffect, useRef, useState } from 'react'
import { sanitizeBetValue, safeParse } from '../utils/helpers'
import type { GameController } from './useGame'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

interface UseConnectionOptions {
  controller: GameController
  token?: string | null
  onAuthError?: () => void
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected'

export function useConnection({ controller, token, onAuthError }: UseConnectionOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')

  useEffect(() => {
    controller.setCashoutRequestHandler(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'cashout_request' }))
      }
      controller.setCashoutPending(true)
    })
    return () => {
      controller.setCashoutRequestHandler(null)
    }
  }, [controller])

  const closeConnection = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'client_exit')
      } catch (err) {
        // ignore
      }
      wsRef.current = null
    }
  }, [])

  useEffect(() => closeConnection, [closeConnection])

  const connect = useCallback(
      (name: string, skin: string, betAmount: number | null) => {
        if (!token) {
          return
        }
        closeConnection()
        controller.setNicknameVisible(false)
        controller.setPendingBet(betAmount)
        controller.setAlive(false)
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws
        setStatus('connecting')

        ws.onopen = () => {
          setStatus('connected')
          ws.send(JSON.stringify({ type: 'join', name, skin, token }))
        }

        ws.onclose = () => {
          setStatus('idle')
          controller.setAlive(false)
          controller.setCashoutPending(false)
        }

        ws.onmessage = (event) => {
          const message = safeParse<any>(event.data)
          if (!message) return
          if (message.type === 'welcome') {
            if (message.id) {
              const resolvedName = typeof message.name === 'string' ? message.name : name
              controller.setMe(message.id, resolvedName)
            }
            controller.setAlive(true)
            controller.setCashoutPending(false)
            controller.applyBalanceUpdate({
              balance: typeof message.balance === 'number' ? message.balance : controller.getAccount().balance,
              currentBet:
                  typeof message.currentBet === 'number' ? message.currentBet : controller.getAccount().currentBet,
              total:
                  typeof message.balance === 'number' && typeof message.currentBet === 'number'
                      ? message.balance + message.currentBet
                      : undefined,
              cashedOut: false
            })
            if (typeof message.width === 'number' && typeof message.height === 'number') {
              const radius = typeof message.radius === 'number' ? message.radius : Math.min(message.width, message.height) / 2
              controller.setWorld({
                width: message.width,
                height: message.height,
                radius,
                centerX: message.width / 2,
                centerY: message.height / 2
              })
            }
            if (typeof message.minLength === 'number') {
              controller.setLimits({ minLength: message.minLength, boostMinLength: message.minLength })
            }
            if (typeof message.baseLength === 'number') {
              controller.setLimits({ baseLength: message.baseLength })
            }
            controller.refreshBoostState(true)
            const pendingBet = controller.getPendingBet()
            if (pendingBet !== null && ws.readyState === WebSocket.OPEN) {
              const desired = sanitizeBetValue(pendingBet, controller.getAccount().balance)
              if (desired > 0) {
                ws.send(JSON.stringify({ type: 'set_bet', amount: desired }))
              }
              controller.setPendingBet(null)
            }
          }
          if (message.type === 'snapshot') {
            controller.state.lastSnapshotAt = performance.now()
            if (Array.isArray(message.leaderboard)) {
              controller.updateLeaderboard(message.leaderboard)
            }
            if (message.you && (typeof message.you.balance === 'number' || typeof message.you.currentBet === 'number')) {
              controller.applyBalanceUpdate({
                balance: message.you.balance,
                currentBet: message.you.currentBet,
                total: message.you.totalBalance
              })
            }
            controller.applySnapshot(message)
          }
          if (message.type === 'death') {
            controller.showDeath(message)
          }
          if (message.type === 'balance') {
            controller.applyBalanceUpdate(message)
          }
          if (message.type === 'cashout_confirmed') {
            controller.showCashout(message.balance)
          }
          if (message.type === 'error' && message.code === 'cashout_failed') {
            controller.setCashoutPending(false)
            controller.resetCashoutHold()
          }
          if (message.type === 'error' && (message.code === 'auth_required' || message.code === 'invalid_token')) {
            controller.setNicknameVisible(true)
            onAuthError?.()
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(4001, message.code)
            }
          }
          if (message.type === 'error' && message.code === 'insufficient_balance') {
            controller.setNicknameVisible(true)
          }
          if (message.type === 'error' && message.code === 'balance_persist_failed') {
            controller.setNicknameVisible(true)
            controller.applyBalanceUpdate({ balance: controller.getAccount().balance })
          }
        }
      },
      [closeConnection, controller, onAuthError, token]
  )

  const requestRespawn = useCallback((betAmount: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'set_bet', amount: betAmount }))
    ws.send(JSON.stringify({ type: 'respawn' }))
  }, [])

  const sendInput = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || !controller.state.alive) return
    const payload = controller.getInputPayload(performance.now())
    const message: Record<string, unknown> = { type: 'input', boost: payload.boost }
    if (typeof payload.angle === 'number') {
      message.angle = payload.angle
    }
    ws.send(JSON.stringify(message))
  }, [controller])

  useEffect(() => {
    if (status !== 'connected') return
    const interval = setInterval(sendInput, 30)
    return () => {
      clearInterval(interval)
    }
  }, [status, sendInput])

  return {
    status,
    startGame: connect,
    requestRespawn,
    closeConnection
  }
}

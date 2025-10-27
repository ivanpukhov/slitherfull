import { useCallback, useEffect, useRef, useState } from 'react'
import { sanitizeBetValue, safeParse } from '../utils/helpers'
import type { GameController } from './useGame'
import { translate } from './useTranslation'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
const PING_INTERVAL = 3500

interface UseConnectionOptions {
  controller: GameController
  token?: string | null
  onAuthError?: () => void
  onBalanceUpdate?: (balance: number) => void
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected'

export function useConnection({ controller, token, onAuthError, onBalanceUpdate }: UseConnectionOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPingSentRef = useRef<number | null>(null)

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
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    lastPingSentRef.current = null
    controller.resetNetworkLatency()
  }, [controller])

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
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
          }
          const sendPing = () => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
            const timestamp = Date.now()
            lastPingSentRef.current = timestamp
            wsRef.current.send(JSON.stringify({ type: 'ping', t: timestamp }))
          }
          sendPing()
          pingIntervalRef.current = setInterval(sendPing, PING_INTERVAL)
        }

        ws.onclose = () => {
          setStatus('idle')
          controller.setAlive(false)
          controller.setCashoutPending(false)
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
          }
          lastPingSentRef.current = null
          controller.resetNetworkLatency()
        }

        ws.onmessage = (event) => {
          const message = safeParse<any>(event.data)
          if (!message) return
          if (message.type === 'pong') {
            const sent = typeof message.t === 'number' ? message.t : lastPingSentRef.current
            if (typeof sent === 'number') {
              const latency = Date.now() - sent
              if (latency > 0) {
                controller.updateNetworkLatency(latency)
              }
            }
            return
          }
          if (message.type === 'welcome') {
            if (message.id) {
              const resolvedName = typeof message.name === 'string' ? message.name : name
              controller.setMe(message.id, resolvedName)
            }
            controller.setAlive(true)
            controller.setCashoutPending(false)
            const nextBalance =
              typeof message.balance === 'number'
                ? Math.max(0, Math.floor(message.balance))
                : Math.max(0, Math.floor(controller.getAccount().balance))
            const nextBet =
              typeof message.currentBet === 'number'
                ? Math.max(0, Math.floor(message.currentBet))
                : Math.max(0, Math.floor(controller.getAccount().currentBet))
            controller.applyBalanceUpdate({
              balance: nextBalance,
              currentBet: nextBet,
              total: nextBalance + nextBet,
              cashedOut: false
            })
            if (typeof message.balance === 'number') {
              onBalanceUpdate?.(nextBalance)
            }
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
                controller.setTransferState(true, translate('game.transfer.pendingMessage'))
                ws.send(JSON.stringify({ type: 'set_bet', amount: desired }))
              }
              controller.setPendingBet(null)
            }
          }
          if (message.type === 'snapshot') {
            controller.state.lastSnapshotAt = performance.now()
            if (message.you && (typeof message.you.balance === 'number' || typeof message.you.currentBet === 'number')) {
              controller.applyBalanceUpdate({
                balance: message.you.balance,
                currentBet: message.you.currentBet,
                total: message.you.totalBalance
              })
              if (typeof message.you.balance === 'number') {
                onBalanceUpdate?.(Math.max(0, Math.floor(message.you.balance)))
              }
            }
            if (controller.getUI().transfer.pending) {
              controller.setTransferState(false)
            }
            controller.applySnapshot(message)
          }
          if (message.type === 'death') {
            controller.showDeath(message)
          }
          if (message.type === 'balance') {
            controller.applyBalanceUpdate(message)
            if (typeof message.balance === 'number') {
              onBalanceUpdate?.(Math.max(0, Math.floor(message.balance)))
            }
            controller.setTransferState(false)
          }
          if (message.type === 'cashout_confirmed') {
            controller.showCashout(message.balance)
            if (typeof message.balance === 'number') {
              onBalanceUpdate?.(Math.max(0, Math.floor(message.balance)))
            }
            controller.setTransferState(false)
          }
          if (message.type === 'error' && message.code === 'cashout_failed') {
            controller.setCashoutPending(false)
            controller.resetCashoutHold()
            controller.setTransferState(false)
          }
          if (message.type === 'error' && (message.code === 'auth_required' || message.code === 'invalid_token')) {
            controller.setNicknameVisible(true)
            onAuthError?.()
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(4001, message.code)
            }
          }
          if (message.type === 'error' && message.code === 'already_connected') {
            controller.setNicknameVisible(true)
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(4003, message.code)
            }
          }
          if (message.type === 'error' && message.code === 'insufficient_balance') {
            controller.setNicknameVisible(true)
            controller.setTransferState(false)
          }
          if (message.type === 'error' && message.code === 'balance_persist_failed') {
            controller.setNicknameVisible(true)
            controller.applyBalanceUpdate({ balance: controller.getAccount().balance })
            controller.setTransferState(false)
          }
          if (message.type === 'error' && message.code === 'transfer_failed') {
            controller.setTransferState(false)
          }
        }
      },
      [closeConnection, controller, onAuthError, onBalanceUpdate, token]
  )

  const requestRespawn = useCallback((betAmount: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    controller.setTransferState(true, translate('game.transfer.pendingMessage'))
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

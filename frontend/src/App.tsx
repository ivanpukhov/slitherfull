import { useCallback, useRef } from 'react'
import { useGame } from './hooks/useGame'
import { useCanvas } from './hooks/useCanvas'
import { useConnection } from './hooks/useConnection'
import { useJoystick } from './hooks/useJoystick'
import { usePointerControls } from './hooks/usePointerControls'
import { sanitizeBetValue } from './utils/helpers'
import { ScorePanel } from './components/ScorePanel'
import { Leaderboard } from './components/Leaderboard'
import { Minimap } from './components/Minimap'
import { TouchControls } from './components/TouchControls'
import { CashoutControl } from './components/CashoutControl'
import { NicknameScreen } from './components/NicknameScreen'
import { DeathScreen } from './components/DeathScreen'
import { CashoutScreen } from './components/CashoutScreen'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
  const joystickHandleRef = useRef<HTMLDivElement>(null)
  const boostButtonRef = useRef<HTMLButtonElement>(null)
  const cashoutButtonRef = useRef<HTMLButtonElement>(null)
  const touchControlsRef = useRef<HTMLDivElement>(null)

  const game = useGame()
  const connection = useConnection({ controller: game.controller })

  useCanvas({ canvasRef, minimapRef, controller: game.controller })
  usePointerControls({ controller: game.controller, canvasRef })
  useJoystick({
    controller: game.controller,
    joystickRef,
    joystickHandleRef,
    boostButtonRef,
    cashoutButtonRef,
    touchControlsRef
  })

  const handleNicknameChange = useCallback((value: string) => {
    game.setNickname(value)
  }, [game])

  const handleBetChange = useCallback((value: string) => {
    game.setBetValue(value)
  }, [game])

  const handleBetBlur = useCallback(() => {
    const sanitized = sanitizeBetValue(game.betValue, game.account.balance)
    if (sanitized > 0) {
      game.setBetValue(String(sanitized))
    } else if (game.account.balance > 0) {
      game.setBetValue('1')
    } else {
      game.setBetValue('')
    }
  }, [game])

  const handleRetryBetChange = useCallback((value: string) => {
    game.setRetryBetValue(value)
  }, [game])

  const handleRetryBetBlur = useCallback(() => {
    const sanitized = sanitizeBetValue(game.retryBetValue, game.account.balance)
    if (sanitized > 0) {
      game.setRetryBetValue(String(sanitized))
    } else if (game.account.balance > 0) {
      game.setRetryBetValue('1')
    } else {
      game.setRetryBetValue('')
    }
  }, [game])

  const handleStart = useCallback(() => {
    const name = game.nickname.trim() || 'Anon'
    const balance = game.account.balance
    const betAmount = sanitizeBetValue(game.betValue, balance)
    if (betAmount > 0) {
      game.setBetValue(String(betAmount))
    } else if (balance > 0) {
      game.setBetValue('1')
    } else {
      game.setBetValue('')
    }
    connection.startGame(name, game.selectedSkin, betAmount > 0 ? betAmount : null)
  }, [connection, game])

  const handleRetry = useCallback(() => {
    const balance = game.account.balance
    if (balance <= 0) {
      window.location.reload()
      return
    }
    const betAmount = sanitizeBetValue(game.retryBetValue || balance, balance)
    if (betAmount <= 0) return
    connection.requestRespawn(betAmount)
    game.controller.setPendingBet(null)
    game.controller.hideDeath()
  }, [connection, game])

  const handleCashoutClose = useCallback(() => {
    connection.closeConnection()
    window.location.reload()
  }, [connection])

  return (
    <div>
      <canvas id="canvas" ref={canvasRef} />
      <ScorePanel score={game.score} scoreMeta={game.scoreMeta} account={game.account} />
      <Leaderboard entries={game.leaderboard} meName={game.controller.state.meName} />
      <Minimap ref={minimapRef} />
      <TouchControls
        enabled={game.touchControlsEnabled}
        joystickRef={joystickRef}
        joystickHandleRef={joystickHandleRef}
        boostButtonRef={boostButtonRef}
        ref={touchControlsRef}
      />
      <CashoutControl state={game.cashout} buttonRef={cashoutButtonRef} />
      <NicknameScreen
        visible={game.nicknameScreenVisible}
        nickname={game.nickname}
        onNicknameChange={handleNicknameChange}
        selectedSkin={game.selectedSkin}
        onSelectSkin={game.setSelectedSkin}
        skinName={game.skinName}
        betValue={game.betValue}
        onBetChange={handleBetChange}
        onBetBlur={handleBetBlur}
        balance={game.account.balance}
        onStart={handleStart}
      />
      <DeathScreen
        state={game.deathScreen}
        onBetChange={handleRetryBetChange}
        onBetBlur={handleRetryBetBlur}
        onRetry={handleRetry}
      />
      <CashoutScreen state={game.cashoutScreen} onClose={handleCashoutClose} />
    </div>
  )
}

export default App

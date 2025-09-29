import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useCanvas } from './hooks/useCanvas'
import { useConnection } from './hooks/useConnection'
import { useJoystick } from './hooks/useJoystick'
import { usePointerControls } from './hooks/usePointerControls'
import { sanitizeBetValue } from './utils/helpers'
import { useAuth } from './hooks/useAuth'
import { useWallet } from './hooks/useWallet'
import { useWinningsLeaderboard, type LeaderboardRange } from './hooks/useWinningsLeaderboard'
import { usePlayerStats } from './hooks/usePlayerStats'
import { ScorePanel } from './components/ScorePanel'
import { GameLeaderboard } from './components/Leaderboard'
import { CashoutControl } from './components/CashoutControl'
import { NicknameScreen } from './components/NicknameScreen'
import { AuthModal } from './components/AuthModal'
import { AdminDashboard } from './components/AdminDashboard'

function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cashoutButtonRef = useRef<HTMLButtonElement>(null)

  const game = useGame()
  const auth = useAuth()
  const wallet = useWallet({ token: auth.token })
  const winningsLeaderboard = useWinningsLeaderboard()
  const [leaderboardRange, setLeaderboardRange] = useState<LeaderboardRange>('24h')
  const playerStats = usePlayerStats({ token: auth.token, days: 30 })
  const refreshPlayerStats = playerStats.refresh
  const [withdrawPending, setWithdrawPending] = useState(false)
  const [withdrawStatus, setWithdrawStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const connection = useConnection({
    controller: game.controller,
    token: auth.token,
    onAuthError: auth.logout,
    onBalanceUpdate: auth.syncBalance
  })
  const controller = game.controller
  const { setNickname, setBetValue, setRetryBetValue, setNicknameVisible, clearLastResult } = game
  const winningsRangeEntries = useMemo(
    () => winningsLeaderboard.data?.leaderboards?.[leaderboardRange] ?? [],
    [leaderboardRange, winningsLeaderboard.data]
  )
  const topWinningsEntries = useMemo(() => winningsRangeEntries.slice(0, 5), [winningsRangeEntries])
  const winningsPriceHint = useMemo(() => {
    const priceUsd = winningsLeaderboard.data?.priceUsd ?? null
    if (!Number.isFinite(priceUsd || NaN)) return null
    return `1 SOL ≈ ${new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format((priceUsd as number) || 0)}`
  }, [winningsLeaderboard.data?.priceUsd])
  const accountStateSyncedRef = useRef(false)

  useCanvas({ canvasRef, controller: game.controller })
  usePointerControls({ controller: game.controller, canvasRef })
  useJoystick({ controller: game.controller, cashoutButtonRef })

  const normalizeBetInput = useCallback((value: string, maxBalanceValue: number) => {
    if (value === '') return ''
    const max = Math.max(0, Math.floor(maxBalanceValue || 0))
    if (max <= 0) return ''
    const parsed = Math.floor(Number(value))
    if (!Number.isFinite(parsed)) return ''
    if (parsed <= 0) return '0'
    return String(Math.min(parsed, max))
  }, [])

  const handleWithdraw = useCallback(
    async (destination: string) => {
      if (typeof wallet.withdrawAll !== 'function') {
        throw new Error('Функция вывода недоступна')
      }
      setWithdrawPending(true)
      setWithdrawStatus(null)
      try {
        const result = await wallet.withdrawAll(destination)
        setWithdrawStatus({
          type: 'success',
          message: result?.message ?? 'Баланс отправлен на указанный адрес.'
        })
        await wallet.refresh()
        refreshPlayerStats()
      } catch (error) {
        const message = (error as Error)?.message || 'Не удалось выполнить вывод'
        setWithdrawStatus({ type: 'error', message })
        throw error
      } finally {
        setWithdrawPending(false)
      }
    },
    [refreshPlayerStats, wallet]
  )

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user) {
      controller.setNicknameLock(true)
      const wasSynced = accountStateSyncedRef.current
      if (!wasSynced) {
        controller.setAccountState({
          balance: auth.user.balance,
          currentBet: 0,
          total: auth.user.balance,
          cashedOut: false
        })
        accountStateSyncedRef.current = true
      }
      const available = Math.max(0, Math.floor(auth.user.balance))
      if (game.nickname !== auth.user.nickname) {
        setNickname(auth.user.nickname)
      }
      if (available <= 0) {
        if (game.betValue !== '') setBetValue('')
        if (game.retryBetValue !== '') setRetryBetValue('')
      } else {
        const normalizedBet = normalizeBetInput(game.betValue, available)
        if (!game.betValue && !wasSynced) {
          setBetValue(String(Math.min(available, 1)))
        } else if (normalizedBet !== game.betValue) {
          setBetValue(normalizedBet)
        }
        const normalizedRetryBet = normalizeBetInput(game.retryBetValue, available)
        if (normalizedRetryBet !== game.retryBetValue) {
          setRetryBetValue(normalizedRetryBet)
        }
      }
      setAuthModalOpen(false)
    } else if (auth.status === 'unauthenticated') {
      accountStateSyncedRef.current = false
      controller.setNicknameLock(false)
      controller.setAccountState({ balance: 0, currentBet: 0, total: 0, cashedOut: false })
      if (game.nickname !== '') {
        setNickname('')
      }
      if (game.betValue !== '') {
        setBetValue('')
      }
      if (game.retryBetValue !== '') {
        setRetryBetValue('')
      }
    }
  }, [
    auth.status,
    auth.user,
    controller,
    game.betValue,
    game.nickname,
    game.retryBetValue,
    normalizeBetInput,
    setNickname,
    setBetValue,
    setRetryBetValue
  ])

  useEffect(() => {
    if (auth.status === 'checking') {
      setAuthModalOpen(false)
    }
  }, [auth.status])

  useEffect(() => {
    if (wallet.profile && auth.status === 'authenticated') {
      auth.syncBalance(wallet.profile.inGameBalance)
    }
  }, [wallet.profile, auth.status, auth.syncBalance])

  const handleNicknameChange = useCallback((value: string) => {
    game.setNickname(value)
  }, [game])

  const handleBetChange = useCallback((value: string) => {
    const normalized = normalizeBetInput(value, game.account.balance)
    game.setBetValue(normalized)
  }, [game, normalizeBetInput])

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
    const normalized = normalizeBetInput(value, game.account.balance)
    setRetryBetValue(normalized)
  }, [game, normalizeBetInput, setRetryBetValue])

  const handleRetryBetBlur = useCallback(() => {
    const sanitized = sanitizeBetValue(game.retryBetValue, game.account.balance)
    if (sanitized > 0) {
      setRetryBetValue(String(sanitized))
    } else if (game.account.balance > 0) {
      setRetryBetValue('1')
    } else {
      setRetryBetValue('')
    }
  }, [game, setRetryBetValue])

  const handleStart = useCallback(() => {
    if (auth.status !== 'authenticated' || !auth.user) {
      return
    }
    const name = game.nickname.trim() || auth.user.nickname
    const balance = game.account.balance
    const betAmount = sanitizeBetValue(game.betValue, balance)
    if (betAmount > 0) {
      game.setBetValue(String(betAmount))
    } else if (balance > 0) {
      game.setBetValue('1')
    } else {
      game.setBetValue('')
    }
    clearLastResult()
    connection.startGame(name, game.selectedSkin, betAmount > 0 ? betAmount : null)
  }, [auth.status, auth.user, clearLastResult, connection, game])

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
    clearLastResult()
    setNicknameVisible(false)
  }, [clearLastResult, connection, game, setNicknameVisible])

  const handleWalletRefresh = useCallback(() => {
    wallet.refresh()
  }, [wallet])

  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user)
  useEffect(() => {
    if (!isAuthenticated) {
      setWithdrawStatus(null)
      setWithdrawPending(false)
    }
  }, [isAuthenticated])
  const startLabel = useMemo(() => {
    if (game.cashout.pending) return 'Ожидание вывода'
    if (game.transfer.pending) return 'Обработка...'
    if (auth.status === 'checking') return 'Загрузка...'
    return isAuthenticated ? 'Играть' : 'Авторизоваться'
  }, [auth.status, game.cashout.pending, game.transfer.pending, isAuthenticated])

  const startDisabled =
    auth.status === 'checking' ||
    game.cashout.pending ||
    game.transfer.pending ||
    (isAuthenticated && game.account.balance <= 0)
  const startHint = useMemo(() => {
    if (game.cashout.pending) return 'Дождитесь подтверждения вывода средств.'
    if (game.transfer.pending) return 'Проводим транзакцию с вашим балансом.'
    if (isAuthenticated && game.account.balance <= 0) return 'Недостаточно монет на балансе.'
    return undefined
  }, [game.cashout.pending, game.transfer.pending, isAuthenticated, game.account.balance])

  const handlePrimaryAction = isAuthenticated ? handleStart : () => setAuthModalOpen(true)

  return (
    <div className="game-root">
      <AuthModal
        open={authModalOpen}
        status={auth.status}
        onLogin={auth.login}
        onRegister={auth.register}
        onClose={() => setAuthModalOpen(false)}
      />
      <canvas id="canvas" ref={canvasRef} />
      <ScorePanel score={game.score} scoreMeta={game.scoreMeta} />
      {!game.nicknameScreenVisible ? (
        <GameLeaderboard entries={game.leaderboard} meName={game.controller.state.meName} />
      ) : null}
      <CashoutControl state={game.cashout} buttonRef={cashoutButtonRef} />
      <NicknameScreen
        visible={game.nicknameScreenVisible}
        nickname={game.nickname}
        onNicknameChange={handleNicknameChange}
        nicknameLocked={game.nicknameLocked}
        selectedSkin={game.selectedSkin}
        onSelectSkin={game.setSelectedSkin}
        skinName={game.skinName}
        betValue={game.betValue}
        onBetChange={handleBetChange}
        onBetBlur={handleBetBlur}
        balance={game.account.balance}
        currentBet={game.account.currentBet}
        onStart={handlePrimaryAction}
        startDisabled={startDisabled}
        startLabel={startLabel}
        startDisabledHint={startHint}
        walletAddress={wallet.profile?.walletAddress || auth.user?.walletAddress || null}
        walletSol={wallet.profile?.sol}
        walletUsd={wallet.profile?.usd ?? null}
        usdRate={wallet.profile?.usdRate ?? null}
        walletLoading={wallet.loading}
        onRefreshWallet={handleWalletRefresh}
        lastResult={game.lastResult}
        retryBetValue={game.retryBetValue}
        onRetryBetChange={handleRetryBetChange}
        onRetryBetBlur={handleRetryBetBlur}
        onRetry={handleRetry}
        retryDisabled={!game.lastResult?.showRetryControls || game.account.balance <= 0}
        cashoutPending={game.cashout.pending}
        transferPending={game.transfer.pending}
        transferMessage={game.transfer.message}
        onWithdraw={handleWithdraw}
        withdrawPending={withdrawPending}
        withdrawStatus={withdrawStatus}
        playerStats={playerStats.data ?? null}
        playerStatsLoading={playerStats.loading}
        isAuthenticated={isAuthenticated}
        winningsEntries={topWinningsEntries}
        winningsLoading={winningsLeaderboard.loading}
        winningsError={winningsLeaderboard.error}
        winningsRange={leaderboardRange}
        onWinningsRangeChange={setLeaderboardRange}
        winningsPriceHint={winningsPriceHint}
      />
      {game.transfer.pending && (
        <div className="transfer-overlay">
          <div className="transfer-modal">
            <div className="transfer-spinner" />
            <div className="transfer-text">{game.transfer.message || 'Перевод средств…'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  if (isAdminRoute) {
    return <AdminDashboard />
  }
  return <GameView />
}

export default App

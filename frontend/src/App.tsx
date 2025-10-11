import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useCanvas } from './hooks/useCanvas'
import { useConnection } from './hooks/useConnection'
import { usePointerControls } from './hooks/usePointerControls'
import { sanitizeBetValue, centsToUsdInput, BET_AMOUNTS_CENTS } from './utils/helpers'
import { useAuth } from './hooks/useAuth'
import { useWallet } from './hooks/useWallet'
import { useWinningsLeaderboard } from './hooks/useWinningsLeaderboard'
import { usePlayerStats } from './hooks/usePlayerStats'
import { ScorePanel } from './components/ScorePanel'
import { GameLeaderboard } from './components/Leaderboard'
import { CashoutControl } from './components/CashoutControl'
import { NicknameScreen } from './components/NicknameScreen'
import { AuthModal } from './components/AuthModal'
import { AdminDashboard } from './components/AdminDashboard'
import { ResultModal } from './components/ResultModal'
import { LobbyBackdrop } from './components/LobbyBackdrop'

function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cashoutButtonRef = useRef<HTMLButtonElement>(null)

  const game = useGame()
  const auth = useAuth()
  const wallet = useWallet({ token: auth.token })
  const winningsLeaderboard = useWinningsLeaderboard()
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
  const winningsEntries = useMemo(() => winningsLeaderboard.data?.entries ?? [], [winningsLeaderboard.data])
  const topWinningsEntries = useMemo(() => winningsEntries.slice(0, 5), [winningsEntries])
  const totalWinningsUsd = useMemo(
    () => winningsEntries.reduce((sum, entry) => sum + entry.totalUsd, 0),
    [winningsEntries]
  )
  const totalWinningsSol = useMemo(
    () => winningsEntries.reduce((sum, entry) => sum + entry.totalSol, 0),
    [winningsEntries]
  )
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
  usePointerControls({ controller: game.controller, canvasRef, cashoutButtonRef })

  const effectiveBetBalance = useMemo(
    () =>
      Math.max(
        game.account.balance,
        auth.user?.balance ?? 0,
        wallet.profile?.inGameBalance ?? 0
      ),
    [auth.user?.balance, game.account.balance, wallet.profile?.inGameBalance]
  )

  const getBetDisplay = useCallback((value: string | number, balanceCents: number) => {
    const sanitized = sanitizeBetValue(value, balanceCents)
    return sanitized > 0 ? centsToUsdInput(sanitized) : ''
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
        const smallestBet = BET_AMOUNTS_CENTS.find((option) => option <= available) ?? 0
        if (!smallestBet) {
          if (game.betValue !== '') setBetValue('')
          if (game.retryBetValue !== '') setRetryBetValue('')
        } else {
          if (!game.betValue && !wasSynced) {
            setBetValue(centsToUsdInput(smallestBet))
          } else {
            const normalizedBet = getBetDisplay(game.betValue, available)
            if (normalizedBet !== game.betValue) {
              setBetValue(normalizedBet)
            }
          }
          const normalizedRetryBet = getBetDisplay(game.retryBetValue, available)
          if (normalizedRetryBet !== game.retryBetValue) {
            setRetryBetValue(normalizedRetryBet)
          }
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
    getBetDisplay,
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
    const display = getBetDisplay(value, effectiveBetBalance)
    game.setBetValue(display)
  }, [effectiveBetBalance, game, getBetDisplay])

  const handleBetBlur = useCallback(() => {
    const sanitized = sanitizeBetValue(game.betValue, effectiveBetBalance)
    if (sanitized > 0) {
      game.setBetValue(centsToUsdInput(sanitized))
    } else {
      const smallest = BET_AMOUNTS_CENTS.find((option) => option <= effectiveBetBalance)
      game.setBetValue(smallest ? centsToUsdInput(smallest) : '')
    }
  }, [effectiveBetBalance, game])

  const handleRetryBetChange = useCallback((value: string) => {
    const display = getBetDisplay(value, effectiveBetBalance)
    setRetryBetValue(display)
  }, [effectiveBetBalance, getBetDisplay, setRetryBetValue])

  const handleRetryBetBlur = useCallback(() => {
    const sanitized = sanitizeBetValue(game.retryBetValue, effectiveBetBalance)
    if (sanitized > 0) {
      setRetryBetValue(centsToUsdInput(sanitized))
    } else {
      const smallest = BET_AMOUNTS_CENTS.find((option) => option <= effectiveBetBalance)
      setRetryBetValue(smallest ? centsToUsdInput(smallest) : '')
    }
  }, [effectiveBetBalance, game, setRetryBetValue])

  const handleStart = useCallback(() => {
    if (auth.status !== 'authenticated' || !auth.user) {
      return
    }
    const name = game.nickname.trim() || auth.user.nickname
    const balance = effectiveBetBalance
    let betAmount = sanitizeBetValue(game.betValue, balance)
    if (betAmount <= 0) {
      const fallback = BET_AMOUNTS_CENTS.find((option) => option <= balance) ?? 0
      betAmount = fallback
    }
    if (betAmount > 0) {
      game.setBetValue(centsToUsdInput(betAmount))
    } else {
      game.setBetValue('')
    }
    clearLastResult()
    connection.startGame(name, game.selectedSkin, betAmount > 0 ? betAmount : null)
  }, [auth.status, auth.user, clearLastResult, connection, effectiveBetBalance, game])

  const handleRetry = useCallback(() => {
    const balance = effectiveBetBalance
    if (balance <= 0) {
      window.location.reload()
      return
    }
    let betAmount = sanitizeBetValue(game.retryBetValue || balance, balance)
    if (betAmount <= 0) {
      const fallback = BET_AMOUNTS_CENTS.find((option) => option <= balance) ?? 0
      betAmount = fallback
    }
    if (betAmount <= 0) return
    setRetryBetValue(centsToUsdInput(betAmount))
    connection.requestRespawn(betAmount)
    game.controller.setPendingBet(null)
    clearLastResult()
    setNicknameVisible(false)
  }, [clearLastResult, connection, effectiveBetBalance, game, setNicknameVisible, setRetryBetValue])

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
    return isAuthenticated ? 'Play' : 'Login'
  }, [auth.status, game.cashout.pending, game.transfer.pending, isAuthenticated])

  const startDisabled =
    auth.status === 'checking' ||
    game.cashout.pending ||
    game.transfer.pending ||
    (isAuthenticated && game.account.balance < BET_AMOUNTS_CENTS[0])
  const startHint = useMemo(() => {
    if (game.cashout.pending) return 'Дождитесь подтверждения вывода средств.'
    if (game.transfer.pending) return 'Проводим транзакцию с вашим балансом.'
    if (isAuthenticated && game.account.balance < BET_AMOUNTS_CENTS[0])
      return 'Недостаточно средств для минимальной ставки ($1).'
    return undefined
  }, [game.cashout.pending, game.transfer.pending, isAuthenticated, game.account.balance])

  const handlePrimaryAction = isAuthenticated ? handleStart : () => setAuthModalOpen(true)
  const inLobby = game.nicknameScreenVisible

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
      <LobbyBackdrop visible={inLobby} />
      {!inLobby ? <ScorePanel score={game.score} scoreMeta={game.scoreMeta} /> : null}
      {!inLobby ? (
        <GameLeaderboard entries={game.leaderboard} meName={game.controller.state.meName} />
      ) : null}
      {!inLobby ? <CashoutControl state={game.cashout} buttonRef={cashoutButtonRef} /> : null}
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
        bettingBalance={effectiveBetBalance}
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
        winningsPriceHint={winningsPriceHint}
        activePlayers={game.leaderboard.length}
        totalWinningsUsd={totalWinningsUsd}
        totalWinningsSol={totalWinningsSol}
        authToken={auth.token}
      />
      <ResultModal
        open={Boolean(game.lastResult)}
        result={game.lastResult}
        balanceCents={effectiveBetBalance}
        retryBetValue={game.retryBetValue}
        onRetryBetChange={handleRetryBetChange}
        onRetryBetBlur={handleRetryBetBlur}
        onRetry={handleRetry}
        onClose={clearLastResult}
        retryDisabled={game.account.balance <= 0}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useCanvas } from './hooks/useCanvas'
import { useConnection } from './hooks/useConnection'
import { usePointerControls } from './hooks/usePointerControls'
import { sanitizeBetValue, centsToUsdInput, BET_AMOUNTS_CENTS, getBetTotalCost } from './utils/helpers'
import { useAuth } from './hooks/useAuth'
import { useWallet } from './hooks/useWallet'
import { WalletProvider } from './hooks/useWalletContext'
import { useWinningsLeaderboard } from './hooks/useWinningsLeaderboard'
import { usePlayerStats } from './hooks/usePlayerStats'
import { getIntlLocale, useTranslation } from './hooks/useTranslation'
import { ScorePanel } from './components/ScorePanel'
import { GameLeaderboard } from './components/Leaderboard'
import { CashoutControl } from './components/CashoutControl'
import { NicknameScreen } from './components/NicknameScreen'
import { AuthModal } from './components/AuthModal'
import { AdminDashboard } from './components/AdminDashboard'
import { ResultModal } from './components/ResultModal'
import { LobbyBackdrop } from './components/LobbyBackdrop'
import { useToast } from './hooks/useToast'

function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cashoutButtonRef = useRef<HTMLButtonElement>(null)

  const game = useGame()
  const auth = useAuth()
  const { t, locale } = useTranslation()
  const wallet = useWallet({ token: auth.token })
  const winningsLeaderboard = useWinningsLeaderboard()
  const playerStats = usePlayerStats({ token: auth.token, days: 30 })
  const refreshPlayerStats = playerStats.refresh
  const [withdrawPending, setWithdrawPending] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [startProcessing, setStartProcessing] = useState(false)
  const [nicknameUpdateError, setNicknameUpdateError] = useState<string | null>(null)
  const { pushToast } = useToast()
  const connection = useConnection({
    controller: game.controller,
    token: auth.token,
    onAuthError: auth.logout,
    onBalanceUpdate: auth.syncBalance
  })
  const controller = game.controller
  const { setNickname, setBetValue, setRetryBetValue, setNicknameVisible, clearLastResult } = game
  const lastResult = game.lastResult
  const isFullScreenResult = Boolean(
    lastResult &&
      (lastResult.variant === 'death' || (lastResult.variant === 'cashout' && !game.transfer.pending))
  )
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
    return `1 SOL ≈ ${new Intl.NumberFormat(getIntlLocale(locale), {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format((priceUsd as number) || 0)}`
  }, [locale, winningsLeaderboard.data?.priceUsd])
  const accountStateSyncedRef = useRef(false)

  useCanvas({ canvasRef, controller: game.controller })
  usePointerControls({ controller: game.controller, canvasRef, cashoutButtonRef })

  useEffect(() => {
    if (!lastResult) return
    if (isFullScreenResult) return
    const messageParts = [lastResult.title, ...lastResult.details]
    const message = messageParts.filter(Boolean).join(' • ')
    if (message) {
      pushToast({ type: 'info', message })
    }
    clearLastResult()
  }, [clearLastResult, isFullScreenResult, lastResult, pushToast])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const { classList } = document.body
    const applyTouchClass = (isTouch: boolean) => {
      classList.toggle('is-touch', isTouch)
      classList.toggle('is-pointer', !isTouch)
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const handleMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
      applyTouchClass(event.matches)
    }

    applyTouchClass(mediaQuery.matches)

    const handleFirstTouch = () => {
      applyTouchClass(true)
    }

    const addMediaListener = () => {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange)
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleMediaChange)
      }
    }

    const removeMediaListener = () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleMediaChange)
      }
    }

    addMediaListener()
    window.addEventListener('touchstart', handleFirstTouch, { once: true })

    return () => {
      removeMediaListener()
      window.removeEventListener('touchstart', handleFirstTouch)
      classList.remove('is-touch')
      classList.remove('is-pointer')
    }
  }, [])

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
        const message = t('app.errors.cashoutUnavailable')
        pushToast({ type: 'error', message })
        throw new Error(message)
      }
      setWithdrawPending(true)
      try {
        const result = await wallet.withdrawAll(destination)
        pushToast({
          type: 'success',
          message: result?.message ?? t('app.withdraw.successFallback')
        })
        await wallet.refresh()
        refreshPlayerStats()
      } catch (error) {
        const message = (error as Error)?.message || t('app.withdraw.errorFallback')
        pushToast({ type: 'error', message })
        throw error
      } finally {
        setWithdrawPending(false)
      }
    },
    [pushToast, refreshPlayerStats, t, wallet]
  )

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user) {
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
      const affordableOptions = BET_AMOUNTS_CENTS.filter((option) => getBetTotalCost(option) <= available)
      if (game.nickname !== auth.user.nickname) {
        setNickname(auth.user.nickname)
      }
      if (available <= 0 || affordableOptions.length === 0) {
        if (game.betValue !== '') setBetValue('')
        if (game.retryBetValue !== '') setRetryBetValue('')
      } else {
        const smallestBet = affordableOptions[0]
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
      setAuthModalOpen(false)
    } else if (auth.status === 'unauthenticated') {
      accountStateSyncedRef.current = false
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

  useEffect(() => {
    setNicknameUpdateError(null)
  }, [game.nickname])

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setNicknameUpdateError(null)
      setStartProcessing(false)
    }
  }, [auth.status])

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
      const smallest = BET_AMOUNTS_CENTS.find((option) => getBetTotalCost(option) <= effectiveBetBalance)
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
      const smallest = BET_AMOUNTS_CENTS.find((option) => getBetTotalCost(option) <= effectiveBetBalance)
      setRetryBetValue(smallest ? centsToUsdInput(smallest) : '')
    }
  }, [effectiveBetBalance, game, setRetryBetValue])

  const resolveNicknameError = useCallback(
    (code?: string | null) => {
      if (!code) return t('hub.account.nicknameErrors.generic')
      const map: Record<string, string> = {
        invalid_nickname: t('hub.account.nicknameErrors.invalid'),
        nickname_length: t('hub.account.nicknameErrors.length'),
        nickname_taken: t('hub.account.nicknameErrors.taken'),
        unauthorized: t('hub.account.nicknameErrors.unauthorized'),
        network_error: t('hub.account.nicknameErrors.network'),
        server_error: t('hub.account.nicknameErrors.server'),
        user_not_found: t('hub.account.nicknameErrors.server')
      }
      return map[code] ?? t('hub.account.nicknameErrors.generic')
    },
    [t]
  )

  const handleStart = useCallback(async () => {
    if (auth.status !== 'authenticated' || !auth.user) {
      return
    }
    setNicknameUpdateError(null)
    setStartProcessing(true)
    try {
      const trimmedName = game.nickname.trim() || auth.user.nickname
      if (!trimmedName) {
        return
      }
      if (trimmedName !== auth.user.nickname) {
        const result = await auth.updateNickname(trimmedName)
        if (!result.ok) {
          if (result.error === 'unauthorized') {
            auth.logout()
          }
          setNicknameUpdateError(resolveNicknameError(result.error))
          return
        }
      }
      if (game.nickname !== trimmedName) {
        setNickname(trimmedName)
      }
      const balance = effectiveBetBalance
      let betAmount = sanitizeBetValue(game.betValue, balance)
      if (betAmount <= 0) {
        const fallback = BET_AMOUNTS_CENTS.find((option) => getBetTotalCost(option) <= balance) ?? 0
        betAmount = fallback
      }
      if (betAmount > 0) {
        game.setBetValue(centsToUsdInput(betAmount))
      } else {
        game.setBetValue('')
      }
      clearLastResult()
      connection.startGame(trimmedName, game.selectedSkin, betAmount > 0 ? betAmount : null)
    } catch (error) {
      setNicknameUpdateError((prev) => prev ?? resolveNicknameError('network_error'))
    } finally {
      setStartProcessing(false)
    }
  }, [
    auth.logout,
    auth.status,
    auth.updateNickname,
    auth.user,
    clearLastResult,
    connection,
    effectiveBetBalance,
    game,
    resolveNicknameError,
    setNickname
  ])

  const handleRetry = useCallback(() => {
    const balance = effectiveBetBalance
    if (balance < getBetTotalCost(BET_AMOUNTS_CENTS[0])) {
      window.location.reload()
      return
    }
    let betAmount = sanitizeBetValue(game.retryBetValue || balance, balance)
    if (betAmount <= 0) {
      const fallback = BET_AMOUNTS_CENTS.find((option) => getBetTotalCost(option) <= balance) ?? 0
      betAmount = fallback
    }
    if (betAmount <= 0) return
    setRetryBetValue(centsToUsdInput(betAmount))
    connection.requestRespawn(betAmount)
    game.controller.setPendingBet(null)
    clearLastResult()
    setNicknameVisible(false)
  }, [clearLastResult, connection, effectiveBetBalance, game, setNicknameVisible, setRetryBetValue])

  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user)
  useEffect(() => {
    if (!isAuthenticated) {
      setWithdrawPending(false)
    }
  }, [isAuthenticated])
  const startLabel = useMemo(() => {
    if (startProcessing) return t('hub.account.saving')
    if (game.cashout.pending) return t('app.startLabel.cashoutPending')
    if (game.transfer.pending) return t('app.startLabel.transferPending')
    if (auth.status === 'checking') return t('app.startLabel.checking')
    return isAuthenticated ? t('app.startLabel.play') : t('app.startLabel.login')
  }, [auth.status, game.cashout.pending, game.transfer.pending, isAuthenticated, startProcessing, t])

  const startDisabled =
    auth.status === 'checking' ||
    game.cashout.pending ||
    game.transfer.pending ||
    startProcessing ||
    (isAuthenticated && game.account.balance < getBetTotalCost(BET_AMOUNTS_CENTS[0]))
  const startHint = useMemo(() => {
    if (startProcessing) return t('hub.account.saving')
    if (nicknameUpdateError) return nicknameUpdateError
    if (game.cashout.pending) return t('app.startHint.cashoutPending')
    if (game.transfer.pending) return t('app.startHint.transferPending')
    if (isAuthenticated && game.account.balance < getBetTotalCost(BET_AMOUNTS_CENTS[0]))
      return t('app.startHint.insufficientFunds')
    return undefined
  }, [
    game.account.balance,
    game.cashout.pending,
    game.transfer.pending,
    isAuthenticated,
    nicknameUpdateError,
    startProcessing,
    t
  ])

  const handleRequireAuth = useCallback(() => setAuthModalOpen(true), [])

  const handlePrimaryAction = isAuthenticated ? handleStart : handleRequireAuth
  const inLobby = game.nicknameScreenVisible

  return (
    <WalletProvider value={wallet}>
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
      {!inLobby ? (
        <div className="game-hud">
          <ScorePanel
            score={game.score}
            scoreMeta={game.scoreMeta}
            fps={game.performance.fps}
            ping={game.performance.ping}
            jitter={game.performance.jitter}
          />
          <GameLeaderboard entries={game.leaderboard} meName={game.controller.state.meName} />
        </div>
      ) : null}
      {!inLobby ? <CashoutControl state={game.cashout} buttonRef={cashoutButtonRef} /> : null}
      <NicknameScreen
        visible={game.nicknameScreenVisible}
        nickname={game.nickname}
        onNicknameChange={handleNicknameChange}
        nicknameLocked={game.nicknameLocked}
        selectedSkin={game.selectedSkin}
        onSelectSkin={game.setSelectedSkin}
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
        cashoutPending={game.cashout.pending}
        transferPending={game.transfer.pending}
        transferMessage={game.transfer.message}
        onWithdraw={handleWithdraw}
        withdrawPending={withdrawPending}
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
        authUser={auth.user}
        onUpdateNickname={auth.updateNickname}
        onRequireAuth={handleRequireAuth}
        onLogout={auth.logout}
      />
      <ResultModal
        open={isFullScreenResult}
        result={isFullScreenResult ? lastResult : null}
        balanceCents={effectiveBetBalance}
        retryBetValue={game.retryBetValue}
        onRetryBetChange={handleRetryBetChange}
        onRetryBetBlur={handleRetryBetBlur}
        onRetry={handleRetry}
        onClose={clearLastResult}
        retryDisabled={game.account.balance < getBetTotalCost(BET_AMOUNTS_CENTS[0])}
      />
      {game.transfer.pending && (
        <div className="transfer-overlay">
          <div className="transfer-modal">
            <div className="transfer-spinner" />
            <div className="transfer-text">{game.transfer.message || t('app.transferFallback')}</div>
          </div>
        </div>
      )}
      </div>
    </WalletProvider>
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

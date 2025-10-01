import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import {
  BET_AMOUNTS_CENTS,
  centsToUsdInput,
  formatNumber,
  formatUsd,
  sanitizeBetValue
} from '../utils/helpers'
import { SKINS, SKIN_LABELS, type LastResultState } from '../hooks/useGame'
import type { PlayerStatsData } from '../hooks/usePlayerStats'
import type { LeaderboardRange, WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import { PlayerStatsChart } from './PlayerStatsChart'
import { WinningsLeaderboardCard } from './Leaderboard'
import { Modal } from './Modal'

const RANGE_BADGES: Record<LeaderboardRange, string> = {
  '24h': 'Last 24h',
  '7d': 'Last 7d',
  '30d': 'Last 30d'
}

interface NicknameScreenProps {
  visible: boolean
  nickname: string
  onNicknameChange: (value: string) => void
  nicknameLocked: boolean
  selectedSkin: string
  onSelectSkin: (skin: string) => void
  skinName: string
  betValue: string
  onBetChange: (value: string) => void
  onBetBlur: () => void
  balance: number
  currentBet: number
  onStart: () => void
  startDisabled: boolean
  startDisabledHint?: string
  startLabel?: string
  walletAddress?: string | null
  walletSol?: number
  walletUsd?: number | null
  usdRate?: number | null
  walletLoading?: boolean
  onRefreshWallet?: () => void
  lastResult?: LastResultState | null
  retryBetValue: string
  onRetryBetChange: (value: string) => void
  onRetryBetBlur: () => void
  onRetry: () => void
  retryDisabled?: boolean
  cashoutPending?: boolean
  transferPending?: boolean
  transferMessage?: string
  onWithdraw?: (destination: string) => Promise<void> | void
  withdrawPending?: boolean
  withdrawStatus?: { type: 'success' | 'error'; message: string } | null
  playerStats?: PlayerStatsData | null
  playerStatsLoading?: boolean
  isAuthenticated?: boolean
  winningsEntries: WinningsLeaderboardEntry[]
  winningsLoading?: boolean
  winningsError?: string | null
  winningsRange: LeaderboardRange
  onWinningsRangeChange: (range: LeaderboardRange) => void
  winningsPriceHint?: string | null
  activePlayers?: number
  totalWinningsUsd?: number
  totalWinningsSol?: number
}

export function NicknameScreen({
  visible,
  nickname,
  onNicknameChange,
  nicknameLocked,
  selectedSkin,
  onSelectSkin,
  skinName,
  betValue,
  onBetChange,
  onBetBlur,
  balance,
  currentBet,
  onStart,
  startDisabled,
  startDisabledHint,
  startLabel,
  walletAddress,
  walletSol,
  walletUsd,
  usdRate,
  walletLoading,
  onRefreshWallet,
  lastResult,
  retryBetValue,
  onRetryBetChange,
  onRetryBetBlur,
  onRetry,
  retryDisabled,
  cashoutPending,
  transferPending,
  transferMessage,
  onWithdraw,
  withdrawPending,
  withdrawStatus,
  playerStats,
  playerStatsLoading,
  isAuthenticated,
  winningsEntries,
  winningsLoading,
  winningsError,
  winningsRange,
  onWinningsRangeChange,
  winningsPriceHint,
  activePlayers,
  totalWinningsUsd,
  totalWinningsSol
}: NicknameScreenProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (startDisabled) return
    onStart()
  }

  const usdFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }),
    []
  )

  const derivedUsd = useMemo(() => {
    if (typeof walletUsd === 'number') {
      return walletUsd
    }
    if (typeof walletSol === 'number' && typeof usdRate === 'number') {
      return walletSol * usdRate
    }
    return null
  }, [usdRate, walletSol, walletUsd])

  const formattedSol = typeof walletSol === 'number' ? walletSol.toFixed(3) : '0.000'
  const formattedUsd = useMemo(() => {
    if (typeof derivedUsd === 'number') {
      try {
        return usdFormatter.format(derivedUsd)
      } catch (error) {
        return `$${derivedUsd.toFixed(2)}`
      }
    }
    return '—'
  }, [derivedUsd, usdFormatter])

  const showWallet = Boolean(walletAddress)

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyResetTimer = useRef<number | null>(null)
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [winningsModalOpen, setWinningsModalOpen] = useState(false)
  const skinListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (withdrawStatus?.type === 'success') {
      setWithdrawAddress('')
      setWithdrawError(null)
    }
  }, [withdrawStatus])

  const resetCopyStatus = () => {
    if (copyResetTimer.current) {
      window.clearTimeout(copyResetTimer.current)
    }
    copyResetTimer.current = window.setTimeout(() => {
      setCopyStatus('idle')
    }, 2000)
  }

  const handleCopyWallet = async () => {
    if (!walletAddress) return

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(walletAddress)
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea')
        textarea.value = walletAddress
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!successful) {
          throw new Error('Copy command failed')
        }
      } else {
        throw new Error('Clipboard unavailable')
      }
      setCopyStatus('copied')
    } catch (error) {
      setCopyStatus('error')
    } finally {
      resetCopyStatus()
    }
  }

  const handleWithdraw = async () => {
    if (!onWithdraw) return
    const target = withdrawAddress.trim()
    if (!target) {
      setWithdrawError('Enter a Solana address')
      return
    }
    setWithdrawError(null)
    try {
      await onWithdraw(target)
    } catch (error) {
      // handled upstream
    }
  }

  const topWinner = useMemo(() => winningsEntries[0] ?? null, [winningsEntries])
  const skinColors = useMemo(() => SKINS[selectedSkin] ?? [], [selectedSkin])
  const primaryColor = skinColors[0] ?? '#38bdf8'
  const secondaryColor = skinColors[1] ?? skinColors[0] ?? '#8b5cf6'
  const avatarStyle = useMemo(
    () =>
      ({
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
      }) as CSSProperties,
    [primaryColor, secondaryColor]
  )
  const customizeStyle = useMemo(
    () =>
      ({
        '--accent-primary': primaryColor,
        '--accent-secondary': secondaryColor
      }) as CSSProperties,
    [primaryColor, secondaryColor]
  )
  const sanitizedNickname = nickname?.trim() || ''
  const profileName = sanitizedNickname || (isAuthenticated ? 'Player' : 'New player')
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || 'D'
  const selectedBetCents = useMemo(() => {
    const normalized = sanitizeBetValue(betValue, balance)
    return normalized > 0 ? normalized : null
  }, [balance, betValue])
  const selectedRetryBetCents = useMemo(() => {
    const normalized = sanitizeBetValue(retryBetValue, balance)
    return normalized > 0 ? normalized : null
  }, [balance, retryBetValue])
  const betOptions = useMemo(
    () =>
      BET_AMOUNTS_CENTS.map((value) => ({
        value,
        label: `$${centsToUsdInput(value)}`,
        disabled: value > balance
      })),
    [balance]
  )
  const betOptionsText = useMemo(
    () => betOptions.map((option) => option.label).join(', '),
    [betOptions]
  )
  const handleBetSelect = useCallback(
    (valueCents: number) => {
      if (valueCents > balance) return
      onBetChange(centsToUsdInput(valueCents))
      onBetBlur()
    },
    [balance, onBetBlur, onBetChange]
  )
  const handleRetryBetSelect = useCallback(
    (valueCents: number) => {
      if (valueCents > balance) return
      onRetryBetChange(centsToUsdInput(valueCents))
      onRetryBetBlur()
    },
    [balance, onRetryBetBlur, onRetryBetChange]
  )

  const handleCustomizeFocus = useCallback(() => {
    const target = skinListRef.current?.querySelector<HTMLButtonElement>('button.selected')
    if (target) {
      target.focus()
      return
    }
    skinListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleWalletOpen = useCallback(() => {
    if (isAuthenticated) {
      setWalletModalOpen(true)
    } else {
      onStart()
    }
  }, [isAuthenticated, onStart])

  const handleManageAffiliate = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open('https://damnbruh.com/affiliate', '_blank', 'noreferrer')
    }
  }, [])

  const handleDiscordClick = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open('https://discord.gg/damnbruh', '_blank', 'noreferrer')
    }
  }, [])

  const leaderboardEntries = useMemo(() => winningsEntries.slice(0, 5), [winningsEntries])
  const leaderboardLoading = winningsLoading && leaderboardEntries.length === 0
  const leaderboardHasError = !winningsLoading && Boolean(winningsError)
  const leaderboardRanges = useMemo(
    () => ['24h', '7d', '30d'] as LeaderboardRange[],
    []
  )
  const rangeBadge = RANGE_BADGES[winningsRange]
  const activePlayersDisplay = formatNumber(Math.max(0, activePlayers ?? 0))
  const totalPaidUsdDisplay = Number.isFinite(totalWinningsUsd ?? NaN)
    ? usdFormatter.format(totalWinningsUsd ?? 0)
    : '—'
  const totalPaidSolDisplay = Number.isFinite(totalWinningsSol ?? NaN)
    ? `${(totalWinningsSol ?? 0).toFixed(2)} SOL`
    : null
  const copyLabel = copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Try again' : 'Copy Address'
  const walletSubtitle = showWallet ? 'Wallet connected' : 'Sign in to manage your wallet.'

  return (
    <div id="nicknameScreen" className={visible ? 'overlay overlay--lobby' : 'overlay overlay--lobby hidden'}>
      <div className="damn-lobby">
        <div className="damn-lobby__topbar">
          <div className="damn-topbar__welcome">
            <span className="damn-topbar__label">Welcome,</span>
            <span className="damn-topbar__name">{profileName}</span>
          </div>
          <div className="damn-topbar__profile">
            <div className="damn-topbar__avatar" style={avatarStyle} aria-hidden="true">
              <span>{profileInitial}</span>
            </div>
            <div className="damn-topbar__details">
              <span className="damn-topbar__role">{isAuthenticated ? 'Signed in' : 'Guest'}</span>
              <span className="damn-topbar__site">www.damnbruh.com</span>
            </div>
          </div>
        </div>

        <div className="damn-hero">
          <div className="damn-hero__brand">
            <span className="damn-hero__brand-main">DAMN</span>
            <span className="damn-hero__brand-accent">BRUH</span>
          </div>
          <div className="damn-hero__tagline">Skill-Based Betting</div>
        </div>

        {(cashoutPending || transferPending) && (
          <div className={`damn-status${cashoutPending ? ' damn-status--cashout' : ''}`}>
            <div className="damn-status__indicator" />
            <div className="damn-status__body">
              <div className="damn-status__title">
                {cashoutPending ? 'Cash out in progress' : 'Processing transaction'}
              </div>
              <p className="damn-status__text">
                {transferMessage ||
                  (cashoutPending
                    ? 'We are finalising your payout.'
                    : 'Please wait a moment, we are syncing your balance.')}
              </p>
            </div>
          </div>
        )}

        <div className="damn-grid">
          <div className="damn-column damn-column--left">
            <section className="damn-card damn-card--leaderboard" aria-live="polite">
              <header className="damn-card__header">
                <div>
                  <h2 className="damn-card__title">Leaderboard</h2>
                  <span className="damn-card__caption">{rangeBadge}</span>
                </div>
                <div className="damn-card__filters" role="group" aria-label="Leaderboard range">
                  {leaderboardRanges.map((range) => (
                    <button
                      type="button"
                      key={range}
                      className={`damn-filter${range === winningsRange ? ' active' : ''}`}
                      onClick={() => onWinningsRangeChange(range)}
                    >
                      {RANGE_BADGES[range]}
                    </button>
                  ))}
                </div>
              </header>
              <ol
                className={`damn-leaderboard${winningsLoading ? ' loading' : ''}`}
              >
                {leaderboardLoading ? <li className="damn-leaderboard__placeholder">Loading…</li> : null}
                {leaderboardHasError ? (
                  <li className="damn-leaderboard__placeholder">Unable to load leaderboard</li>
                ) : null}
                {!leaderboardLoading && !leaderboardHasError && leaderboardEntries.length === 0 ? (
                  <li className="damn-leaderboard__placeholder">No winners yet</li>
                ) : null}
                {leaderboardEntries.map((entry, index) => (
                  <li key={entry.userId}>
                    <span className="damn-leaderboard__rank">{index + 1}</span>
                    <div className="damn-leaderboard__body">
                      <span className="damn-leaderboard__name">{entry.nickname}</span>
                      <span className="damn-leaderboard__meta">{formatNumber(entry.payoutCount ?? 0)} wins</span>
                    </div>
                    <div className="damn-leaderboard__amount">
                      <span className="damn-leaderboard__usd">{usdFormatter.format(entry.totalUsd)}</span>
                      <span className="damn-leaderboard__sol">{entry.totalSol.toFixed(2)} SOL</span>
                    </div>
                  </li>
                ))}
              </ol>
              {winningsPriceHint ? <div className="damn-card__hint">{winningsPriceHint}</div> : null}
            </section>

            <section className="damn-card damn-card--friends">
              <header className="damn-card__header">
                <h2 className="damn-card__title">Friends</h2>
              </header>
              <p className="damn-empty-text">No friends yet — invite your crew!</p>
            </section>

            <div className="damn-side-actions">
              <button
                type="button"
                className="damn-secondary-button"
                onClick={() => (isAuthenticated ? setStatsModalOpen(true) : onStart())}
              >
                View Stats
              </button>
              <button
                type="button"
                className="damn-secondary-button"
                onClick={() => setWinningsModalOpen(true)}
              >
                Top Winners
              </button>
            </div>
          </div>

          <form className="damn-column damn-column--center" onSubmit={handleSubmit}>
            <section className="damn-card damn-card--join">
              <header className="damn-card__header">
                <div>
                  <h2 className="damn-card__title">Join Game</h2>
                  <p className="damn-card__subtitle">Choose your stake and jump in.</p>
                </div>
                <div className="damn-card__balance">
                  <span className="damn-card__balance-label">Balance</span>
                  <span className="damn-card__balance-value">{formatUsd(balance)}</span>
                </div>
              </header>

              <div className="damn-field">
                <label className="damn-field__label" htmlFor="nicknameInput">
                  Nickname
                </label>
                <input
                  id="nicknameInput"
                  className="damn-field__input"
                  type="text"
                  maxLength={16}
                  placeholder="Enter nickname"
                  autoComplete="off"
                  value={nickname}
                  onChange={(event) => {
                    if (!nicknameLocked) {
                      onNicknameChange(event.target.value)
                    }
                  }}
                  disabled={nicknameLocked}
                />
                {nicknameLocked ? <p className="damn-field__note">Nickname locked to your account.</p> : null}
              </div>

              <div className="damn-field">
                <span className="damn-field__label">Select Bet</span>
                <div className="damn-bet-options" role="group" aria-label="Select bet">
                  {betOptions.map((option) => {
                    const selected = option.value === selectedBetCents
                    return (
                      <button
                        type="button"
                        key={option.value}
                        className={`damn-bet-option${selected ? ' selected' : ''}`}
                        onClick={() => handleBetSelect(option.value)}
                        disabled={option.disabled}
                        aria-pressed={selected}
                      >
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
                <input id="betInput" type="hidden" value={betValue} readOnly />
                <div className="damn-bet-hint">Options: {betOptionsText} · Balance {formatUsd(balance)}</div>
              </div>

              <button
                id="startBtn"
                className="damn-primary-button damn-primary-button--full"
                type="submit"
                disabled={startDisabled}
                aria-disabled={startDisabled}
              >
                {startLabel ?? 'Join Game'}
              </button>
              {startDisabled && startDisabledHint ? (
                <p className="damn-start-hint">{startDisabledHint}</p>
              ) : null}

              <div className="damn-join-stats">
                <div className="damn-join-stat">
                  <span className="damn-join-stat__value">{activePlayersDisplay}</span>
                  <span className="damn-join-stat__label">Players online</span>
                </div>
                <div className="damn-join-stat">
                  <span className="damn-join-stat__value">{totalPaidUsdDisplay}</span>
                  <span className="damn-join-stat__label">Paid out · {rangeBadge}</span>
                </div>
                {totalPaidSolDisplay ? (
                  <div className="damn-join-stat">
                    <span className="damn-join-stat__value">{totalPaidSolDisplay}</span>
                    <span className="damn-join-stat__label">Across winners</span>
                  </div>
                ) : null}
              </div>
            </section>

            {lastResult ? (
              <section className={`damn-card damn-card--result result-${lastResult.variant}`}>
                <div className="damn-result__title">{lastResult.title}</div>
                <ul className="damn-result__details">
                  {lastResult.details.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
                {lastResult.showRetryControls ? (
                  <div className="damn-result__retry">
                    <div className="damn-field">
                      <label className="damn-field__label" id="retryBetInputLabel" htmlFor="retryBetInput">
                        Retry Bet
                      </label>
                      <div className="damn-bet-options damn-bet-options--compact" role="group" aria-labelledby="retryBetInputLabel">
                        {betOptions.map((option) => {
                          const selected = option.value === selectedRetryBetCents
                          return (
                            <button
                              type="button"
                              key={`retry-${option.value}`}
                              className={`damn-bet-option damn-bet-option--compact${selected ? ' selected' : ''}`}
                              onClick={() => handleRetryBetSelect(option.value)}
                              disabled={option.disabled}
                              aria-pressed={selected}
                            >
                              <span>{option.label}</span>
                            </button>
                          )
                        })}
                      </div>
                      <input id="retryBetInput" type="hidden" value={retryBetValue} readOnly />
                      <div className="damn-bet-hint">Available: {lastResult.retryBalance}</div>
                    </div>
                    <button
                      type="button"
                      className="damn-primary-button"
                      onClick={onRetry}
                      disabled={retryDisabled}
                    >
                      Play again
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <button
              type="button"
              className="damn-secondary-button damn-secondary-button--accent"
              onClick={handleManageAffiliate}
            >
              Manage Affiliate
            </button>
          </form>

          <div className="damn-column damn-column--right">
            <section className="damn-card damn-card--wallet">
              <header className="damn-card__header">
                <div>
                  <h2 className="damn-card__title">Wallet</h2>
                  <span className="damn-card__caption">{walletSubtitle}</span>
                </div>
                <button
                  type="button"
                  className="damn-link-button"
                  onClick={handleCopyWallet}
                  disabled={!walletAddress}
                >
                  {copyLabel}
                </button>
              </header>
              <div className="damn-wallet__balance">
                <span className="damn-wallet__label">Available</span>
                <span className="damn-wallet__value">{formatUsd(balance)}</span>
              </div>
              <div className="damn-wallet__meta-row">
                <span className="damn-wallet__meta-label">Current bet</span>
                <span className="damn-wallet__meta-value">{formatUsd(currentBet)}</span>
              </div>
              {showWallet ? (
                <div className="damn-wallet__meta">
                  <div className="damn-wallet__meta-row">
                    <span className="damn-wallet__meta-label">On-chain</span>
                    <span className="damn-wallet__meta-value">{formattedSol} SOL</span>
                  </div>
                  {formattedUsd !== '—' ? (
                    <div className="damn-wallet__meta-row">
                      <span className="damn-wallet__meta-label">USD value</span>
                      <span className="damn-wallet__meta-value">{formattedUsd}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="damn-empty-text">Log in to see your on-chain funds.</p>
              )}
              <div className="damn-wallet__actions">
                <button
                  type="button"
                  className="damn-secondary-button"
                  onClick={handleWalletOpen}
                  disabled={walletLoading && isAuthenticated}
                >
                  {walletLoading && isAuthenticated ? 'Refreshing…' : 'Add Funds'}
                </button>
                <button
                  type="button"
                  className="damn-primary-button damn-primary-button--outline"
                  onClick={handleWalletOpen}
                  disabled={!isAuthenticated}
                >
                  Cash Out
                </button>
              </div>
            </section>

            <section className="damn-card damn-card--customize" style={customizeStyle}>
              <header className="damn-card__header">
                <div>
                  <h2 className="damn-card__title">Customize</h2>
                  <span className="damn-card__caption">{skinName}</span>
                </div>
                <button type="button" className="damn-link-button" onClick={handleCustomizeFocus}>
                  Change appearance
                </button>
              </header>
              <div className="damn-customize__preview" aria-hidden="true" />
              {topWinner ? (
                <div className="damn-customize__highlight">
                  <span className="damn-customize__label">Top winner</span>
                  <span className="damn-customize__name">{topWinner.nickname}</span>
                  <span className="damn-customize__amount">{usdFormatter.format(topWinner.totalUsd)}</span>
                </div>
              ) : null}
              <div id="skinList" ref={skinListRef} className="damn-skin-grid">
                {Object.entries(SKINS).map(([skin, colors]) => (
                  <button
                    type="button"
                    key={skin}
                    className={`damn-skin${skin === selectedSkin ? ' selected' : ''}`}
                    data-skin={skin}
                    data-name={SKIN_LABELS[skin] || skin}
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${colors[0] ?? '#38bdf8'}, ${
                        colors[1] ?? colors[0] ?? '#8b5cf6'
                      })`
                    }}
                    onClick={() => onSelectSkin(skin)}
                    aria-label={SKIN_LABELS[skin] || skin}
                  >
                    <span className="damn-skin__ring" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="damn-footer">
          <button type="button" className="damn-secondary-button" onClick={handleDiscordClick}>
            Join Discord!
          </button>
          <a className="damn-footer__link" href="https://damnbruh.com" target="_blank" rel="noreferrer">
            damnbruh.com
          </a>
        </div>
      </div>

      <Modal open={walletModalOpen} title="Wallet" onClose={() => setWalletModalOpen(false)} width="520px">
        <div className="wallet-section wallet-modal-section">
          <div className="wallet-row">
            <span className="wallet-label">In-game balance</span>
            <span className="wallet-value">{formatUsd(balance)}</span>
          </div>
          {showWallet ? (
            <>
              <div className="wallet-row">
                <span className="wallet-label">SOL</span>
                <span className="wallet-value">{formattedSol}</span>
              </div>
              <div className="wallet-row">
                <span className="wallet-label">USD</span>
                <span className="wallet-value">{formattedUsd}</span>
              </div>
              <div className="wallet-address" title={walletAddress ?? ''}>
                <div className="wallet-address-text">
                  <span className="wallet-label">Wallet</span>
                  <span className="wallet-hash">{walletAddress}</span>
                </div>
                <button type="button" className="wallet-copy-button" onClick={handleCopyWallet}>
                  {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Error' : 'Copy'}
                </button>
              </div>
              <div className="wallet-actions">
                <button
                  type="button"
                  className="wallet-refresh-button"
                  onClick={onRefreshWallet}
                  disabled={walletLoading}
                >
                  {walletLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              <div className="wallet-withdraw">
                <label htmlFor="withdrawAddress">Withdraw balance</label>
                <div className="wallet-withdraw-controls">
                  <input
                    id="withdrawAddress"
                    type="text"
                    placeholder="Solana wallet address"
                    value={withdrawAddress}
                    onChange={(event) => {
                      setWithdrawAddress(event.target.value)
                      if (withdrawError) setWithdrawError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleWithdraw()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="wallet-withdraw-button"
                    onClick={handleWithdraw}
                    disabled={withdrawPending || !onWithdraw}
                  >
                    {withdrawPending ? 'Sending…' : 'Withdraw'}
                  </button>
                </div>
                {withdrawError ? (
                  <p className="wallet-withdraw-status error">{withdrawError}</p>
                ) : withdrawStatus ? (
                  <p className={`wallet-withdraw-status ${withdrawStatus.type}`}>
                    {withdrawStatus.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="wallet-placeholder">Sign in to see wallet details.</p>
          )}
        </div>
      </Modal>
      <Modal
        open={statsModalOpen}
        title="Winning stats"
        onClose={() => setStatsModalOpen(false)}
        width="580px"
      >
        {isAuthenticated ? (
          <PlayerStatsChart
            series={playerStats?.series ?? []}
            loading={playerStatsLoading}
            totalUsd={playerStats?.totals?.usd ?? 0}
            totalSol={playerStats?.totals?.sol ?? 0}
          />
        ) : (
          <div className="stats-card stats-card-locked modal-placeholder">
            <div className="stats-card-title">Stats unavailable</div>
            <div className="stats-card-body placeholder">Sign in to view your game history.</div>
          </div>
        )}
      </Modal>
      <Modal
        open={winningsModalOpen}
        title="Top winners"
        onClose={() => setWinningsModalOpen(false)}
        width="520px"
      >
        <WinningsLeaderboardCard
          entries={winningsEntries}
          loading={winningsLoading}
          error={winningsError ?? null}
          range={winningsRange}
          onRangeChange={onWinningsRangeChange}
          priceHint={winningsPriceHint}
        />
      </Modal>
    </div>
  )
}

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatNumber } from '../utils/helpers'
import { SKINS, SKIN_LABELS, type LastResultState } from '../hooks/useGame'
import type { PlayerStatsData } from '../hooks/usePlayerStats'
import type { LeaderboardRange, WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import { PlayerStatsChart } from './PlayerStatsChart'
import { WinningsLeaderboardCard } from './Leaderboard'
import { Modal } from './Modal'

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
  winningsPriceHint
}: NicknameScreenProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (startDisabled) return
    onStart()
  }

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
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(derivedUsd)
      } catch (error) {
        return `$${derivedUsd.toFixed(2)}`
      }
    }
    return '—'
  }, [derivedUsd])
  const showWallet = Boolean(walletAddress)

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyResetTimer = useRef<number | null>(null)
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [winningsModalOpen, setWinningsModalOpen] = useState(false)

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
      setWithdrawError('Введите адрес кошелька')
      return
    }
    setWithdrawError(null)
    try {
      await onWithdraw(target)
    } catch (error) {
      // Ошибка уже отображается через withdrawStatus
    }
  }

  const topWinner = useMemo(() => winningsEntries[0] ?? null, [winningsEntries])
  const skinColors = useMemo(() => SKINS[selectedSkin] ?? [], [selectedSkin])
  const primaryColor = skinColors[0] ?? '#38bdf8'
  const secondaryColor = skinColors[1] ?? skinColors[0] ?? '#8b5cf6'
  const arenaStyle = useMemo(
    () =>
      ({
        '--arena-primary': primaryColor,
        '--arena-secondary': secondaryColor
      }) as CSSProperties,
    [primaryColor, secondaryColor]
  )
  const avatarStyle = useMemo(
    () =>
      ({
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
      }) as CSSProperties,
    [primaryColor, secondaryColor]
  )
  const sanitizedNickname = nickname?.trim() || ''
  const profileName = sanitizedNickname || (isAuthenticated ? 'Игрок' : 'Новый игрок')
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || 'S'

  return (
    <div id="nicknameScreen" className={visible ? 'overlay overlay--lobby' : 'overlay overlay--lobby hidden'}>
      <div className="card lobby-card">
        <div className="lobby-header">
          <div className="lobby-header-brand">
            <div className="lobby-logo" aria-label="Slither X">
              <span className="lobby-logo-main">Slither</span>
              <span className="lobby-logo-accent">X</span>
            </div>
            <p className="lobby-tagline">Неоновая арена мгновенных ставок.</p>
          </div>
          <div className="lobby-header-profile">
            <div className="profile-avatar" style={avatarStyle} aria-hidden="true">
              <span>{profileInitial}</span>
            </div>
            <div className="profile-details">
              <span className="profile-label">{isAuthenticated ? 'Игрок' : 'Гость'}</span>
              <span className="profile-name">{profileName}</span>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="lobby-form">
          {(cashoutPending || transferPending) && (
            <div className={`status-banner${cashoutPending ? ' status-banner-cashout' : ''}`}>
              <div className="status-indicator" />
              <div className="status-content">
                <div className="status-title">
                  {cashoutPending ? 'Вывод средств выполняется' : 'Транзакция в обработке'}
                </div>
                <p>
                  {transferMessage ||
                    (cashoutPending ? 'Мы завершаем перевод на ваш кошелек.' : 'Подождите, операция скоро завершится.')}
                </p>
              </div>
            </div>
          )}

          <div className="lobby-layout">
            <aside className="lobby-column lobby-column-left">
              <div className="balance-widget glass-card">
                <div className="balance-widget-header">
                  <div className="balance-widget-title">Баланс</div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => (isAuthenticated ? setWalletModalOpen(true) : onStart())}
                    aria-label="Кошелек"
                    disabled={!isAuthenticated}
                  >
                    <span className="icon-wallet" aria-hidden="true" />
                  </button>
                </div>
                <div className="balance-widget-value">{formatNumber(balance)}</div>
                <div className="balance-widget-meta">
                  <span>Текущая ставка</span>
                  <strong>{formatNumber(currentBet)}</strong>
                </div>
                <div className="balance-widget-meta">
                  <span>Скин</span>
                  <strong>{skinName}</strong>
                </div>
                {showWallet ? (
                  <div className="balance-wallet">
                    <div className="wallet-amount">{formattedSol} SOL</div>
                    {formattedUsd !== '—' ? <div className="wallet-amount usd">{formattedUsd}</div> : null}
                  </div>
                ) : null}
                {!isAuthenticated ? (
                  <button type="button" className="auth-link" onClick={onStart}>
                    Авторизоваться
                  </button>
                ) : null}
              </div>
              <div className="utility-grid">
                <button
                  type="button"
                  className="utility-card glass-card"
                  onClick={() => (isAuthenticated ? setStatsModalOpen(true) : onStart())}
                  disabled={!isAuthenticated && startDisabled}
                >
                  <div className="utility-icon utility-icon--stats" aria-hidden="true" />
                  <div className="utility-content">
                    <span className="utility-label">Статистика</span>
                    <span className="utility-value">История игр</span>
                  </div>
                  {!isAuthenticated ? <span className="utility-lock" aria-hidden="true" /> : null}
                </button>
                <button
                  type="button"
                  className="utility-card glass-card"
                  onClick={() => setWinningsModalOpen(true)}
                >
                  <div className="utility-icon utility-icon--leaders" aria-hidden="true" />
                  <div className="utility-content">
                    <span className="utility-label">Лидеры</span>
                    {topWinner ? (
                      <span className="utility-value">{topWinner.nickname}</span>
                    ) : (
                      <span className="utility-value">Лучшие выигрыши</span>
                    )}
                  </div>
                  {topWinner ? (
                    <span className="utility-subvalue">{topWinner.totalSol.toFixed(2)} SOL</span>
                  ) : null}
                </button>
              </div>
            </aside>

            <section className="lobby-column lobby-column-center">
              <div className="arena-card glass-card" style={arenaStyle}>
                <div className="arena-backdrop" />
                <div className="arena-halo" />
                <div className="arena-character" style={avatarStyle}>
                  <div className="arena-character-core" />
                </div>
                <div className="arena-waves" />
              </div>
              <button
                id="startBtn"
                className="primary arena-start"
                type="submit"
                disabled={startDisabled}
                aria-disabled={startDisabled}
              >
                {startLabel ?? 'Играть'}
              </button>
              {startDisabled && startDisabledHint ? (
                <p className="start-hint">{startDisabledHint}</p>
              ) : null}
            </section>

            <aside className="lobby-column lobby-column-right">
              <div className="control-card glass-card">
                <label className="field-label" htmlFor="nicknameInput">
                  Никнейм
                </label>
                <input
                  id="nicknameInput"
                  type="text"
                  maxLength={16}
                  placeholder="Ваш ник"
                  autoComplete="off"
                  value={nickname}
                  onChange={(event) => {
                    if (!nicknameLocked) {
                      onNicknameChange(event.target.value)
                    }
                  }}
                  disabled={nicknameLocked}
                />
                {nicknameLocked ? <p className="nickname-note">Никнейм закреплён за аккаунтом.</p> : null}
              </div>
              <div className="control-card glass-card">
                <label className="field-label" htmlFor="betInput">
                  Ставка перед стартом
                </label>
                <input
                  id="betInput"
                  type="number"
                  min={1}
                  step={1}
                  value={betValue}
                  onChange={(event) => onBetChange(event.target.value)}
                  onBlur={onBetBlur}
                />
                <div className="bet-hint">
                  Доступно: <span id="betBalanceDisplay">{formatNumber(balance)}</span>
                </div>
              </div>
              {lastResult ? (
                <div className={`control-card glass-card result-card result-${lastResult.variant}`}>
                  <div className="result-title">{lastResult.title}</div>
                  <ul className="result-details">
                    {lastResult.details.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  {lastResult.showRetryControls ? (
                    <div className="result-retry">
                      <div className="bet-control">
                        <label htmlFor="retryBetInput">Ставка для повтора</label>
                        <input
                          id="retryBetInput"
                          type="number"
                          min={1}
                          step={1}
                          value={retryBetValue}
                          onChange={(event) => onRetryBetChange(event.target.value)}
                          onBlur={onRetryBetBlur}
                        />
                        <div className="bet-hint">
                          Доступно: <span>{lastResult.retryBalance}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="primary retry-button"
                        onClick={onRetry}
                        disabled={retryDisabled}
                      >
                        Играть снова
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="control-card glass-card">
                <div className="skin-picker">
                  <div className="caption">
                    <span>Скины</span>
                    <span id="skinName">{skinName}</span>
                  </div>
                  <div id="skinList" className="skin-grid">
                    {Object.entries(SKINS).map(([skin, colors]) => (
                      <button
                        type="button"
                        key={skin}
                        className={`skin-token${skin === selectedSkin ? ' selected' : ''}`}
                        data-skin={skin}
                        data-name={SKIN_LABELS[skin] || skin}
                        style={{
                          background: `radial-gradient(circle at 30% 30%, ${colors[0] ?? '#38bdf8'}, ${
                            colors[1] ?? colors[0] ?? '#8b5cf6'
                          })`
                        }}
                        onClick={() => onSelectSkin(skin)}
                        aria-label={SKIN_LABELS[skin] || skin}
                      >
                        <span className="skin-token-ring" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>
      <Modal
        open={walletModalOpen}
        title="Кошелек"
        onClose={() => setWalletModalOpen(false)}
        width="520px"
      >
        <div className="wallet-section wallet-modal-section">
          <div className="wallet-row">
            <span className="wallet-label">Игровой баланс</span>
            <span className="wallet-value">{formatNumber(balance)}</span>
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
                  <span className="wallet-label">Кошелек</span>
                  <span className="wallet-hash">{walletAddress}</span>
                </div>
                <button type="button" className="wallet-copy-button" onClick={handleCopyWallet}>
                  {copyStatus === 'copied' ? 'Скопировано' : copyStatus === 'error' ? 'Ошибка' : 'Скопировать'}
                </button>
              </div>
              <div className="wallet-actions">
                <button
                  type="button"
                  className="wallet-refresh-button"
                  onClick={onRefreshWallet}
                  disabled={walletLoading}
                >
                  {walletLoading ? 'Обновление...' : 'Обновить'}
                </button>
              </div>
              <div className="wallet-withdraw">
                <label htmlFor="withdrawAddress">Вывод баланса</label>
                <div className="wallet-withdraw-controls">
                  <input
                    id="withdrawAddress"
                    type="text"
                    placeholder="Адрес кошелька Solana"
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
                    {withdrawPending ? 'Вывод...' : 'Вывести'}
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
            <p className="wallet-placeholder">Авторизуйтесь, чтобы увидеть детали кошелька.</p>
          )}
        </div>
      </Modal>
      <Modal
        open={statsModalOpen}
        title="Статистика выигрышей"
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
            <div className="stats-card-title">Статистика недоступна</div>
            <div className="stats-card-body placeholder">Войдите в аккаунт, чтобы посмотреть историю игр</div>
          </div>
        )}
      </Modal>
      <Modal
        open={winningsModalOpen}
        title="Лидеры по выигрышу"
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

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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

  return (
    <div id="nicknameScreen" className={visible ? 'overlay overlay--lobby' : 'overlay overlay--lobby hidden'}>
      <div className="card lobby-card">
        <div className="lobby-hero">
          <div className="lobby-hero-copy">
            <div className="lobby-logo" aria-label="Slither X">
              <span className="lobby-logo-main">Slither</span>
              <span className="lobby-logo-accent">X</span>
            </div>
            <p className="lobby-tagline">Неоновая арена мгновенных ставок.</p>
            <div className="lobby-hero-status">
              <span className="status-chip">
                <span className="status-dot" /> online
              </span>
              <span className="status-divider" />
              <span className="status-text">Залетай и забирай банк.</span>
            </div>
            <div className="lobby-hero-metrics">
              <div className="metric metric--balance">
                <span className="metric-label">Баланс</span>
                <span className="metric-value">{formatNumber(balance)}</span>
              </div>
              <div className="metric metric--bet">
                <span className="metric-label">Ставка</span>
                <span className="metric-value">{formatNumber(currentBet)}</span>
              </div>
              <div className="metric metric--skin">
                <span className="metric-label">Скин</span>
                <span className="metric-value">{skinName}</span>
              </div>
            </div>
            <div className="lobby-actions">
              <button type="button" className="lobby-action" onClick={() => setWalletModalOpen(true)}>
                <span className="lobby-action-label">Кошелек</span>
                <span className="lobby-action-value">{showWallet ? `${formattedSol} SOL` : 'Нет данных'}</span>
                {showWallet && formattedUsd !== '—' ? (
                  <span className="lobby-action-subvalue">{formattedUsd}</span>
                ) : null}
              </button>
              <button
                type="button"
                className="lobby-action"
                onClick={() => setStatsModalOpen(true)}
                disabled={!isAuthenticated}
              >
                <span className="lobby-action-label">Статистика</span>
                <span className="lobby-action-value">
                  {isAuthenticated ? 'История игр' : 'Доступна после входа'}
                </span>
              </button>
              <button type="button" className="lobby-action" onClick={() => setWinningsModalOpen(true)}>
                <span className="lobby-action-label">Лидеры</span>
                <span className="lobby-action-value">Лучшие выигрыши</span>
                {topWinner ? (
                  <span className="lobby-action-subvalue">
                    {topWinner.nickname}: {topWinner.totalSol.toFixed(2)} SOL
                  </span>
                ) : null}
              </button>
            </div>
            {topWinner ? (
              <div className="winnings-preview" role="status">
                <span className="winnings-preview-label">Топ недели</span>
                <span className="winnings-preview-value">
                  {topWinner.nickname} · {topWinner.totalUsd.toFixed(0)}$
                </span>
              </div>
            ) : null}
          </div>
          <div className="lobby-hero-visual" aria-hidden="true">
            <div className="lobby-hero-arena">
              <div className="arena-glow" />
              <div className="arena-ring" />
              <div className="arena-ring arena-ring--secondary" />
              <div className="arena-snake">
                <span className="arena-snake-head" />
              </div>
              <div className="arena-scanline" />
              <div className="arena-scanline arena-scanline--alt" />
            </div>
            <div className="hero-indicator">
              <span className="indicator-label">Ставки активны</span>
              <span className="indicator-value">{formatNumber(currentBet)}</span>
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

          <div className="lobby-grid">
            <section className="lobby-panel lobby-panel-left">
              <h3 className="lobby-title">Профиль</h3>
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
              {nicknameLocked && (
                <p className="nickname-note">Никнейм закреплён за аккаунтом.</p>
              )}

              <div className="skin-picker">
                <div className="caption">
                  <span>Скины</span>
                  <span id="skinName">{skinName}</span>
                </div>
                <div id="skinList" className="skin-list">
                  {Object.entries(SKINS).map(([skin, colors]) => (
                    <button
                      type="button"
                      key={skin}
                      className={`skin-option${skin === selectedSkin ? ' selected' : ''}`}
                      data-skin={skin}
                      data-name={SKIN_LABELS[skin] || skin}
                      style={{ background: colors[0] ?? '#94a3b8', backgroundImage: 'none' }}
                      onClick={() => onSelectSkin(skin)}
                      aria-label={SKIN_LABELS[skin] || skin}
                    >
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="lobby-panel lobby-panel-center">
              <h3 className="lobby-title">Ставка</h3>
              {lastResult && (
                <div className={`result-banner result-${lastResult.variant}`}>
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
              )}
              <div className="bet-control">
                <label htmlFor="betInput">Ставка перед стартом</label>
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

              <div className="account-row bet-summary">
                <span className="account-label">Текущая ставка</span>
                <span className="account-value">{formatNumber(currentBet)}</span>
              </div>

              <button id="startBtn" className="primary" type="submit" disabled={startDisabled} aria-disabled={startDisabled}>
                {startLabel ?? 'Играть'}
              </button>
              {startDisabled && startDisabledHint && (
                <p className="start-hint">{startDisabledHint}</p>
              )}
            </section>

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

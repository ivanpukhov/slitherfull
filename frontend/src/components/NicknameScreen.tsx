import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber } from '../utils/helpers'
import { SKINS, SKIN_LABELS } from '../hooks/useGame'

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
  onTopUp?: () => void
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
  onTopUp
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
  const formattedUsd = typeof derivedUsd === 'number' ? derivedUsd.toFixed(2) : '—'
  const showWallet = Boolean(walletAddress)

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyResetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current)
      }
    }
  }, [])

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

  return (
    <div id="nicknameScreen" className={visible ? 'overlay' : 'overlay hidden'}>
      <div className="card lobby-card">
        <form onSubmit={handleSubmit} className="lobby-form">
          <div className="lobby-header">
            <h2>Slither — онлайн арена</h2>
            <p>
              Выберите никнейм и скин, чтобы начать игру. На компьютере управляйте мышью и удерживайте её кнопку, чтобы
              ускориться. На смартфоне используйте виртуальный джойстик и кнопку ускорения.
            </p>
          </div>

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

            <section className="lobby-panel lobby-panel-right">
              <h3 className="lobby-title">Баланс</h3>
              <div className="account">
                <div className="account-row">
                  <span className="account-label">Баланс</span>
                  <span className="account-value" id="balanceValue">
                    {formatNumber(balance)}
                  </span>
                </div>
              </div>

              {showWallet && (
                <div className="wallet-section">
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
                    <button
                      type="button"
                      className="wallet-copy-button"
                      onClick={handleCopyWallet}
                    >
                      {copyStatus === 'copied' ? 'Скопировано' : copyStatus === 'error' ? 'Ошибка' : 'Скопировать'}
                    </button>
                  </div>
                  <div className="wallet-actions">
                    <button
                      type="button"
                      className="wallet-button"
                      onClick={onTopUp}
                      disabled={walletLoading}
                    >
                      {walletLoading ? 'Обработка...' : 'Пополнить'}
                    </button>
                    <button
                      type="button"
                      className="wallet-button secondary"
                      onClick={onRefreshWallet}
                      disabled={walletLoading}
                    >
                      {walletLoading ? 'Обновление...' : 'Обновить'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </form>
      </div>
    </div>
  )
}

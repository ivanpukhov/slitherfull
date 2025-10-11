import {type CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {BET_AMOUNTS_CENTS, centsToUsdInput, formatNumber, formatUsd, sanitizeBetValue} from '../utils/helpers'
import {SKIN_LABELS, SKINS} from '../hooks/useGame'
import {useFriends} from '../hooks/useFriends'
import type {PlayerStatsData} from '../hooks/usePlayerStats'
import type {WinningsLeaderboardEntry} from '../hooks/useWinningsLeaderboard'
import {PlayerStatsChart} from './PlayerStatsChart'
import {WinningsLeaderboardCard} from './Leaderboard'
import {Modal} from './Modal'
import {FriendsModal} from './FriendsModal'
import {SnakePreview} from './SnakePreview'
import {LobbyBackground} from './LobbyBackground'
import wallet from './../assets/wallet.svg'
import castom from './../assets/castomize.svg'
import leader from './../assets/leader.svg'
import friend from './../assets/friend.svg'

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
    bettingBalance?: number
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
    winningsPriceHint?: string | null
    activePlayers?: number
    totalWinningsUsd?: number
    totalWinningsSol?: number
    authToken?: string | null
    profileNickname?: string | null
    onRequestNicknameEdit?: () => void
    onCancelNicknameEdit?: () => void
    onSubmitNicknameChange?: () => void
    nicknamePending?: boolean
    nicknameError?: string | null
    nicknameMessage?: string | null
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
                                   bettingBalance,
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
                                   winningsPriceHint,
                                   activePlayers,
                                   totalWinningsUsd,
                                   totalWinningsSol,
                                   authToken,
                                   profileNickname,
                                   onRequestNicknameEdit,
                                   onCancelNicknameEdit,
                                   onSubmitNicknameChange,
                                   nicknamePending,
                                   nicknameError,
                                   nicknameMessage
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
    const [withdrawExpanded, setWithdrawExpanded] = useState(false)
    const [walletModalOpen, setWalletModalOpen] = useState(false)
    const [statsModalOpen, setStatsModalOpen] = useState(false)
    const [winningsModalOpen, setWinningsModalOpen] = useState(false)
    const [friendsModalOpen, setFriendsModalOpen] = useState(false)
    const [skinModalOpen, setSkinModalOpen] = useState(false)
    const skinListRef = useRef<HTMLDivElement>(null)
    const nicknameInputRef = useRef<HTMLInputElement>(null)
    const friendsController = useFriends(authToken ?? null)

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

    useEffect(() => {
        if (!isAuthenticated && friendsModalOpen) {
            setFriendsModalOpen(false)
        }
    }, [friendsModalOpen, isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated) {
            setWithdrawExpanded(false)
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (!visible) {
            setWithdrawExpanded(false)
        }
    }, [visible])

    useEffect(() => {
        if (!visible && skinModalOpen) {
            setSkinModalOpen(false)
        }
    }, [skinModalOpen, visible])

    useEffect(() => {
        if (!skinModalOpen) return
        const handle = window.requestAnimationFrame(() => {
            const target = skinListRef.current?.querySelector<HTMLButtonElement>('button.selected')
            target?.focus()
        })
        return () => {
            window.cancelAnimationFrame(handle)
        }
    }, [skinModalOpen, selectedSkin])

    useEffect(() => {
        if (nicknameLocked) return
        const handle = window.requestAnimationFrame(() => {
            const target = nicknameInputRef.current
            target?.focus()
            target?.select()
        })
        return () => {
            window.cancelAnimationFrame(handle)
        }
    }, [nicknameLocked])

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
    const {friends: friendsList, loading: friendsLoading, error: friendsError} = friendsController
    const friendsPreview = useMemo(() => friendsList.slice(0, 3), [friendsList])
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
    const fallbackName = profileNickname?.trim() || (isAuthenticated ? 'Player' : 'New player')
    const profileName = sanitizedNickname || fallbackName
    const profileInitial = profileName.trim().charAt(0).toUpperCase() || 'D'
    const spendableBalance = typeof bettingBalance === 'number' ? bettingBalance : balance
    const selectedBetCents = useMemo(() => {
        const normalized = sanitizeBetValue(betValue, spendableBalance)
        return normalized > 0 ? normalized : null
    }, [betValue, spendableBalance])
    const betOptions = useMemo(
        () =>
            BET_AMOUNTS_CENTS.map((value) => ({
                value,
                label: `$${centsToUsdInput(value)}`,
                disabled: value > spendableBalance
            })),
        [spendableBalance]
    )
    const betOptionsText = useMemo(
        () => betOptions.map((option) => option.label).join(', '),
        [betOptions]
    )
    const handleBetSelect = useCallback(
        (valueCents: number) => {
            if (valueCents > spendableBalance) return
            onBetChange(centsToUsdInput(valueCents))
            onBetBlur()
        },
        [onBetBlur, onBetChange, spendableBalance]
    )

    const handleOpenSkinModal = useCallback(() => {
        setSkinModalOpen(true)
    }, [])

    const handleSkinModalClose = useCallback(() => {
        setSkinModalOpen(false)
    }, [])

    const handleSkinSelect = useCallback(
        (skin: string) => {
            onSelectSkin(skin)
            setSkinModalOpen(false)
        },
        [onSelectSkin]
    )

    const handleWalletOpen = useCallback(() => {
        if (isAuthenticated) {
            setWalletModalOpen(true)
        } else {
            onStart()
        }
    }, [isAuthenticated, onStart])

    const handleToggleWithdraw = useCallback(() => {
        if (!isAuthenticated) {
            onStart()
            return
        }
        setWithdrawExpanded((prev) => !prev)
        if (withdrawError) {
            setWithdrawError(null)
        }
    }, [isAuthenticated, onStart, withdrawError])

    const handleManageAffiliate = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.open('https://snakefans.com/affiliate', '_blank', 'noreferrer')
        }
    }, [])

    const handleDiscordClick = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.open('https://discord.gg/snakefans', '_blank', 'noreferrer')
        }
    }, [])

    const handleOpenFriends = useCallback(() => {
        if (!isAuthenticated) {
            onStart()
            return
        }
        setFriendsModalOpen(true)
    }, [isAuthenticated, onStart])

    const leaderboardEntries = useMemo(() => winningsEntries.slice(0, 5), [winningsEntries])
    const leaderboardLoading = Boolean(winningsLoading && leaderboardEntries.length === 0)
    const leaderboardRefreshing = Boolean(winningsLoading && leaderboardEntries.length > 0)
    const leaderboardHasError = !winningsLoading && Boolean(winningsError)
    const activePlayersDisplay = formatNumber(Math.max(0, activePlayers ?? 0))
    const totalPaidUsdDisplay = Number.isFinite(totalWinningsUsd ?? NaN)
        ? usdFormatter.format(totalWinningsUsd ?? 0)
        : '—'
    const totalPaidSolDisplay = Number.isFinite(totalWinningsSol ?? NaN)
        ? `${(totalWinningsSol ?? 0).toFixed(2)} SOL`
        : null
    const copyLabel = copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Try again' : 'Copy Address'

    return (
        <div id="nicknameScreen" className={visible ? 'overlay overlay--lobby' : 'overlay overlay--lobby hidden'}>
            <LobbyBackground/>
            <div className="damn-lobby">
                <div className="damn-lobby__topbar">
                    <div className="damn-topbar__welcome">
                        <span className="damn-topbar__label">Welcome,</span>
                        <span className="damn-topbar__name">{profileName}</span>
                    </div>

                </div>

                <div className="damn-grid">
                    <div className="damn-column damn-column--left">
                        <section className="damn-card damn-card--leaderboard" aria-live="polite">
                            <header className="damn-card__header">

                                <div>
                                    <img src={leader} alt=""/>
                                    <h2 className="damn-card__title">
                                        Leaderboard
                                    </h2>
                                </div>
                                <div className="leaderboard__live">
                                    <div className="leaderboard__live-rounded"></div>
                                    <div className="leaderboard__live-text">Live</div>

                                </div>
                            </header>
                            <ol className={`damn-leaderboard${leaderboardRefreshing ? ' loading' : ''}`}>
                                {leaderboardLoading ?
                                    <li className="damn-leaderboard__placeholder">Loading…</li> : null}
                                {leaderboardHasError ? (
                                    <li className="damn-leaderboard__placeholder">Unable to load leaderboard</li>
                                ) : null}
                                {!leaderboardLoading && !leaderboardHasError && leaderboardEntries.length === 0 ? (
                                    <li className="damn-leaderboard__placeholder">No winners yet</li>
                                ) : null}
                                {leaderboardEntries.map((entry, index) => (
                                    <li key={entry.userId}>
                                        <div className="damn-leaderboard__body">
                                            <span
                                                className="damn-leaderboard__name">{index + 1}. {entry.nickname}</span>
                                        </div>
                                        <div className="damn-leaderboard__amount">
                                            <span
                                                className="damn-leaderboard__usd">{usdFormatter.format(entry.totalUsd)}</span>
                                        </div>
                                    </li>
                                ))}
                                <button
                                    type="button"
                                    className="friends-card-button gray"
                                    onClick={() => setWinningsModalOpen(true)}
                                >
                                    Top Winners
                                </button>
                            </ol>
                        </section>

                        <section className="damn-card damn-card--friends">
                            <header className="damn-card__header">
                                <div>
                                    <img src={friend} alt=""/>
                                    <h2 className="damn-card__title">Friends</h2>
                                </div>
                            </header>
                            {isAuthenticated ? (
                                <>
                                    {friendsLoading ? (
                                        <div className="friends-preview-empty">Загрузка друзей…</div>
                                    ) : friendsPreview.length > 0 ? (
                                        <ul className="friends-preview-grid">
                                            {friendsPreview.map((friend, index) => (
                                                <li key={friend.id} className="friends-preview-card">
                                                    <div className="friends-preview-name">
                                                        {index + 1}. {friend.nickname}
                                                    </div>
                                                </li>
                                            ))}

                                        </ul>
                                    ) : (
                                        <div className="friends-preview-empty">
                                            {friendsError ? 'Не удалось загрузить друзей.' : 'Добавьте друзей, чтобы видеть их здесь.'}
                                        </div>
                                    )}
                                    <div className="friends-actions-grid ">
                                        <button type="button" className="friends-card-button gray"
                                                onClick={handleOpenFriends}>
                                            Все друзья
                                        </button>

                                    </div>
                                </>
                            ) : (
                                <p className="damn-empty-text">Sign in to discover and add friends from the arena.</p>
                            )}
                        </section>


                    </div>

                    <div className="damn-column damn-column--center">
                        <section className="damn-hero">
                            <div className="damn-hero__brand">
                                <span className="damn-hero__brand-main">SNAKE</span>
                                <span className="damn-hero__brand-accent">FANS</span>
                            </div>
                            <div className="damn-hero__tagline">Skill-Based Betting</div>
                        </section>

                        {(cashoutPending || transferPending) && (
                            <div className={`damn-status${cashoutPending ? ' damn-status--cashout' : ''}`}>
                                <div className="damn-status__indicator"/>
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

                        <form className="damn-join-form" onSubmit={handleSubmit}>
                            <section className="damn-card damn-card--join">


                                <div className="damn-field">
                                    <div className="damn-field__row">
                                        <input
                                            id="nicknameInput"
                                            ref={nicknameInputRef}
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
                                        {nicknameLocked ? (
                                            onRequestNicknameEdit ? (
                                                <button
                                                    type="button"
                                                    className="damn-inline-button"
                                                    onClick={onRequestNicknameEdit}
                                                    disabled={nicknamePending}
                                                >
                                                    Change
                                                </button>
                                            ) : null
                                        ) : (
                                            <div className="damn-field__actions">
                                                {onSubmitNicknameChange ? (
                                                    <button
                                                        type="button"
                                                        className="damn-inline-button damn-inline-button--primary"
                                                        onClick={onSubmitNicknameChange}
                                                        disabled={nicknamePending}
                                                    >
                                                        {nicknamePending ? 'Saving…' : 'Save'}
                                                    </button>
                                                ) : null}
                                                {onCancelNicknameEdit ? (
                                                    <button
                                                        type="button"
                                                        className="damn-inline-button damn-inline-button--muted"
                                                        onClick={onCancelNicknameEdit}
                                                        disabled={nicknamePending}
                                                    >
                                                        Cancel
                                                    </button>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                    {nicknameError ? (
                                        <p className="damn-field__error">{nicknameError}</p>
                                    ) : nicknameMessage ? (
                                        <p className="damn-field__success">{nicknameMessage}</p>
                                    ) : null}
                                </div>

                            <div className="damn-field">
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
                                <input id="betInput" type="hidden" value={betValue} readOnly/>
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
                                    <span className="damn-join-stat__label">Global Player Winnings</span>
                                </div>

                            </div>
                        </section>

                        <button type="button" className="friends-card-button gray"
                                onClick={() => (isAuthenticated ? setStatsModalOpen(true) : onStart())}> View
                            Stats
                        </button>
                        </form>
                    </div>

                    <div className="damn-column damn-column--right">
                        <section className="damn-card damn-card--wallet">
                            <header className="damn-card__header">
                                <div>
                                    <img src={wallet} alt=""/>
                                    <h2 className="damn-card__title">Wallet</h2>
                                </div>
                                <div className="damn-card__actions">
                                    <button
                                        type="button"
                                        className="damn-link-button"
                                        onClick={handleCopyWallet}
                                        disabled={!walletAddress}
                                    >
                                        {copyLabel}
                                    </button>
                                    {onRefreshWallet ? (
                                        <button
                                            type="button"
                                            className="damn-link-button"
                                            onClick={onRefreshWallet}
                                            disabled={walletLoading}
                                        >
                                            {walletLoading ? 'Refreshing…' : 'Refresh'}
                                        </button>
                                    ) : null}
                                </div>
                            </header>
                            <div className="damn-wallet__balance">
                                <span className="damn-wallet__value">{formatUsd(balance)}</span>
                                <span className="damn-wallet__meta-value">{formattedSol} SOL</span>

                            </div>

                            <div className="damn-wallet__actions">
                                <button
                                    type="button"
                                    className="friends-card-button green"
                                    onClick={handleWalletOpen}
                                    disabled={walletLoading && isAuthenticated}
                                >
                                    {walletLoading && isAuthenticated ? 'Refreshing…' : 'Add Funds'}
                                </button>
                                <button
                                    type="button"
                                    className="friends-card-button  blue"
                                    onClick={handleToggleWithdraw}
                                    disabled={!isAuthenticated}
                                >
                                    {withdrawExpanded ? 'Hide Withdraw' : 'Cash Out'}
                                </button>
                            </div>
                            {withdrawExpanded && isAuthenticated ? (
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
                            ) : null}
                            {!withdrawExpanded && withdrawStatus ? (
                                <p className={`wallet-withdraw-status wallet-withdraw-status--summary ${withdrawStatus.type}`}>
                                    {withdrawStatus.message}
                                </p>
                            ) : null}
                        </section>

                        <section className="damn-card damn-card--customize" style={customizeStyle}>
                            <header className="damn-card__header">
                                <div>
                                    <img src={castom} alt=""/>
                                    <h2 className="damn-card__title ">Customize</h2>
                                </div>
                            </header>
                            <div className="damn-customize__preview">
                                <SnakePreview colors={skinColors} length={100}/>
                            </div>
                            <button
                                type="button"
                                className="friends-card-button gray damn-primary-button--full skin-change-button "
                                onClick={handleOpenSkinModal}
                            >

                                Change Appearance
                            </button>

                        </section>
                    </div>
                </div>

                <div className="damn-footer">
                    <button type="button" className="damn-secondary-button" onClick={handleDiscordClick}>
                        Join Discord!
                    </button>
                    <a className="damn-footer__link" href="https://snakefans.com" target="_blank" rel="noreferrer">
                        snakefans.com
                    </a>
                </div>
            </div>

            <Modal
                open={skinModalOpen}
                title="Выбор скина"
                onClose={handleSkinModalClose}
                width="520px"
            >
                <div className="skin-modal">
                    <p className="skin-modal__hint">Подберите внешний вид и цвет вашей змейки.</p>
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
                                onClick={() => handleSkinSelect(skin)}
                                aria-label={SKIN_LABELS[skin] || skin}
                                aria-pressed={skin === selectedSkin}
                            >
                                <span className="damn-skin__ring"/>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

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
                                    <span className="wallet-label">
                                        Wallet
                                    </span>
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
                            <p className="wallet-placeholder">
                                Use the Cash Out panel on the lobby screen to withdraw your balance.
                            </p>
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
                    priceHint={winningsPriceHint}
                />
            </Modal>
            <FriendsModal
                open={friendsModalOpen}
                controller={friendsController}
                onClose={() => setFriendsModalOpen(false)}
            />
        </div>
    )
}

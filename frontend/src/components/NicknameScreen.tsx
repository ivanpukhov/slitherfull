import { type CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    BET_AMOUNTS_CENTS,
    BET_COMMISSION_RATE,
    centsToUsdInput,
    formatNumber,
    formatUsd,
    sanitizeBetValue,
    getBetTotalCost,
    getBetCommission
} from '../utils/helpers'
import { SKIN_LABELS, SKINS } from '../hooks/useGame'
import { useFriends } from '../hooks/useFriends'
import { getIntlLocale, useTranslation } from '../hooks/useTranslation'
import type { PlayerStatsData } from '../hooks/usePlayerStats'
import type { WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import { Modal } from './Modal'
import { SnakePreview } from './SnakePreview'
import { LanguageSelector } from './LanguageSelector'
import { useWalletContext } from '../hooks/useWalletContext'
import type { AuthResult, AuthUser } from '../hooks/useAuth'
import { QRCodeCanvas } from 'qrcode.react'
import { SocialModal, type SocialTab } from './SocialModal'
import { ServerBrowserModal, type ServerBrowserTab } from './ServerBrowserModal'
import { useToast } from '../hooks/useToast'
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
    betValue: string
    onBetChange: (value: string) => void
    onBetBlur: () => void
    balance: number
    bettingBalance?: number
    currentBet: number
    onStart: () => void | Promise<void>
    startDisabled: boolean
    startDisabledHint?: string
    startLabel?: string
    cashoutPending?: boolean
    transferPending?: boolean
    transferMessage?: string
    onWithdraw?: (destination: string) => Promise<void> | void
    withdrawPending?: boolean
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
    authUser?: AuthUser | null
    onUpdateNickname?: (nickname: string) => Promise<AuthResult>
    onRequireAuth: () => void
    onLogout?: () => void
}

export function NicknameScreen({
                                   visible,
                                   nickname,
                                   onNicknameChange,
                                   nicknameLocked,
                                   selectedSkin,
                                   onSelectSkin,
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
                                   cashoutPending,
                                   transferPending,
                                   transferMessage,
                                   onWithdraw,
                                   withdrawPending,
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
                                   authUser,
                                   onUpdateNickname,
                                   onRequireAuth,
                                   onLogout
                               }: NicknameScreenProps) {
    const { t, locale } = useTranslation()
    const wallet = useWalletContext()
    const { pushToast } = useToast()
    const walletProfile = wallet.profile
    const walletAddress = walletProfile?.walletAddress || authUser?.walletAddress || null
    const walletSol = walletProfile?.sol
    const walletUsd = walletProfile?.usd ?? null
    const usdRate = walletProfile?.usdRate ?? null
    const walletLoading = wallet.loading
    const walletRefresh = wallet.refresh
    const walletError = wallet.error
    const lastWalletErrorRef = useRef<string | null>(null)
    const handleSubmit = (event: FormEvent) => {
        event.preventDefault()
        if (startDisabled) return
        onStart()
    }

    const usdFormatter = useMemo(
        () =>
            new Intl.NumberFormat(getIntlLocale(locale), {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            }),
        [locale]
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

    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
    const copyResetTimer = useRef<number | null>(null)
    const [withdrawAddress, setWithdrawAddress] = useState('')
    const [withdrawError, setWithdrawError] = useState<string | null>(null)
    const [socialModalOpen, setSocialModalOpen] = useState(false)
    const [socialTab, setSocialTab] = useState<SocialTab>('leaderboard')
    const [serverBrowserOpen, setServerBrowserOpen] = useState(false)
    const [serverBrowserTab, setServerBrowserTab] = useState<ServerBrowserTab>('account')
    const [walletModalOpen, setWalletModalOpen] = useState(false)
    const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit')
    const [withdrawAmount, setWithdrawAmount] = useState('0.000')
    const [skinModalOpen, setSkinModalOpen] = useState(false)
    const skinListRef = useRef<HTMLDivElement>(null)
    const friendsController = useFriends(authToken ?? null)
    const [nicknameDraft, setNicknameDraft] = useState(authUser?.nickname ?? '')
    const [nicknameFeedback, setNicknameFeedback] = useState<
        { type: 'success' | 'error'; message: string } | null
    >(null)
    const [nicknameSaving, setNicknameSaving] = useState(false)
    const depositUri = useMemo(() => {
        if (!walletAddress) return null
        const normalized = walletAddress.trim()
        if (!normalized) return null
        const label = encodeURIComponent('Snake Fans')
        const message = encodeURIComponent(t('hub.account.depositMessage'))
        return `solana:${normalized}?label=${label}&message=${message}`
    }, [t, walletAddress])

    const nicknameSubmitDisabled = useMemo(() => {
        const trimmed = nicknameDraft.trim()
        if (!onUpdateNickname) return true
        if (nicknameSaving) return true
        if (!trimmed) return true
        if (trimmed === (authUser?.nickname ?? '')) return true
        return false
    }, [authUser?.nickname, nicknameDraft, nicknameSaving, onUpdateNickname])

    const resolveNicknameError = useCallback(
        (code?: string | null) => {
            if (!code) return t('hub.account.nicknameErrors.generic')
            const map: Record<string, string> = {
                invalid_nickname: t('hub.account.nicknameErrors.invalid'),
                nickname_length: t('hub.account.nicknameErrors.length'),
                nickname_taken: t('hub.account.nicknameErrors.taken'),
                unauthorized: t('hub.account.nicknameErrors.unauthorized'),
                network_error: t('hub.account.nicknameErrors.network'),
                server_error: t('hub.account.nicknameErrors.server')
            }
            return map[code] ?? t('hub.account.nicknameErrors.generic')
        },
        [t]
    )

    const handleNicknameSubmit = useCallback(async () => {
        if (!onUpdateNickname) return
        const trimmed = nicknameDraft.trim()
        if (!trimmed) {
            setNicknameFeedback({ type: 'error', message: resolveNicknameError('invalid_nickname') })
            return
        }
        if (trimmed.length < 3 || trimmed.length > 16) {
            setNicknameFeedback({ type: 'error', message: resolveNicknameError('nickname_length') })
            return
        }
        setNicknameSaving(true)
        setNicknameFeedback(null)
        try {
            const result = await onUpdateNickname(trimmed)
            if (result.ok) {
                setNicknameFeedback({ type: 'success', message: t('hub.account.nicknameSaved') })
                setNicknameDraft(trimmed)
                onNicknameChange(trimmed)
            } else {
                setNicknameFeedback({
                    type: 'error',
                    message: resolveNicknameError(result.error)
                })
            }
        } catch (error) {
            setNicknameFeedback({ type: 'error', message: resolveNicknameError('network_error') })
        } finally {
            setNicknameSaving(false)
        }
    }, [nicknameDraft, onNicknameChange, onUpdateNickname, resolveNicknameError, t])

    useEffect(() => {
        return () => {
            if (copyResetTimer.current) {
                window.clearTimeout(copyResetTimer.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!visible) {
            setSocialModalOpen(false)
            setServerBrowserOpen(false)
            setWalletModalOpen(false)
        }
    }, [visible])

    useEffect(() => {
        if (!walletModalOpen) {
            setWalletTab('deposit')
        }
    }, [walletModalOpen])

    useEffect(() => {
        if (walletTab !== 'withdraw' && withdrawError) {
            setWithdrawError(null)
        }
    }, [walletTab, withdrawError])

    useEffect(() => {
        if (walletError && lastWalletErrorRef.current !== walletError) {
            pushToast({ type: 'error', message: walletError })
            lastWalletErrorRef.current = walletError
        } else if (!walletError) {
            lastWalletErrorRef.current = null
        }
    }, [pushToast, walletError])

    useEffect(() => {
        if (!walletModalOpen || walletTab !== 'withdraw') {
            return
        }
        const available = typeof walletSol === 'number' ? walletSol : 0
        if (available > 0) {
            setWithdrawAmount(available.toFixed(3))
        } else {
            setWithdrawAmount('0.000')
        }
    }, [walletModalOpen, walletTab, walletSol])

    useEffect(() => {
        if (socialModalOpen && socialTab === 'friends') {
            friendsController.refresh()
        }
    }, [friendsController, socialModalOpen, socialTab])

    useEffect(() => {
        setNicknameDraft(authUser?.nickname ?? '')
        setNicknameFeedback(null)
    }, [authUser?.nickname])

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
                    throw new Error(t('lobby.wallet.copyCommandFailed'))
                }
            } else {
                throw new Error(t('lobby.wallet.clipboardUnavailable'))
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
            setWithdrawError(t('lobby.withdraw.enterAddress'))
            return
        }
        setWithdrawError(null)
        try {
            await onWithdraw(target)
            setWithdrawAddress('')
            setWithdrawAmount('0.000')
        } catch (error) {
            // handled upstream
        }
    }

    const skinColors = useMemo(() => SKINS[selectedSkin] ?? [], [selectedSkin])
    const selectedSkinLabel = useMemo(
        () => t(SKIN_LABELS[selectedSkin] || 'game.skins.default'),
        [selectedSkin, t]
    )
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
    const profileName =
        sanitizedNickname || (isAuthenticated ? t('lobby.profile.authenticatedFallback') : t('lobby.profile.guestFallback'))
    const profileInitial = profileName.trim().charAt(0).toUpperCase() || t('lobby.profile.initialFallback')
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
                disabled: getBetTotalCost(value) > spendableBalance
            })),
        [spendableBalance]
    )
    const betOptionsText = useMemo(
        () => betOptions.map((option) => option.label).join(', '),
        [betOptions]
    )
    const handleBetSelect = useCallback(
        (valueCents: number) => {
            if (getBetTotalCost(valueCents) > spendableBalance) return
            onBetChange(centsToUsdInput(valueCents))
        },
        [onBetChange, spendableBalance]
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
        },
        [onSelectSkin]
    )

    const handleOpenSocial = useCallback(
        (nextTab: SocialTab) => {
            const requiresAuth = nextTab === 'friends' || nextTab === 'profile' || nextTab === 'search'
            if (!isAuthenticated && requiresAuth) {
                onRequireAuth()
                return
            }
            setSocialTab(nextTab)
            setSocialModalOpen(true)
        },
        [isAuthenticated, onRequireAuth]
    )

    const handleOpenServerBrowser = useCallback(
        (nextTab: ServerBrowserTab = 'account') => {
            if (nextTab === 'account') {
                setNicknameFeedback(null)
            }
            setServerBrowserTab(nextTab)
            setServerBrowserOpen(true)
        },
        []
    )

    const handleWalletOpen = useCallback(
        (tab: 'deposit' | 'withdraw' = 'deposit') => {
            if (!isAuthenticated) {
                onRequireAuth()
                return
            }
            setWalletTab(tab)
            setWalletModalOpen(true)
        },
        [isAuthenticated, onRequireAuth]
    )

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
        handleOpenSocial('friends')
    }, [handleOpenSocial])

    const handleOpenStats = useCallback(() => {
        handleOpenSocial('profile')
    }, [handleOpenSocial])

    const handleOpenWinners = useCallback(() => {
        handleOpenSocial('leaderboard')
    }, [handleOpenSocial])

    const handleWalletRefresh = useCallback(() => {
        if (typeof walletRefresh === 'function') {
            walletRefresh()
        }
    }, [walletRefresh])

    const leaderboardEntries = useMemo(() => winningsEntries.slice(0, 5), [winningsEntries])
    const leaderboardLoading = Boolean(winningsLoading && leaderboardEntries.length === 0)
    const leaderboardRefreshing = Boolean(winningsLoading && leaderboardEntries.length > 0)
    const leaderboardHasError = !winningsLoading && Boolean(winningsError)
    const rangeBadge = t('lobby.leaderboard.rangeBadge')
    const activePlayersDisplay = formatNumber(Math.max(0, activePlayers ?? 0))
    const totalPaidUsdDisplay = Number.isFinite(totalWinningsUsd ?? NaN)
        ? usdFormatter.format(totalWinningsUsd ?? 0)
        : '—'
    const totalPaidSolDisplay = Number.isFinite(totalWinningsSol ?? NaN)
        ? `${(totalWinningsSol ?? 0).toFixed(2)} SOL`
        : null
    const copyLabel =
        copyStatus === 'copied'
            ? t('lobby.wallet.copyStatus.copied')
            : copyStatus === 'error'
                ? t('lobby.wallet.copyStatus.error')
                : t('lobby.wallet.copyStatus.default')
    const serverBrowserButtonLabel = isAuthenticated
        ? t('serverBrowser.actions.settings')
        : t('serverBrowser.actions.login')

    const availableSol = typeof walletSol === 'number' ? walletSol : 0
    const formattedAvailableSol = useMemo(() => (availableSol > 0 ? availableSol.toFixed(6) : '0.000000'), [availableSol])
    const withdrawAmountValue = useMemo(() => {
        const normalized = Number.parseFloat(withdrawAmount.replace(',', '.'))
        if (Number.isFinite(normalized) && normalized > 0) {
            return normalized
        }
        return 0
    }, [withdrawAmount])
    const withdrawPercent = useMemo(() => {
        if (availableSol <= 0) return 0
        return Math.max(0, Math.min(100, Math.round((withdrawAmountValue / availableSol) * 100)))
    }, [availableSol, withdrawAmountValue])
    const withdrawPercentLabel = useMemo(
        () => t('hub.account.cashoutModal.percentage', { value: withdrawPercent }),
        [t, withdrawPercent]
    )
    return (
        <div id="nicknameScreen" className={visible ? 'overlay overlay--lobby' : 'overlay overlay--lobby hidden'}>
            <div className="damn-lobby">
                <div className="damn-lobby__topbar">
                    <div className="damn-topbar__welcome">
                        <span className="damn-topbar__label">{t('lobby.welcome.label')}</span>
                        <span className="damn-topbar__name">{profileName}</span>
                    </div>
                    <div className="damn-topbar__actions">
                        <button
                            type="button"
                            className={`topbar-button${isAuthenticated ? ' topbar-button--settings' : ' topbar-button--login'}`}
                            onClick={() => handleOpenServerBrowser('account')}
                        >
                            {serverBrowserButtonLabel}
                        </button>
                        <LanguageSelector/>
                    </div>
                </div>

                <div className="damn-hero">
                    <div className="damn-hero__brand">
                        <span className="damn-hero__brand-main">SNAKE</span>
                        <span className="damn-hero__brand-accent">FANS</span>
                    </div>
                    <div className="damn-hero__tagline">{t('lobby.hero.tagline')}</div>
                </div>

                {(cashoutPending || transferPending) && (
                    <div className={`damn-status${cashoutPending ? ' damn-status--cashout' : ''}`}>
                        <div className="damn-status__indicator"/>
                        <div className="damn-status__body">
                            <div className="damn-status__title">
                                {cashoutPending ? t('lobby.status.cashoutTitle') : t('lobby.status.transferTitle')}
                            </div>
                            <p className="damn-status__text">
                                {transferMessage ||
                                    (cashoutPending
                                        ? t('lobby.status.cashoutMessage')
                                        : t('lobby.status.transferMessage'))}
                            </p>
                        </div>
                    </div>
                )}

                <div className="damn-grid">
                    <div className="damn-column damn-column--left">
                        <section className="damn-card damn-card--leaderboard" aria-live="polite">
                            <header className="damn-card__header">

                                <div>
                                    <img src={leader} alt=""/>
                                    <h2 className="damn-card__title">
                                        {t('lobby.leaderboard.title')}
                                    </h2>
                                </div>
                                <div className="leaderboard__live">
                                    <div className="leaderboard__live-rounded"></div>
                                    <div className="leaderboard__live-text">{t('lobby.leaderboard.liveBadge')}</div>

                                </div>
                            </header>
                            <ol className={`damn-leaderboard${leaderboardRefreshing ? ' loading' : ''}`}>
                                {leaderboardLoading ?
                                    <li className="damn-leaderboard__placeholder">{t('lobby.leaderboard.loading')}</li> : null}
                                {leaderboardHasError ? (
                                    <li className="damn-leaderboard__placeholder">{t('lobby.leaderboard.error')}</li>
                                ) : null}
                                {!leaderboardLoading && !leaderboardHasError && leaderboardEntries.length === 0 ? (
                                    <li className="damn-leaderboard__placeholder">{t('lobby.leaderboard.empty')}</li>
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
                                    onClick={handleOpenWinners}
                                >
                                    {t('leaderboard.winnings.title')}
                                </button>
                            </ol>
                        </section>

                        <section className="damn-card damn-card--friends">
                            <header className="damn-card__header">
                                <div>
                                    <img src={friend} alt=""/>
                                    <h2 className="damn-card__title">{t('lobby.friends.title')}</h2>
                                </div>
                            </header>
                            {isAuthenticated ? (
                                <>
                                    {friendsLoading ? (
                                        <div className="friends-preview-empty">{t('lobby.friends.loading')}</div>
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
                                            {friendsError ? t('lobby.friends.error') : t('lobby.friends.empty')}
                                        </div>
                                    )}
                                    <div className="friends-actions-grid ">
                                        <button type="button" className="friends-card-button gray"
                                                onClick={handleOpenFriends}>
                                            {t('lobby.friends.actions.all')}
                                        </button>

                                    </div>
                                </>
                            ) : (
                                <p className="damn-empty-text">{t('lobby.friends.guestHint')}</p>
                            )}
                        </section>


                    </div>

                    <form className="damn-column damn-column--center" onSubmit={handleSubmit}>
                        <section className="damn-card damn-card--join">

                            <div className="damn-join-stats">
                                <div className="damn-join-stat">
                                    <span className="damn-join-stat__value">{activePlayersDisplay}</span>
                                    <span className="damn-join-stat__label">{t('lobby.stats.playersOnline')}</span>
                                </div>
                                <div className="damn-join-stat">
                                    <span className="damn-join-stat__value">{totalPaidUsdDisplay}</span>
                                    <span className="damn-join-stat__label">{t('lobby.stats.globalWinnings')}</span>
                                </div>

                            </div>
                            <div className="damn-field">

                                <input
                                    id="nicknameInput"
                                    className="damn-field__input"
                                    type="text"
                                    maxLength={16}
                                    placeholder={t('lobby.form.nicknamePlaceholder')}
                                    autoComplete="off"
                                    value={nickname}
                                    onChange={(event) => {
                                        onNicknameChange(event.target.value)
                                    }}
                                />
                            </div>

                            <div className="damn-field">
                                <div className="damn-bet-options" role="group" aria-label={t('lobby.form.selectBet')}>
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
                                {startLabel ?? t('lobby.form.startDefault')}
                            </button>
                            {startDisabled && startDisabledHint ? (
                                <p className="damn-start-hint">{startDisabledHint}</p>
                            ) : null}


                        </section>

                        <button
                            type="button"
                            className="friends-card-button gray"
                            onClick={handleOpenStats}
                        >
                            {t('lobby.actions.viewStats')}
                        </button>
                    </form>

                    <div className="damn-column damn-column--right">
                        <section className="damn-card damn-card--wallet">
                            <header className="damn-card__header">
                                <div>
                                    <img src={wallet} alt=""/>
                                    <h2 className="damn-card__title">{t('lobby.wallet.title')}</h2>
                                </div>
                                <div className="damn-card__actions">
                                    <button
                                        type="button"
                                        className="damn-link-button"
                                        onClick={handleCopyWallet}
                                        disabled={!walletAddress}
                                    >
                                        <span className="damn-link-button__icon" aria-hidden="true">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                            </svg>
                                        </span>
                                        <span className="damn-link-button__label">{copyLabel}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="damn-link-button"
                                        onClick={handleWalletRefresh}
                                        disabled={walletLoading}
                                    >
                                        <span className="damn-link-button__icon" aria-hidden="true">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="23 4 23 10 17 10"/>
                                                <polyline points="1 20 1 14 7 14"/>
                                                <path d="M3.51 9a9 9 0 0 1 14.88-3.36L23 10"/>
                                                <path d="M20.49 15a9 9 0 0 1-14.88 3.36L1 14"/>
                                            </svg>
                                        </span>
                                        <span className="damn-link-button__label">
                                            {walletLoading
                                                ? t('lobby.wallet.refreshing')
                                                : t('hub.account.refreshBalance')}
                                        </span>
                                    </button>
                                </div>
                            </header>
                            <div className="damn-wallet__balance">
                                <span className="damn-wallet__value">{formatUsd(balance)}</span>
                                <span className="damn-wallet__meta-value">
                                    {t('lobby.wallet.solAmount', { amount: formattedSol })}
                                </span>

                            </div>

                            <div className="damn-wallet__actions">
                                <button
                                    type="button"
                                    className="friends-card-button green"
                                    onClick={() => handleWalletOpen('deposit')}
                                    disabled={walletLoading && isAuthenticated}
                                >
                                    {walletLoading && isAuthenticated
                                        ? t('lobby.wallet.refreshing')
                                        : t('hub.account.depositButton')}
                                </button>
                                <button
                                    type="button"
                                    className="friends-card-button  blue"
                                    onClick={() => handleWalletOpen('withdraw')}
                                    disabled={!isAuthenticated}
                                >
                                    {t('hub.account.withdrawButton')}
                                </button>
                            </div>
                        </section>

                        <section className="damn-card damn-card--customize" style={customizeStyle}>
                            <header className="damn-card__header">
                                <div>
                                    <img src={castom} alt=""/>
                                    <h2 className="damn-card__title ">{t('lobby.customize.title')}</h2>
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

                                {t('lobby.customize.changeAppearance')}
                            </button>

                        </section>
                    </div>
                </div>

                <div className="damn-footer">
                    <button type="button" className="damn-secondary-button" onClick={handleDiscordClick}>
                        {t('lobby.footer.joinDiscord')}
                    </button>
                    <a className="damn-footer__link" href="https://snakefans.com" target="_blank" rel="noreferrer">
                        {t('lobby.footer.website')}
                    </a>
                </div>
            </div>

            <Modal
                open={skinModalOpen}
                title={t('lobby.skinModal.title')}
                onClose={handleSkinModalClose}

            >
                <div className="skin-modal">
                    <div id="skinList" ref={skinListRef} className="damn-skin-grid">
                        {Object.entries(SKINS).map(([skin, colors]) => {
                            const labelKey = SKIN_LABELS[skin] || 'game.skins.default'
                            const label = t(labelKey)
                            return (
                                <button
                                    type="button"
                                    key={skin}
                                    className={`damn-skin${skin === selectedSkin ? ' selected' : ''}`}
                                    data-skin={skin}
                                    data-name={label}
                                    style={{
                                        background: `radial-gradient(circle at 35% 35%, ${colors[0] ?? '#38bdf8'}, ${
                                            colors[1] ?? colors[0] ?? '#8b5cf6'
                                        })`
                                    }}
                                    onClick={() => handleSkinSelect(skin)}
                                    aria-label={label}
                                    aria-pressed={skin === selectedSkin}
                                >
                                    <span className="damn-skin__ring"/>
                                </button>
                            )
                        })}
                    </div>
                    <div className="skin-modal__preview" aria-hidden="true">
                        <SnakePreview colors={skinColors} width={420} height={200} length={140} />
                    </div>
                </div>
            </Modal>

            <SocialModal
                open={socialModalOpen}
                tab={socialTab}
                onSelectTab={setSocialTab}
                onClose={() => setSocialModalOpen(false)}
                winningsEntries={winningsEntries}
                winningsLoading={winningsLoading}
                winningsError={winningsError ?? null}
                winningsPriceHint={winningsPriceHint}
                isAuthenticated={Boolean(isAuthenticated)}
                onRequireAuth={onRequireAuth}
                friendsController={friendsController}
                playerStats={playerStats ?? null}
                playerStatsLoading={playerStatsLoading}
                profileName={profileName}
                profileEmail={authUser?.email ?? null}
                inGameBalance={balance}
                totalWinningsUsd={totalWinningsUsd}
                totalWinningsSol={totalWinningsSol}
                activePlayers={activePlayers}
            />

            <ServerBrowserModal
                open={serverBrowserOpen}
                tab={serverBrowserTab}
                onSelectTab={setServerBrowserTab}
                onClose={() => setServerBrowserOpen(false)}
                isAuthenticated={Boolean(isAuthenticated)}
                onRequireAuth={onRequireAuth}
                onLogout={onLogout}
                profileName={profileName}
                profileEmail={authUser?.email ?? null}
                walletAddress={walletAddress}
                walletUsd={derivedUsd}
                walletSol={walletSol ?? null}
                walletLoading={walletLoading}
                onRefreshWallet={handleWalletRefresh}
                onCopyWallet={handleCopyWallet}
                walletCopyLabel={copyLabel}
                inGameBalance={balance}
                selectedSkinLabel={selectedSkinLabel}
                betValue={betValue}
                serverRegion={t('serverBrowser.game.regionValue')}
                nicknameDraft={nicknameDraft}
                onNicknameDraftChange={setNicknameDraft}
                onSubmitNickname={handleNicknameSubmit}
                nicknameSaving={nicknameSaving}
                nicknameFeedback={nicknameFeedback}
                nicknameSubmitDisabled={nicknameSubmitDisabled}
                commissionPercent={Math.round(BET_COMMISSION_RATE * 100)}
            />


            <Modal
                open={walletModalOpen}
                title={t('hub.account.walletSection')}
                onClose={() => setWalletModalOpen(false)}
                width="560px"
            >
                {isAuthenticated ? (
                    <div className="hub-account">
                        <section className="hub-account-section">
                            <div className="hub-wallet-tabs" role="tablist">
                                <button
                                    type="button"
                                    className={`hub-wallet-tab${walletTab === 'deposit' ? ' active' : ''}`}
                                    aria-selected={walletTab === 'deposit'}
                                    onClick={() => setWalletTab('deposit')}
                                >
                                    {t('hub.account.depositTab')}
                                </button>
                                <button
                                    type="button"
                                    className={`hub-wallet-tab${walletTab === 'withdraw' ? ' active' : ''}`}
                                    aria-selected={walletTab === 'withdraw'}
                                    onClick={() => setWalletTab('withdraw')}
                                >
                                    {t('hub.account.withdrawTab')}
                                </button>
                            </div>
                            {walletTab === 'deposit' ? (
                                <div className="hub-wallet-panel">
                                    {walletAddress ? (
                                        <>
                                            <div className="hub-wallet-qr">
                                                <QRCodeCanvas value={depositUri || ''} size={160} includeMargin />
                                            </div>
                                            <div className="hub-wallet-address" title={walletAddress}>
                                                <span className="hub-wallet-label">{t('hub.account.walletAddress')}</span>
                                                <div className="hub-wallet-address-row">
                                                    <span className="hub-wallet-value">{walletAddress}</span>
                                                    <button type="button" className="hub-wallet-copy" onClick={handleCopyWallet}>
                                                        {copyLabel}
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="hub-wallet-refresh"
                                                onClick={handleWalletRefresh}
                                                disabled={walletLoading}
                                            >
                                                {walletLoading
                                                    ? t('lobby.wallet.refreshing')
                                                    : t('hub.account.refreshBalance')}
                                            </button>
                                            {walletError ? <div className="hub-wallet-error">{walletError}</div> : null}
                                            <p className="hub-wallet-hint">{t('hub.account.depositHint')}</p>
                                        </>
                                    ) : (
                                        <p className="hub-wallet-placeholder">{t('hub.account.walletUnavailable')}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="hub-wallet-panel cashout-panel">
                                    <div className="cashout-modal">
                                        <header className="cashout-modal__header">


                                        </header>
                                        <section className="cashout-section">
                                            <div className="cashout-balance">
                                                <div className="cashout-balance__header">
                                                    <span className="cashout-balance__label">{t('hub.account.cashoutModal.availableBalance')}</span>
                                                    <button
                                                        type="button"
                                                        className="cashout-refresh"
                                                        onClick={handleWalletRefresh}
                                                        disabled={walletLoading}
                                                    >
                                                        {walletLoading
                                                            ? t('lobby.wallet.refreshing')
                                                            : t('hub.account.refreshBalance')}
                                                    </button>
                                                </div>
                                                <div className="cashout-balance__values">
                                                    <span className="cashout-balance__amount">{formattedAvailableSol} SOL</span>
                                                    <span className="cashout-balance__usd">{formattedUsd}</span>
                                                </div>
                                            </div>
                                        </section>
                                        <section className="cashout-section">
                                            <label className="cashout-field__label" htmlFor="cashoutAmount">
                                                {t('hub.account.cashoutModal.amountLabel')}
                                            </label>
                                            <div className="cashout-amount">
                                                <input
                                                    id="cashoutAmount"
                                                    type="text"
                                                    value={withdrawAmount}
                                                    onChange={(event) => setWithdrawAmount(event.target.value)}
                                                />
                                                <div className="cashout-amount__controls">
                                                    <span className="cashout-amount__currency">{t('hub.account.cashoutModal.usd')}</span>
                                                    <button
                                                        type="button"
                                                        className="cashout-amount__swap"
                                                        disabled
                                                        aria-label={t('hub.account.cashoutModal.swapDisabled')}
                                                    >
                                                        ↔
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="cashout-amount__max"
                                                        onClick={() => {
                                                            if (availableSol > 0) {
                                                                setWithdrawAmount(availableSol.toFixed(3))
                                                            } else {
                                                                setWithdrawAmount('0.000')
                                                            }
                                                        }}
                                                    >
                                                        {t('hub.account.cashoutModal.max')}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="cashout-progress" aria-hidden="true">
                                                <div className="cashout-progress__track">
                                                    <div className="cashout-progress__value" style={{ width: `${withdrawPercent}%` }} />
                                                </div>
                                                <span className="cashout-progress__label">{withdrawPercentLabel}</span>
                                            </div>
                                        </section>
                                        <section className="cashout-section">
                                            <label className="cashout-field__label" htmlFor="hubWithdrawAddress">
                                                {t('hub.account.cashoutModal.destinationLabel')}
                                            </label>
                                            <input
                                                id="hubWithdrawAddress"
                                                type="text"
                                                placeholder={t('lobby.withdraw.placeholder')}
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
                                            {withdrawError ? (
                                                <p className="cashout-field__error">{withdrawError}</p>
                                            ) : null}
                                        </section>
                                        <div className="cashout-actions">
                                            <button
                                                type="button"
                                                className="cashout-actions__cancel"
                                                onClick={() => setWalletModalOpen(false)}
                                            >
                                                {t('hub.account.cashoutModal.cancel')}
                                            </button>
                                            <button
                                                type="button"
                                                className="cashout-actions__submit"
                                                onClick={handleWithdraw}
                                                disabled={withdrawPending || !onWithdraw}
                                            >
                                                {withdrawPending
                                                    ? t('lobby.withdraw.sending')
                                                    : t('hub.account.cashoutModal.submit')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="hub-placeholder">{t('hub.account.loginPrompt')}</div>
                )}
            </Modal>
        </div>
    )
}

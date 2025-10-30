import { useMemo } from 'react'
import type { PlayerStatsData } from '../hooks/usePlayerStats'
import type { WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import type { UseFriendsResult } from '../hooks/useFriends'
import { getIntlLocale, useTranslation } from '../hooks/useTranslation'
import { formatNumber, formatUsd } from '../utils/helpers'
import { Modal } from './Modal'
import { FriendsPanel, FriendSearchPanel } from './FriendsModal'
import { PlayerStatsChart } from './PlayerStatsChart'

export type SocialTab = 'leaderboard' | 'search' | 'profile' | 'friends'

interface SocialModalProps {
  open: boolean
  tab: SocialTab
  onSelectTab: (tab: SocialTab) => void
  onClose: () => void
  winningsEntries: WinningsLeaderboardEntry[]
  winningsLoading?: boolean
  winningsError?: string | null
  winningsPriceHint?: string | null
  isAuthenticated: boolean
  onRequireAuth: () => void
  friendsController: UseFriendsResult
  playerStats: PlayerStatsData | null
  playerStatsLoading?: boolean
  profileName: string
  profileEmail?: string | null
  inGameBalance: number
  totalWinningsUsd?: number
  totalWinningsSol?: number
  activePlayers?: number
}

export function SocialModal({
  open,
  tab,
  onSelectTab,
  onClose,
  winningsEntries,
  winningsLoading,
  winningsError,
  winningsPriceHint,
  isAuthenticated,
  onRequireAuth,
  friendsController,
  playerStats,
  playerStatsLoading,
  profileName,
  profileEmail,
  inGameBalance,
  totalWinningsUsd,
  totalWinningsSol,
  activePlayers
}: SocialModalProps) {
  const { t, locale } = useTranslation()
  const intlLocale = getIntlLocale(locale)
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }),
    [intlLocale]
  )
  const solFormatter = useMemo(
    () => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [intlLocale]
  )

  const leaderboardEntries = useMemo(() => winningsEntries.slice(0, 5), [winningsEntries])
  const leaderboardState = useMemo(() => {
    if (winningsLoading && leaderboardEntries.length === 0) {
      return { type: 'loading' as const }
    }
    if (winningsError) {
      return { type: 'error' as const, message: t('social.leaderboard.error') }
    }
    if (leaderboardEntries.length === 0) {
      return { type: 'empty' as const, message: t('social.leaderboard.empty') }
    }
    return { type: 'ready' as const }
  }, [leaderboardEntries.length, winningsError, winningsLoading, t])

  const incomingFriendRequests = friendsController.incoming?.length ?? 0

  const tabs = useMemo(
    () =>
      [
        { key: 'leaderboard' as SocialTab, label: t('social.tabs.leaderboard') },
        { key: 'search' as SocialTab, label: t('social.tabs.search') },
        { key: 'profile' as SocialTab, label: t('social.tabs.profile') },
        { key: 'friends' as SocialTab, label: t('social.tabs.friends'), badge: incomingFriendRequests }
      ],
    [incomingFriendRequests, t]
  )

  const statsTotals = playerStats?.totals ?? null
  const gamesPlayed = statsTotals?.count ?? 0
  const totalUsd = statsTotals?.usd ?? 0
  const totalSol = statsTotals?.sol ?? 0
  const totalUnits = statsTotals?.units ?? 0

  const requireAuth = () => {
    onRequireAuth()
  }

  const renderRestricted = (messageKey: string) => (
    <div className="social-placeholder">
      <p>{t(messageKey)}</p>
      <button type="button" className="social-primary" onClick={requireAuth}>
        {t('social.actions.signIn')}
      </button>
    </div>
  )

  const renderLeaderboard = () => (
    <div className="social-leaderboard">
      <div className="social-leaderboard__meta">
        <div className="social-leaderboard__stat">
          <span className="social-leaderboard__label">{t('social.leaderboard.playersOnline')}</span>
          <span className="social-leaderboard__value">{formatNumber(Math.max(0, activePlayers ?? 0))}</span>
        </div>
        <div className="social-leaderboard__stat">
          <span className="social-leaderboard__label">{t('social.leaderboard.totalUsd')}</span>
          <span className="social-leaderboard__value">
            {currencyFormatter.format(Math.max(0, totalWinningsUsd ?? 0))}
          </span>
        </div>
        <div className="social-leaderboard__stat">
          <span className="social-leaderboard__label">{t('social.leaderboard.totalSol')}</span>
          <span className="social-leaderboard__value">
            {solFormatter.format(Math.max(0, totalWinningsSol ?? 0))} SOL
          </span>
        </div>
      </div>
      {winningsPriceHint ? <div className="social-leaderboard__hint">{winningsPriceHint}</div> : null}
      <div className="social-leaderboard__list" role="table">
        {leaderboardState.type === 'loading' ? (
          <div className="social-leaderboard__placeholder">{t('social.leaderboard.loading')}</div>
        ) : null}
        {leaderboardState.type === 'error' ? (
          <div className="social-leaderboard__placeholder">{leaderboardState.message}</div>
        ) : null}
        {leaderboardState.type === 'empty' ? (
          <div className="social-leaderboard__placeholder">{leaderboardState.message}</div>
        ) : null}
        {leaderboardState.type === 'ready'
          ? leaderboardEntries.map((entry, index) => (
              <div key={entry.userId} className="social-leaderboard__row" role="row">
                <div className="social-leaderboard__cell social-leaderboard__cell--rank" role="cell">
                  {index + 1}
                </div>
                <div className="social-leaderboard__cell social-leaderboard__cell--name" role="cell">
                  <div className="social-leaderboard__nickname">{entry.nickname}</div>
                  <div className="social-leaderboard__wins">
                    {t('social.leaderboard.wins', { count: formatNumber(entry.payoutCount ?? 0) })}
                  </div>
                </div>
                <div className="social-leaderboard__cell social-leaderboard__cell--amount" role="cell">
                  <div className="social-leaderboard__usd">{formatUsd(entry.totalUsd)}</div>

                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  )

  const renderProfile = () => {
    if (!isAuthenticated) {
      return renderRestricted('social.profile.loginPrompt')
    }
    return (
      <div className="social-profile">
        <div className="social-profile__header">
          <div className="social-profile__identity">
            <div className="social-profile__name">{profileName}</div>
            <div className="social-profile__email">{profileEmail || t('social.profile.noEmail')}</div>
          </div>
          <div className="social-profile__balance">
            <span className="social-profile__balance-label">{t('social.profile.balance')}</span>
            <span className="social-profile__balance-value">{formatUsd(inGameBalance)}</span>
          </div>
        </div>
        <div className="social-profile__stats">
          <div className="social-profile__stat">
            <span className="social-profile__stat-label">{t('social.profile.gamesPlayed')}</span>
            <span className="social-profile__stat-value">{formatNumber(gamesPlayed)}</span>
          </div>
          <div className="social-profile__stat">
            <span className="social-profile__stat-label">{t('social.profile.totalUsd')}</span>
            <span className="social-profile__stat-value">{currencyFormatter.format(Math.max(0, totalUsd))}</span>
          </div>
          <div className="social-profile__stat">
            <span className="social-profile__stat-label">{t('social.profile.totalSol')}</span>
            <span className="social-profile__stat-value">{solFormatter.format(Math.max(0, totalSol))} SOL</span>
          </div>
          <div className="social-profile__stat">
            <span className="social-profile__stat-label">{t('social.profile.totalUnits')}</span>
            <span className="social-profile__stat-value">{formatNumber(Math.max(0, totalUnits))}</span>
          </div>
        </div>
        <PlayerStatsChart
          series={playerStats?.series ?? []}
          loading={playerStatsLoading}
          totalUsd={totalUsd}
          totalSol={totalSol}
        />
      </div>
    )
  }

  const renderFriends = () => {
    if (!isAuthenticated) {
      return renderRestricted('social.friends.loginPrompt')
    }
    return <FriendsPanel controller={friendsController} active={open && tab === 'friends'} />
  }

  const renderSearch = () => {
    if (!isAuthenticated) {
      return renderRestricted('social.search.loginPrompt')
    }
    return <FriendSearchPanel controller={friendsController} active={open && tab === 'search'} />
  }

  const content = () => {
    switch (tab) {
      case 'leaderboard':
        return renderLeaderboard()
      case 'profile':
        return renderProfile()
      case 'friends':
        return renderFriends()
      case 'search':
        return renderSearch()
      default:
        return null
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('social.title')}
      width="760px"
      className="modal-window--social"
      bodyClassName="social-modal__body"
    >
      <div className="social-modal">
        <div className="social-modal__tabs" role="tablist">
          {tabs.map(({ key, label, badge }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`social-tab${tab === key ? ' active' : ''}`}
              onClick={() => onSelectTab(key)}
            >
              {label}
              {badge && badge > 0 ? <span className="social-tab__badge">{badge}</span> : null}
            </button>
          ))}
        </div>
        <div className="social-modal__content">{content()}</div>
      </div>
    </Modal>
  )
}

import { Link } from 'react-router-dom'
import { formatUsd } from '../utils/helpers'
import { useTranslation } from '../hooks/useTranslation'
import { Modal } from './Modal'

export type ServerBrowserTab = 'account' | 'game' | 'legal'

interface ServerBrowserModalProps {
  open: boolean
  tab: ServerBrowserTab
  onSelectTab: (tab: ServerBrowserTab) => void
  onClose: () => void
  isAuthenticated: boolean
  onRequireAuth: () => void
  onLogout?: () => void
  profileName: string
  profileEmail?: string | null
  walletAddress?: string | null
  walletUsd?: number | null
  walletSol?: number | null
  walletLoading?: boolean
  onRefreshWallet?: () => void
  onCopyWallet?: () => void
  walletCopyLabel?: string
  inGameBalance: number
  selectedSkinLabel: string
  betValue: string
  serverRegion?: string
  nicknameDraft?: string
  onNicknameDraftChange?: (value: string) => void
  onSubmitNickname?: () => void
  nicknameSaving?: boolean
  nicknameFeedback?: { type: 'success' | 'error'; message: string } | null
  nicknameSubmitDisabled?: boolean
  commissionPercent?: number
}

export function ServerBrowserModal({
  open,
  tab,
  onSelectTab,
  onClose,
  isAuthenticated,
  onRequireAuth,
  onLogout,
  profileName,
  profileEmail,
  walletAddress,
  walletUsd,
  walletSol,
  walletLoading,
  onRefreshWallet,
  onCopyWallet,
  walletCopyLabel,
  inGameBalance,
  selectedSkinLabel,
  betValue,
  serverRegion,
  nicknameDraft,
  onNicknameDraftChange,
  onSubmitNickname,
  nicknameSaving,
  nicknameFeedback,
  nicknameSubmitDisabled,
  commissionPercent
}: ServerBrowserModalProps) {
  const { t } = useTranslation()

  const walletUsdDisplay = typeof walletUsd === 'number' ? formatUsd(walletUsd) : '—'
  const walletSolDisplay =
    typeof walletSol === 'number' ? `${walletSol.toFixed(3)} SOL` : t('serverBrowser.account.walletUnknown')

  const headerActionLabel = isAuthenticated
    ? t('serverBrowser.actions.logout')
    : t('serverBrowser.actions.login')

  const headerAction = (
    <button
      type="button"
      className={`server-browser__action${isAuthenticated ? ' server-browser__action--ghost' : ''}`}
      onClick={() => {
        if (isAuthenticated) {
          onLogout?.()
        } else {
          onRequireAuth()
        }
      }}
    >
      {headerActionLabel}
    </button>
  )

  const renderAccount = () => {
    if (!isAuthenticated) {
      return (
        <div className="server-browser__placeholder">
          <p>{t('serverBrowser.account.loginPrompt')}</p>
          <button type="button" className="social-primary" onClick={onRequireAuth}>
            {t('serverBrowser.actions.login')}
          </button>
        </div>
      )
    }
    return (
      <div className="server-browser__grid">
        <section className="server-browser__section">
          <h3>{t('serverBrowser.account.profileTitle')}</h3>
          <div className="server-browser__field">
            <span className="server-browser__label">{t('serverBrowser.account.username')}</span>
            <span className="server-browser__value">{profileName}</span>
          </div>
          <div className="server-browser__field">
            <span className="server-browser__label">{t('serverBrowser.account.email')}</span>
            <span className="server-browser__value">{profileEmail ?? t('serverBrowser.account.noEmail')}</span>
          </div>
          <div className="server-browser__field">
            <span className="server-browser__label">{t('serverBrowser.account.nickname')}</span>
            <div className="server-browser__nickname">
              <input
                type="text"
                maxLength={16}
                value={nicknameDraft ?? ''}
                onChange={(event) => onNicknameDraftChange?.(event.target.value)}
                disabled={Boolean(nicknameSaving || !onNicknameDraftChange)}
              />
              <button
                type="button"
                className="server-browser__action server-browser__action--ghost"
                onClick={onSubmitNickname}
                disabled={Boolean(nicknameSubmitDisabled || !onSubmitNickname)}
              >
                {nicknameSaving ? t('serverBrowser.account.saving') : t('serverBrowser.account.save')}
              </button>
            </div>
            {nicknameFeedback ? (
              <div className={`server-browser__feedback server-browser__feedback--${nicknameFeedback.type}`}>
                {nicknameFeedback.message}
              </div>
            ) : null}
          </div>
          <p className="server-browser__hint">
            {t('serverBrowser.account.commissionInfo', { percent: commissionPercent ?? 0 })}
          </p>
          <div className="server-browser__field">
            <span className="server-browser__label">{t('serverBrowser.account.inGameBalance')}</span>
            <span className="server-browser__value">{formatUsd(inGameBalance)}</span>
          </div>
        </section>
        <section className="server-browser__section">
          <h3>{t('serverBrowser.account.walletTitle')}</h3>
          <div className="server-browser__field server-browser__field--row">
            <div>
              <span className="server-browser__label">{t('serverBrowser.account.walletAddress')}</span>
              <span className="server-browser__value server-browser__value--mono">
                {walletAddress ?? t('serverBrowser.account.walletUnknown')}
              </span>
            </div>
            <div className="server-browser__buttons">
              <button
                type="button"
                className="server-browser__icon-button"
                onClick={onCopyWallet}
                disabled={!walletAddress}
              >
                {walletCopyLabel ?? t('serverBrowser.account.copyWallet')}
              </button>
              <button
                type="button"
                className="server-browser__icon-button"
                onClick={onRefreshWallet}
                disabled={walletLoading}
              >
                {walletLoading ? t('serverBrowser.account.refreshing') : t('serverBrowser.account.refresh')}
              </button>
            </div>
          </div>
          <div className="server-browser__field">
            <span className="server-browser__label">{t('serverBrowser.account.walletUsd')}</span>
            <span className="server-browser__value">{walletUsdDisplay}</span>
          </div>
          <div className="server-browser__field">
            <span className="server-browser__label">{t('serverBrowser.account.walletSol')}</span>
            <span className="server-browser__value">{walletSolDisplay}</span>
          </div>
        </section>
      </div>
    )
  }

  const renderGame = () => (
    <div className="server-browser__grid">
      <section className="server-browser__section">
        <h3>{t('serverBrowser.game.sessionTitle')}</h3>
        <div className="server-browser__field">
          <span className="server-browser__label">{t('serverBrowser.game.skin')}</span>
          <span className="server-browser__value">{selectedSkinLabel}</span>
        </div>
        <div className="server-browser__field">
          <span className="server-browser__label">{t('serverBrowser.game.bet')}</span>
          <span className="server-browser__value">{betValue || t('serverBrowser.game.noBet')}</span>
        </div>
        <div className="server-browser__field">
          <span className="server-browser__label">{t('serverBrowser.game.region')}</span>
          <span className="server-browser__value">{serverRegion ?? t('serverBrowser.game.regionUnknown')}</span>
        </div>
      </section>
      <section className="server-browser__section">
        <h3>{t('serverBrowser.game.tipsTitle')}</h3>
        <p className="server-browser__hint">{t('serverBrowser.game.tipsBody')}</p>
      </section>
    </div>
  )

  const renderLegal = () => (
    <div className="server-browser__grid">
      <section className="server-browser__section">
        <h3>{t('serverBrowser.legal.documentsTitle')}</h3>
        <ul className="server-browser__links">
          <li>
            <Link to="/terms-of-service">{t('serverBrowser.legal.terms')}</Link>
          </li>
          <li>
            <Link to="/privacy-policy">{t('serverBrowser.legal.privacy')}</Link>
          </li>
        </ul>
      </section>
      <section className="server-browser__section">
        <h3>{t('serverBrowser.legal.contactTitle')}</h3>
        <p className="server-browser__hint">{t('serverBrowser.legal.contactBody')}</p>
        <a className="server-browser__cta" href="mailto:support@snakefans.com">
          support@snakefans.com
        </a>
      </section>
    </div>
  )

  const content = () => {
    switch (tab) {
      case 'account':
        return renderAccount()
      case 'game':
        return renderGame()
      case 'legal':
        return renderLegal()
      default:
        return null
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('serverBrowser.title')}
      width="760px"
      className="modal-window--server-browser"
      bodyClassName="server-browser__body"
      headerActions={headerAction}
    >
      <div className="server-browser">
        <div className="server-browser__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'account'}
            className={`server-browser__tab${tab === 'account' ? ' active' : ''}`}
            onClick={() => onSelectTab('account')}
          >
            {t('serverBrowser.tabs.account')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'game'}
            className={`server-browser__tab${tab === 'game' ? ' active' : ''}`}
            onClick={() => onSelectTab('game')}
          >
            {t('serverBrowser.tabs.game')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'legal'}
            className={`server-browser__tab${tab === 'legal' ? ' active' : ''}`}
            onClick={() => onSelectTab('legal')}
          >
            {t('serverBrowser.tabs.legal')}
          </button>
        </div>
        <div className="server-browser__content">{content()}</div>
      </div>
    </Modal>
  )
}

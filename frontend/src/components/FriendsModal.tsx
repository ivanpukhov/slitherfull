import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type FriendRequestEntry,
  type FriendSearchResult,
  type FriendSummary,
  type UseFriendsResult
} from '../hooks/useFriends'
import { useTranslation } from '../hooks/useTranslation'

type TabKey = 'friends' | 'outgoing' | 'incoming'

const TAB_LABEL_KEYS: Record<TabKey, string> = {
  friends: 'friends.tabs.friends',
  outgoing: 'friends.tabs.outgoing',
  incoming: 'friends.tabs.incoming'
}

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  unauthorized: 'friends.errors.unauthorized',
  invalid_payload: 'friends.errors.invalidPayload',
  cannot_friend_self: 'friends.errors.cannotSelf',
  user_not_found: 'friends.errors.userNotFound',
  already_friends: 'friends.errors.alreadyFriends',
  already_requested: 'friends.errors.alreadyRequested',
  request_failed: 'friends.errors.requestFailed',
  friends_unavailable: 'friends.errors.unavailable',
  search_failed: 'friends.errors.searchFailed'
}

interface FriendsPanelProps {
  controller: UseFriendsResult
  active: boolean
}

export function FriendsPanel({ controller, active }: FriendsPanelProps) {
  const { friends, outgoing, incoming, loading, error, refresh, search, sendRequest, acceptRequest } = controller
  const [activeTab, setActiveTab] = useState<TabKey>('friends')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FriendSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (!active) return
    refresh()
  }, [active, refresh])

  useEffect(() => {
    if (!active) {
      setActiveTab('friends')
      setQuery('')
      setResults([])
      setSearchError(null)
      setActionError(null)
      setSearching(false)
      return
    }
    if (query.trim().length < 2) {
      setResults([])
      setSearchError(null)
      setSearching(false)
      return
    }
    setSearching(true)
    const handle = window.setTimeout(() => {
      search(query.trim())
        .then((list) => {
          setResults(list)
          setSearchError(null)
        })
        .catch((err: Error) => {
          setResults([])
          setSearchError(getErrorMessage(err.message, t) || t('friends.feedback.searchFailed'))
        })
        .finally(() => {
          setSearching(false)
        })
    }, 250)
    debounceRef.current = handle
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [active, query, search, t])

  const friendlyError = useMemo(() => {
    if (actionError) return getErrorMessage(actionError, t) || t('friends.feedback.actionFailed')
    if (error) return getErrorMessage(error, t) || t('friends.feedback.loadFailed')
    return null
  }, [actionError, error, t])

  const handleSend = async (userId: number) => {
    try {
      setActionError(null)
      await sendRequest(userId)
      setActiveTab('outgoing')
      setResults([])
      setQuery('')
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  const handleAccept = async (requestId: number) => {
    try {
      setActionError(null)
      await acceptRequest(requestId)
      setActiveTab('friends')
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  const renderFriend = (entry: FriendSummary) => (
    <li key={entry.id} className="friends-row">
      <div className="friends-row-body">
        <div className="friends-row-name">{entry.nickname}</div>
        <div className="friends-row-meta">{entry.email}</div>
      </div>
      {entry.since ? (
        <div className="friends-row-since">
          {t('friends.labels.since', { date: new Date(entry.since).toLocaleDateString() })}
        </div>
      ) : null}
    </li>
  )

  const renderRequest = (entry: FriendRequestEntry, kind: 'incoming' | 'outgoing') => (
    <li key={entry.requestId} className="friends-row">
      <div className="friends-row-body">
        <div className="friends-row-name">{entry.nickname}</div>
        <div className="friends-row-meta">{entry.email}</div>
      </div>
      <div className="friends-row-actions">
        {kind === 'incoming' ? (
          <button type="button" className="friends-action" onClick={() => handleAccept(entry.requestId)}>
            {t('friends.actions.accept')}
          </button>
        ) : (
          <span className="friends-row-status">{t('friends.status.pending')}</span>
        )}
      </div>
    </li>
  )

  const renderSearchResult = (entry: FriendSearchResult) => {
    let actionNode: JSX.Element | null = null
    if (entry.status === 'friends') {
      actionNode = <span className="friends-row-status">{t('friends.status.friends')}</span>
    } else if (entry.status === 'outgoing') {
      actionNode = <span className="friends-row-status">{t('friends.status.requestSent')}</span>
    } else if (entry.status === 'incoming' && entry.requestId) {
      actionNode = (
        <button type="button" className="friends-action" onClick={() => handleAccept(entry.requestId!)}>
          {t('friends.actions.accept')}
        </button>
      )
    } else {
      actionNode = (
        <button type="button" className="friends-action" onClick={() => handleSend(entry.id)}>
          {t('friends.actions.addFriend')}
        </button>
      )
    }
    return (
      <li key={entry.id} className="friends-row">
        <div className="friends-row-body">
          <div className="friends-row-name">{entry.nickname}</div>
          <div className="friends-row-meta">{entry.email}</div>
        </div>
        <div className="friends-row-actions">{actionNode}</div>
      </li>
    )
  }

  const friendsContent = useMemo(() => {
    if (loading && friends.length === 0) {
      return <div className="friends-empty">{t('friends.feedback.loading')}</div>
    }
    if (friends.length === 0) {
      return <div className="friends-empty">{t('friends.feedback.noFriends')}</div>
    }
    return <ul className="friends-list">{friends.map(renderFriend)}</ul>
  }, [friends, loading, t])

  const outgoingContent = useMemo(() => {
    if (outgoing.length === 0) {
      return <div className="friends-empty">{t('friends.feedback.noOutgoing')}</div>
    }
    return <ul className="friends-list">{outgoing.map((entry) => renderRequest(entry, 'outgoing'))}</ul>
  }, [outgoing, t])

  const incomingContent = useMemo(() => {
    if (incoming.length === 0) {
      return <div className="friends-empty">{t('friends.feedback.noIncoming')}</div>
    }
    return <ul className="friends-list">{incoming.map((entry) => renderRequest(entry, 'incoming'))}</ul>
  }, [incoming, t])

  const searchHint = query.trim().length > 0 && query.trim().length < 2 ? t('friends.search.hint') : null

  return (
    <div className="friends-modal">
      <div className="friends-tabs" role="tablist">
        {(Object.keys(TAB_LABEL_KEYS) as TabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === activeTab}
            className={`friends-tab${tab === activeTab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(TAB_LABEL_KEYS[tab])}
            {tab === 'incoming' && incoming.length > 0 ? <span className="friends-tab-badge">{incoming.length}</span> : null}
          </button>
        ))}
      </div>
      <div className="friends-search">
        <label htmlFor="friendSearch">{t('friends.search.label')}</label>
        <input
          id="friendSearch"
          type="search"
          placeholder={t('friends.search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!active}
        />
        {searchHint ? <div className="friends-search-hint">{searchHint}</div> : null}
      </div>
      {searching ? <div className="friends-empty">{t('friends.search.searching')}</div> : null}
      {!searching && results.length > 0 ? (
        <ul className="friends-list friends-search-results">{results.map(renderSearchResult)}</ul>
      ) : null}
      {!searching && searchError ? <div className="friends-error">{searchError}</div> : null}
      <div className="friends-section" role="tabpanel">
        {activeTab === 'friends' ? friendsContent : null}
        {activeTab === 'outgoing' ? outgoingContent : null}
        {activeTab === 'incoming' ? incomingContent : null}
      </div>
      {friendlyError ? <div className="friends-error">{friendlyError}</div> : null}
    </div>
  )
}

interface FriendsModalProps {
  open: boolean
  controller: UseFriendsResult
  onClose: () => void
}

export function FriendsModal({ open, controller, onClose }: FriendsModalProps) {
  const { t } = useTranslation()
  return (
    <Modal open={open} title={t('friends.modal.title')} onClose={onClose} width="640px">
      <FriendsPanel controller={controller} active={open} />
    </Modal>
  )
}

function getErrorMessage(code: string | null | undefined, t: ReturnType<typeof useTranslation>['t']) {
  if (!code) return null
  const key = ERROR_MESSAGE_KEYS[code]
  return key ? t(key) : null
}

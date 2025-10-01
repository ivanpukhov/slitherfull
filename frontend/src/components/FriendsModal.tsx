import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { useFriends, type FriendRequestEntry, type FriendSearchResult, type FriendSummary } from '../hooks/useFriends'

type TabKey = 'friends' | 'outgoing' | 'incoming'

const TAB_LABELS: Record<TabKey, string> = {
  friends: 'My friends',
  outgoing: 'Outgoing requests',
  incoming: 'Incoming requests'
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Sign in to manage friends.',
  invalid_payload: 'Something went wrong. Try again.',
  cannot_friend_self: 'You cannot add yourself.',
  user_not_found: 'User not found.',
  already_friends: 'You are already friends.',
  already_requested: 'Request already sent.',
  request_failed: 'Unable to send request.',
  friends_unavailable: 'Unable to load friends right now.'
}

interface FriendsModalProps {
  open: boolean
  token: string | null
  onClose: () => void
}

export function FriendsModal({ open, token, onClose }: FriendsModalProps) {
  const { friends, outgoing, incoming, loading, error, refresh, search, sendRequest, acceptRequest } =
    useFriends(token)
  const [activeTab, setActiveTab] = useState<TabKey>('friends')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FriendSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) {
      setActiveTab('friends')
      setQuery('')
      setResults([])
      setSearchError(null)
      setActionError(null)
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
          setSearchError(ERROR_MESSAGES[err.message] || 'Search failed.')
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
  }, [open, query, search])

  const friendlyError = useMemo(() => {
    if (actionError && ERROR_MESSAGES[actionError]) return ERROR_MESSAGES[actionError]
    if (actionError) return 'Action failed. Try again later.'
    if (error && ERROR_MESSAGES[error]) return ERROR_MESSAGES[error]
    if (error) return 'Unable to load friends.'
    return null
  }, [actionError, error])

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
      {entry.since ? <div className="friends-row-since">Since {new Date(entry.since).toLocaleDateString()}</div> : null}
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
            Accept
          </button>
        ) : (
          <span className="friends-row-status">Pending</span>
        )}
      </div>
    </li>
  )

  const renderSearchResult = (entry: FriendSearchResult) => {
    let actionNode: JSX.Element | null = null
    if (entry.status === 'friends') {
      actionNode = <span className="friends-row-status">Friends</span>
    } else if (entry.status === 'outgoing') {
      actionNode = <span className="friends-row-status">Request sent</span>
    } else if (entry.status === 'incoming' && entry.requestId) {
      actionNode = (
        <button type="button" className="friends-action" onClick={() => handleAccept(entry.requestId!)}>
          Accept
        </button>
      )
    } else {
      actionNode = (
        <button type="button" className="friends-action" onClick={() => handleSend(entry.id)}>
          Add friend
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
      return <div className="friends-empty">Loading friends…</div>
    }
    if (friends.length === 0) {
      return <div className="friends-empty">No friends yet. Search for a player to start.</div>
    }
    return <ul className="friends-list">{friends.map(renderFriend)}</ul>
  }, [friends, loading])

  const outgoingContent = useMemo(() => {
    if (outgoing.length === 0) {
      return <div className="friends-empty">You have no pending requests.</div>
    }
    return <ul className="friends-list">{outgoing.map((entry) => renderRequest(entry, 'outgoing'))}</ul>
  }, [outgoing])

  const incomingContent = useMemo(() => {
    if (incoming.length === 0) {
      return <div className="friends-empty">No new requests yet.</div>
    }
    return <ul className="friends-list">{incoming.map((entry) => renderRequest(entry, 'incoming'))}</ul>
  }, [incoming])

  const searchHint = query.trim().length > 0 && query.trim().length < 2 ? 'Enter at least 2 characters.' : null

  return (
    <Modal open={open} title="Manage friends" onClose={onClose} width="640px">
      <div className="friends-modal">
        <div className="friends-tabs" role="tablist">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === activeTab}
              className={`friends-tab${tab === activeTab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
              {tab === 'incoming' && incoming.length > 0 ? <span className="friends-tab-badge">{incoming.length}</span> : null}
            </button>
          ))}
        </div>
        <div className="friends-search">
          <label htmlFor="friendSearch">Find players</label>
          <input
            id="friendSearch"
            type="search"
            placeholder="Search by email or nickname"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {searchHint ? <div className="friends-search-hint">{searchHint}</div> : null}
        </div>
        {searching ? <div className="friends-empty">Searching…</div> : null}
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
    </Modal>
  )
}

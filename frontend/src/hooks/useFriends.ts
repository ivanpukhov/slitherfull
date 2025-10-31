import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

export interface FriendSummary {
  id: number
  nickname: string
  email: string
  since: string | null
}

export interface FriendRequestEntry {
  requestId: number
  userId: number
  nickname: string
  email: string
  createdAt: string
}

export interface FriendSearchResult {
  id: number
  nickname: string
  email: string
  status: 'none' | 'friends' | 'outgoing' | 'incoming'
  requestId: number | null
}

interface FriendOverviewResponse {
  friends: { id: number; since: string | null; user: { id: number; nickname: string; email: string } | null }[]
  outgoing: { id: number; createdAt: string; user: { id: number; nickname: string; email: string } | null }[]
  incoming: { id: number; createdAt: string; user: { id: number; nickname: string; email: string } | null }[]
}

interface UseFriendsState {
  friends: FriendSummary[]
  outgoing: FriendRequestEntry[]
  incoming: FriendRequestEntry[]
}

const EMPTY_STATE: UseFriendsState = { friends: [], outgoing: [], incoming: [] }

function mapOverview(data: FriendOverviewResponse | null): UseFriendsState {
  if (!data) return EMPTY_STATE
  return {
    friends: data.friends
      .filter((entry) => entry.user)
      .map((entry) => ({
        id: entry.user!.id,
        nickname: entry.user!.nickname,
        email: entry.user!.email,
        since: entry.since || null
      })),
    outgoing: data.outgoing
      .filter((entry) => entry.user)
      .map((entry) => ({
        requestId: entry.id,
        userId: entry.user!.id,
        nickname: entry.user!.nickname,
        email: entry.user!.email,
        createdAt: entry.createdAt
      })),
    incoming: data.incoming
      .filter((entry) => entry.user)
      .map((entry) => ({
        requestId: entry.id,
        userId: entry.user!.id,
        nickname: entry.user!.nickname,
        email: entry.user!.email,
        createdAt: entry.createdAt
      }))
  }
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => null)
  return data
}

export function useFriends(token: string | null) {
  const [state, setState] = useState<UseFriendsState>(EMPTY_STATE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!token) {
        throw new Error('unauthorized')
      }
      const headers = new Headers(init?.headers)
      headers.set('Authorization', `Bearer ${token}`)
      if (!headers.has('Content-Type') && init?.body) {
        headers.set('Content-Type', 'application/json')
      }
      return fetch(input, { ...init, headers })
    },
    [token]
  )

  const refresh = useCallback(async () => {
    if (!token) {
      setState(EMPTY_STATE)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/api/friends`)
      if (!response.ok) {
        const body = await readJson(response)
        throw new Error(body?.error || 'friends_unavailable')
      }
      const payload = await response.json()
      setState(mapOverview(payload.data as FriendOverviewResponse))
    } catch (err) {
      setError((err as Error).message)
      setState(EMPTY_STATE)
    } finally {
      setLoading(false)
    }
  }, [authorizedFetch, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const search = useCallback(
    async (query: string) => {
      if (!token) return [] as FriendSearchResult[]
      const trimmed = query.trim()
      if (!trimmed) return []
      const response = await authorizedFetch(
        `${API_BASE_URL}/api/friends/search?query=${encodeURIComponent(trimmed)}`
      )
      if (!response.ok) {
        const body = await readJson(response)
        throw new Error(body?.error || 'search_failed')
      }
      const payload = await response.json()
      return (payload.results as FriendSearchResult[]) || []
    },
    [authorizedFetch, token]
  )

  const sendRequest = useCallback(
    async (targetId: number) => {
      if (!token) {
        throw new Error('unauthorized')
      }
      const response = await authorizedFetch(`${API_BASE_URL}/api/friends/requests`, {
        method: 'POST',
        body: JSON.stringify({ targetId })
      })
      if (!response.ok) {
        const body = await readJson(response)
        throw new Error(body?.error || 'request_failed')
      }
      const payload = await response.json()
      setState(mapOverview(payload.data as FriendOverviewResponse))
    },
    [authorizedFetch, token]
  )

  const acceptRequest = useCallback(
    async (requestId: number) => {
      if (!token) {
        throw new Error('unauthorized')
      }
      const response = await authorizedFetch(
        `${API_BASE_URL}/api/friends/requests/${requestId}/accept`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const body = await readJson(response)
        throw new Error(body?.error || 'request_failed')
      }
      const payload = await response.json()
      setState(mapOverview(payload.data as FriendOverviewResponse))
    },
    [authorizedFetch, token]
  )

  const hasFriends = useMemo(() => state.friends.length > 0, [state.friends.length])

  return {
    ...state,
    loading,
    error,
    refresh,
    search,
    sendRequest,
    acceptRequest,
    hasFriends
  }
}

export type UseFriendsResult = ReturnType<typeof useFriends>

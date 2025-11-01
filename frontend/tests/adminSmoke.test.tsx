import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { renderHook, act } from '@testing-library/react'
import { useAdminSession } from '../src/hooks/useAdminSession'
import { AdminDashboard } from '../src/components/AdminDashboard'
import { useAdminAudit } from '../src/hooks/useAdminAudit'
import { MockEventSource } from './setup'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

function createResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  })
}

describe('admin smoke scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
    MockEventSource.instances.length = 0
  })

  it('logs in and stores admin session', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      createResponse({ token: 'token-123', role: 'superadmin', email: 'admin@example.com' })
    )

    const { result } = renderHook(() => useAdminSession())

    await act(async () => {
      const outcome = await result.current.login('admin@example.com', 'secret')
      expect(outcome.ok).toBe(true)
    })

    expect(result.current.session?.token).toBe('token-123')
    expect(window.localStorage.getItem('admin_session')).toContain('token-123')
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/admin/login`, expect.any(Object))
  })

  it('renders overview, performs transfer and ban/unban actions', async () => {
    window.localStorage.setItem(
      'admin_session',
      JSON.stringify({ token: 'token-xyz', role: 'superadmin', email: 'root@example.com' })
    )

    const overviewPayload = {
      data: {
        users: [
          {
            id: 1,
            email: 'alice@example.com',
            nickname: 'alice',
            walletAddress: 'wallet-1',
            walletLamports: 4200,
            walletSol: 0.42,
            inGameBalance: 120,
            status: 'active'
          },
          {
            id: 2,
            email: 'bob@example.com',
            nickname: 'bob',
            walletAddress: 'wallet-2',
            walletLamports: 7200,
            walletSol: 1.12,
            inGameBalance: 80,
            status: 'banned'
          }
        ],
        gameWallet: {
          walletAddress: 'game-wallet',
          walletLamports: 100000,
          walletSol: 4.5
        },
        totals: { totalBanned: 1 },
        permissions: {
          canManageUsers: true,
          canTransfer: true,
          canViewMetrics: true
        }
      }
    }

    const metricsPayload = {
      data: {
        labels: {
          activePlayers: 'Active players',
          revenueSol: 'Revenue',
          sessions: 'Sessions'
        },
        series: {
          activePlayers: [{ timestamp: Date.now(), value: 24 }],
          revenueSol: [{ timestamp: Date.now(), value: 1.5 }],
          sessions: [{ timestamp: Date.now(), value: 45 }]
        }
      }
    }

    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.endsWith('/api/admin/overview')) {
        return Promise.resolve(createResponse(overviewPayload))
      }
      if (url.endsWith('/api/admin/metrics')) {
        return Promise.resolve(createResponse(metricsPayload))
      }
      if (url.endsWith('/api/admin/transfer')) {
        return Promise.resolve(createResponse({ ok: true }))
      }
      if (url.includes('/api/admin/users/2/ban')) {
        return Promise.resolve(createResponse({ ok: true }))
      }
      if (url.includes('/api/admin/users/2/unban')) {
        return Promise.resolve(createResponse({ ok: true }))
      }
      return Promise.resolve(createResponse({ ok: true }))
    })

    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    )

    const row = await screen.findByText('alice@example.com')
    expect(row).toBeInTheDocument()

    const recipientSelect = await screen.findByLabelText(/Recipient/i)
    await user.selectOptions(recipientSelect, '1')

    const amountInput = screen.getByLabelText(/Amount/i)
    await user.clear(amountInput)
    await user.type(amountInput, '10')

    const transferButton = screen.getByRole('button', { name: /Transfer/i })
    await user.click(transferButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/admin/transfer`,
        expect.objectContaining({ method: 'POST' })
      )
    })

    const [banButton] = await screen.findAllByRole('button', { name: /^Ban$/i })
    await user.click(banButton)

    const [banModalTitle] = await screen.findAllByText(/Ban user/i)
    const modal = banModalTitle.closest('.admin-modal')
    if (!modal) throw new Error('Ban confirmation modal not found')
    const confirmBan = within(modal).getByRole('button', { name: /^Ban$/i })
    await user.click(confirmBan)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/1/ban'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    const [unbanButton] = await screen.findAllByRole('button', { name: /Unban/i })
    await user.click(unbanButton)
    const [unbanModalTitle] = await screen.findAllByText(/Unban user/i)
    const unbanModal = unbanModalTitle.closest('.admin-modal')
    if (!unbanModal) throw new Error('Unban confirmation modal not found')
    const confirmUnban = within(unbanModal).getByRole('button', { name: /Unban/i })
    await user.click(confirmUnban)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/2/unban'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  it('fetches audit entries and reacts to stream updates', async () => {
    const auditPayload = {
      data: [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          actorEmail: 'admin@example.com',
          actorRole: 'superadmin',
          action: 'login',
          subject: 'root@example.com'
        }
      ]
    }

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(createResponse(auditPayload))
    const { result } = renderHook(() => useAdminAudit('token-stream', { action: 'login' }))

    await waitFor(() => {
      expect(result.current.entries.length).toBe(1)
    })

    const stream = MockEventSource.instances.at(-1)
    await act(async () => {
      stream?.emit(
        'message',
        JSON.stringify({
          entry: {
            id: '2',
            timestamp: new Date().toISOString(),
            actorEmail: 'root@example.com',
            actorRole: 'manager',
            action: 'transfer',
            subject: 'user#2'
          }
        })
      )
    })

    await waitFor(() => {
      expect(result.current.entries[0].id).toBe('2')
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/admin/audit?action=login`,
      expect.objectContaining({ headers: expect.any(Object) })
    )
  })
})

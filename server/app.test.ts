import type { Pool } from 'pg'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripeMockState = vi.hoisted(() => ({
  checkoutCreate: vi.fn(async () => ({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
  })),
  checkoutRetrieve: vi.fn(async () => ({
    customer: 'cus_test_123',
    subscription: 'sub_test_123',
    payment_status: 'paid',
    status: 'complete',
  })),
  portalCreate: vi.fn(async () => ({
    url: 'https://billing.stripe.com/session/test_123',
  })),
  constructEvent: vi.fn(() => ({
    type: 'checkout.session.completed',
  })),
}))

vi.mock('stripe', () => {
  class Stripe {
    checkout = {
      sessions: {
        create: stripeMockState.checkoutCreate,
        retrieve: stripeMockState.checkoutRetrieve,
      },
    }

    billingPortal = {
      sessions: {
        create: stripeMockState.portalCreate,
      },
    }

    webhooks = {
      constructEvent: stripeMockState.constructEvent,
    }
  }

  return {
    default: Stripe,
  }
})

import { createApp } from './app'

function createDatabaseStub() {
  return {
    query: vi.fn(async () => ({
      rows: [],
      rowCount: 1,
    })),
  } as unknown as Pool
}

describe('persistence API', () => {
  beforeEach(() => {
    process.env.STRIPE_TEST_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_LIVE_SECRET_KEY = 'sk_live_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    vi.clearAllMocks()
  })

  it('reports database health', async () => {
    const response = await request(createApp(createDatabaseStub())).get(
      '/api/health',
    )

    expect(response.status).toBe(200)
    expect(response.body.database).toBe('connected')
  })

  it('returns the latest OpenBcon commit for the admin update check', async () => {
    const latestCommit = 'd'.repeat(40)
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      sha: latestCommit,
      html_url: 'https://github.com/adm73/OpenBcon/commit/latest',
      commit: {
        message: 'chore: publish release',
        author: { date: '2026-08-04T12:00:00.000Z' },
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)

    try {
      const response = await request(createApp(createDatabaseStub())).get(
        '/api/updates?currentCommit=eeeeeeeeeeee',
      )

      expect(response.status).toBe(200)
      expect(response.body.latestShortCommit).toBe(latestCommit.slice(0, 12))
      expect(response.body.updateAvailable).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns an empty bootstrap payload for a new workspace', async () => {
    const response = await request(createApp(createDatabaseStub())).get(
      '/api/bootstrap',
    )

    expect(response.status).toBe(200)
    expect(response.body.values).toEqual({})
  })

  it('authenticates a database user with its password hash', async () => {
    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('FROM app_users')) {
          return {
            rows: [{
              id: '1',
              email: 'alex@northstarfoods.ca',
              display_name: 'Alex Morgan',
              role: 'owner',
              created_at: new Date('2026-07-31T00:00:00.000Z'),
            }],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/auth/login')
      .send({
        email: 'alex@northstarfoods.ca',
        password: 'BconDev-Alex-2026!7fQ9mZ2',
      })

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      id: '1',
      email: 'alex@northstarfoods.ca',
      fullName: 'Alex Morgan',
    })
    expect(response.body.user.password).toBeUndefined()
  })

  it('rejects authentication tokens as persistent state', async () => {
    const response = await request(createApp(createDatabaseStub()))
      .put('/api/state/bconomics-access-token')
      .send({
        scope: 'user',
        value: 'secret',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('invalid_request')
  })

  it('creates a Stripe checkout session from payment settings', async () => {
    const response = await request(createApp(createDatabaseStub()))
      .post('/api/payments/stripe/checkout-session')
      .send({
        billingCycle: 'monthly',
        customerEmail: 'alex@northstarfoods.ca',
        platformName: 'Bconomics.ai',
        payments: {
          enabled: true,
          provider: 'stripe',
          currency: 'CAD',
          testMode: true,
          webhookUrl: '/api/webhooks/stripe',
          testSecretKeyReference: 'STRIPE_TEST_SECRET_KEY',
          liveSecretKeyReference: 'STRIPE_LIVE_SECRET_KEY',
          webhookSecretReference: 'STRIPE_WEBHOOK_SECRET',
          checkoutSuccessUrl: '',
          checkoutCancelUrl: '',
          billingPortalReturnUrl: '',
        },
      })

    expect(response.status).toBe(201)
    expect(response.body.url).toBe(
      'https://checkout.stripe.com/pay/cs_test_123',
    )
    expect(stripeMockState.checkoutCreate).toHaveBeenCalledOnce()
  })
})

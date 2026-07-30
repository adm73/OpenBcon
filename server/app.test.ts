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

  it('returns an empty bootstrap payload for a new workspace', async () => {
    const response = await request(createApp(createDatabaseStub())).get(
      '/api/bootstrap',
    )

    expect(response.status).toBe(200)
    expect(response.body.values).toEqual({})
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

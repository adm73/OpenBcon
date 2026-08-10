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

  it('reports the server mode instead of trusting a client mode header', async () => {
    const response = await request(createApp(createDatabaseStub()))
      .get('/api/runtime/environment')
      .set('x-openbcon-environment-mode', 'live')

    expect(response.status).toBe(200)
    expect(response.body.activeEnvironmentMode).toBe('test')
    expect(response.body.environmentMode).toBe('test')
    expect(response.body.requestedEnvironmentMode).toBeNull()
    expect(response.body.restartRequired).toBe(false)
  })

  it('returns active funding programs from the current workspace database', async () => {
    const database = {
      query: vi.fn(async (query: string, _params: unknown[] = []) => {
        if (query.includes('FROM funding_programs')) {
          return {
            rows: [{
              id: 'program-1',
              pid: '1000000000000001',
              language: 'zh-CN',
              name: 'Database Growth Grant',
              provider: 'Database Provider',
              category: 'Grant',
              funding_amount: '125000',
              deadline: 'Open',
              match_score: 88,
              program_url: 'https://example.com/program',
              location: 'Ontario',
              country: 'Canada',
              description: 'A database-backed opportunity.',
              process: 'Contact the provider, prepare the evidence, and submit the application.',
              eligibility: 'Ontario businesses.',
              eligible_uses: 'Equipment and hiring.',
              target_company_types: 'Growth businesses.',
              required_evidence: 'Business plan.',
              source_type: 'manual',
              source_id: 'database-catalog',
              source_record_id: 'program-1',
              source_version: 'v1',
              record_version: 'v1-program-1',
              status: 'active',
            }],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    const response = await request(createApp(database)).get(
      '/api/funding-programs?language=zh-CN',
    )

    expect(response.status).toBe(200)
    expect(response.body.programs).toEqual([
      expect.objectContaining({
        id: 'program-1',
        pid: '1000000000000001',
        language: 'zh-CN',
        name: 'Database Growth Grant',
        type: 'Grant',
        amount: 125000,
        country: 'Canada',
        process: 'Contact the provider, prepare the evidence, and submit the application.',
        sourceName: 'database-catalog',
      }),
    ])
  })

  it('imports a manual funding program into the workspace database', async () => {
    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('INSERT INTO funding_programs')) {
          return {
            rows: [{
              id: 'program-manual-1',
              pid: '1000000000000014',
              name: 'Manual Equipment Grant',
              provider: 'Local Growth Agency',
              category: 'Grant',
              funding_amount: '75000',
              deadline: 'Open',
              match_score: 80,
              program_url: 'https://example.com/manual-program',
              location: 'Ontario',
              country: 'Canada',
              description: 'A manually imported program.',
              process: 'Contact the agency and submit the project budget.',
              eligibility: 'Ontario businesses.',
              eligible_uses: 'Equipment.',
              target_company_types: 'Growth businesses.',
              required_evidence: 'Budget and business profile.',
              source_type: 'manual',
              source_id: 'manual-import',
              source_record_id: 'manual-record-1',
              source_version: 'manual-v1',
              record_version: 'manual-record-v1',
              status: 'active',
            }],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/funding-programs')
      .send({
        name: 'Manual Equipment Grant',
        fundingType: 'Grant',
        provider: 'Local Growth Agency',
        amount: 75000,
        deadline: 'Open',
        programUrl: 'https://example.com/manual-program',
        location: 'Ontario',
        country: 'Canada',
        description: 'A manually imported program.',
        process: 'Contact the agency and submit the project budget.',
        eligibility: 'Ontario businesses.',
        eligibleUses: 'Equipment.',
        targetCompanyTypes: 'Growth businesses.',
        requiredEvidence: 'Budget and business profile.',
        matchScore: 80,
      })

    expect(response.status).toBe(201)
    expect(response.body.program).toEqual(expect.objectContaining({
      id: 'program-manual-1',
      pid: '1000000000000014',
      name: 'Manual Equipment Grant',
      sourceType: 'manual',
      sourceName: 'manual-import',
    }))
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("'manual'"),
      expect.any(Array),
    )
  })

  it('imports and upserts a JSON funding catalog', async () => {
    const importedRow = {
      id: 'program-json-1',
      pid: '1000000000000099',
      language: 'zh-CN',
      name: 'Community Loan',
      provider: 'Regional Fund',
      category: 'Loan',
      funding_amount: '70000',
      deadline: 'Open',
      program_status: 'Accepting applications',
      match_score: 0,
      program_url: 'https://example.ca/loan',
      location: 'British Columbia',
      country: 'Canada',
      description: 'A JSON-imported loan.',
      process: 'Contact the provider.',
      eligibility: 'Canadian businesses.',
      eligible_uses: 'Working capital.',
      target_company_types: '',
      required_evidence: '',
      source_type: 'json-file',
      source_id: 'json-loans',
      source_record_id: 'json-record-1',
      source_version: 'json-version-1',
      record_version: 'json-version-1',
      status: 'active',
    }
    const client = {
      query: vi.fn(async (query: string, _params: unknown[] = []) => {
        if (query.includes('RETURNING (xmax = 0)')) {
          return { rows: [{ inserted: true }], rowCount: 1 }
        }
        if (query.includes('SELECT count(*)')) {
          return { rows: [{ count: '0' }], rowCount: 1 }
        }
        if (query.includes('FROM funding_programs')) {
          return { rows: [importedRow], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    const database = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      connect: vi.fn(async () => client),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/funding-programs/import')
      .send({
        sourceId: 'json-loans',
        sourceName: 'Loan programs JSON',
        category: 'Loan',
        language: 'zh-CN',
        records: [{
          program_name: 'Community Loan',
          provider: 'Regional Fund',
          official_program_site: 'https://example.ca/loan',
          max_amount: 'Maximum: $70,000',
          location: ['British Columbia'],
          description: 'A JSON-imported loan.',
          how_to_start: ['Contact the provider.'],
          eligibility: ['Canadian businesses.'],
          eligible_uses: ['Working capital.'],
          status: 'Accepting applications',
          status_active: false,
        }],
      })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      imported: 1,
      updated: 0,
      archived: 0,
      programs: [expect.objectContaining({
        name: 'Community Loan',
        type: 'Loan',
        sourceType: 'json-file',
        programStatus: 'Accepting applications',
      })],
    })
    const insertCall = client.query.mock.calls.find(([query]) =>
      query.includes('RETURNING (xmax = 0)'),
    )
    expect(insertCall?.[1]?.[6]).toBe('zh-CN')
    expect(insertCall?.[1]?.[20]).toBe('active')
    expect(client.release).toHaveBeenCalled()
  })

  it('does not archive a JSON source before the final sync chunk', async () => {
    const clientQueries: string[] = []
    const client = {
      query: vi.fn(async (query: string) => {
        clientQueries.push(query)
        if (query.includes('RETURNING (xmax = 0)')) {
          return { rows: [{ inserted: true }], rowCount: 1 }
        }
        if (query.includes('FROM funding_programs')) {
          return { rows: [], rowCount: 0 }
        }
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    const database = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      connect: vi.fn(async () => client),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/funding-programs/import')
      .send({
        sourceId: 'json-grants',
        sourceName: 'Grant programs JSON',
        category: 'Grant',
        syncComplete: false,
        syncRecordIds: ['json-record-1', 'json-record-2'],
        records: [{
          program_name: 'Community Grant',
          provider: 'Regional Fund',
          official_program_site: 'https://example.ca/grant',
        }],
      })

    expect(response.status).toBe(200)
    expect(response.body.archived).toBe(0)
    expect(clientQueries.some((query) => query.includes('WITH archived'))).toBe(false)
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
      expect(response.body).toHaveProperty('automaticUpdatesConfigured')
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

  it('creates password accounts, signs them in, and sends verification email', async () => {
    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('WITH new_user')) {
          return {
            rows: [{
              id: '7',
              email: 'new@example.test',
              display_name: 'New User',
              role: 'owner',
              created_at: new Date('2026-07-31T00:00:00.000Z'),
              workspace_id: '00000000-0000-4000-8000-000000000003',
            }],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/auth/register')
      .send({
        fullName: 'New User',
        companyName: 'New Company',
        email: 'new@example.test',
        password: 'TestPassword-2026!',
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      user: {
        email: 'new@example.test',
        emailVerified: false,
      },
      emailVerification: {
        sent: true,
      },
    })
    expect(response.body.emailVerification.previewVerificationUrl).toContain('/api/auth/verify-email?token=')
    expect(response.headers['set-cookie']).toBeDefined()
  })

  it('allows password login before email verification', async () => {
    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('FROM app_users')) {
          return {
            rows: [{
              id: '8',
              email: 'unverified@example.test',
              display_name: 'Unverified User',
              role: 'owner',
              created_at: new Date('2026-07-31T00:00:00.000Z'),
              email_verified_at: null,
              google_subject: null,
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
        email: 'unverified@example.test',
        password: 'TestPassword-2026!',
      })

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      email: 'unverified@example.test',
      emailVerified: false,
    })
  })

  it('prepares a password reset email without exposing account existence', async () => {
    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('FROM app_users')) {
          return {
            rows: [{
              id: '9',
              email: 'reset@example.test',
              display_name: 'Reset User',
            }],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/auth/request-password-reset')
      .send({ email: 'reset@example.test' })

    expect(response.status).toBe(202)
    expect(response.body.sent).toBe(true)
    expect(response.body.previewResetUrl).toContain('/reset-password?token=')

    const unknownResponse = await request(createApp(createDatabaseStub()))
      .post('/api/auth/request-password-reset')
      .send({ email: 'unknown@example.test' })

    expect(unknownResponse.status).toBe(202)
    expect(unknownResponse.body).toMatchObject({ sent: true })
    expect(unknownResponse.body.previewResetUrl).toBeUndefined()
  })

  it('consumes a password reset token and revokes existing sessions', async () => {
    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('WITH valid_token')) {
          return { rows: [{ id: 'token-1' }], rowCount: 1 }
        }
        return { rows: [], rowCount: 1 }
      }),
    } as unknown as Pool

    const response = await request(createApp(database))
      .post('/api/auth/reset-password')
      .send({
        token: 'reset-token-that-is-long-enough',
        password: 'NewPassword-2026!',
      })

    expect(response.status).toBe(204)
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=0')
  })

  it('rejects an expired or already-consumed password reset token', async () => {
    const response = await request(createApp(createDatabaseStub()))
      .post('/api/auth/reset-password')
      .send({
        token: 'expired-token-that-is-long-enough',
        password: 'NewPassword-2026!',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('invalid_reset_token')
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

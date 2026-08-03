import { existsSync } from 'node:fs'
import { join } from 'node:path'
import cors from 'cors'
import express, {
  type ErrorRequestHandler,
  type Response,
} from 'express'
import helmet from 'helmet'
import type { Pool } from 'pg'
import { z } from 'zod'
import { environment } from './config'
import { databasePool } from './db/pool'
import {
  createDocumentStore,
  createInMemoryDocumentStore,
  type DocumentStore,
} from './documentStore'
import {
  applyStateMutation,
  applyStateBatch,
  readBootstrapState,
  type RequestContext,
} from './stateRepository'
import { isPersistentStateKey } from './stateScope'
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  lookupStripeCheckoutSession,
  parseStripeBillingPortalRequest,
  parseStripeCheckoutLookupRequest,
  parseStripeCheckoutRequest,
  verifyStripeWebhookEvent,
} from './payments'

const scopeSchema = z.enum(['platform', 'workspace', 'user'])
const keySchema = z
  .string()
  .max(160)
  .refine(isPersistentStateKey, 'State key is not allowed.')
const mutationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('upsert'),
    key: keySchema,
    scope: scopeSchema,
    value: z.unknown(),
  }),
  z.object({
    operation: z.literal('delete'),
    key: keySchema,
    scope: scopeSchema,
  }),
])
const batchSchema = z.object({
  mutations: z.array(mutationSchema).max(100),
})
const singleStateSchema = z.object({
  scope: scopeSchema,
  value: z.unknown(),
})
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})
function getRequestContext(): RequestContext {
  return {
    userId: environment.DEMO_USER_ID,
    workspaceId: environment.DEMO_WORKSPACE_ID,
  }
}

function sendValidationError(response: Response, error: z.ZodError) {
  response.status(400).json({
    error: 'invalid_request',
    message: 'The request body is invalid.',
    issues: error.issues,
  })
}

export function createApp(
  database: Pool = databasePool,
  documentStore: DocumentStore =
    environment.NODE_ENV === 'test'
      ? createInMemoryDocumentStore()
      : createDocumentStore(),
) {
  const app = express()
  const allowedOrigins = environment.CORS_ORIGIN.split(',').map((origin) =>
    origin.trim(),
  )

  app.disable('x-powered-by')
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  )
  app.use(
    cors({
      origin:
        allowedOrigins.includes('*') || environment.NODE_ENV === 'test'
          ? true
          : allowedOrigins,
      credentials: true,
    }),
  )

  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (request, response, next) => {
      const signature = request.headers['stripe-signature']
      if (typeof signature !== 'string' || signature.trim().length === 0) {
        response.status(400).json({
          error: 'invalid_request',
          message: 'Missing Stripe signature header.',
        })
        return
      }

      try {
        const event = await verifyStripeWebhookEvent(
          Buffer.isBuffer(request.body)
            ? request.body
            : Buffer.from(request.body as string),
          signature,
          database,
        )

        switch (event.type) {
          case 'checkout.session.completed':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
          case 'invoice.paid':
          case 'invoice.payment_failed':
            break
          default:
            break
        }

        response.json({
          received: true,
          eventType: event.type,
        })
      } catch (error) {
        next(error)
      }
    },
  )

  app.use(express.json({ limit: environment.STATE_BODY_LIMIT }))

  app.get('/api/health', async (_request, response) => {
    try {
      await database.query('SELECT 1')
      response.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    } catch {
      response.status(503).json({
        status: 'degraded',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      })
    }
  })

  app.post('/api/auth/login', async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const result = await database.query<{
        id: string
        email: string
        display_name: string
        role: string
        created_at: Date
      }>(
        `
          SELECT id, email, display_name, role, created_at
          FROM app_users
          WHERE lower(email) = lower($1)
            AND status = 'active'
            AND password_hash IS NOT NULL
            AND crypt($2, password_hash) = password_hash
          LIMIT 1
        `,
        [parsed.data.email, parsed.data.password],
      )

      const user = result.rows[0]
      if (!user) {
        response.status(401).json({
          error: 'invalid_credentials',
          message: 'The email or password is incorrect.',
        })
        return
      }

      response.json({
        user: {
          id: user.id,
          fullName: user.display_name,
          email: user.email,
          companyName: '',
          role: user.role,
          createdAt: user.created_at.toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/bootstrap', async (_request, response, next) => {
    try {
      const context = getRequestContext()
      const state = await readBootstrapState(database, documentStore, context)
      response.json({
        ...state,
        context,
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/state/batch', async (request, response, next) => {
    const parsed = batchSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = getRequestContext()
      await applyStateBatch(database, documentStore, context, parsed.data.mutations)
      response.status(202).json({
        saved: parsed.data.mutations.length,
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/payments/stripe/checkout-session', async (request, response, next) => {
    try {
      const payload = parseStripeCheckoutRequest(request.body)
      const session = await createStripeCheckoutSession(
        request,
        database,
        payload,
      )
      response.status(201).json(session)
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error)
        return
      }
      next(error)
    }
  })

  app.post('/api/payments/stripe/billing-portal', async (request, response, next) => {
    try {
      const payload = parseStripeBillingPortalRequest(request.body)
      const session = await createStripeBillingPortalSession(
        request,
        database,
        payload,
      )
      response.status(201).json(session)
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error)
        return
      }
      next(error)
    }
  })

  app.post('/api/payments/stripe/checkout-session/lookup', async (request, response, next) => {
    try {
      const payload = parseStripeCheckoutLookupRequest(request.body)
      const session = await lookupStripeCheckoutSession(database, payload)
      response.json(session)
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error)
        return
      }
      next(error)
    }
  })

  app.put('/api/state/:key', async (request, response, next) => {
    const keyResult = keySchema.safeParse(request.params.key)
    const bodyResult = singleStateSchema.safeParse(request.body)
    if (!keyResult.success) {
      sendValidationError(response, keyResult.error)
      return
    }
    if (!bodyResult.success) {
      sendValidationError(response, bodyResult.error)
      return
    }

    try {
      await applyStateMutation(database, documentStore, getRequestContext(), {
        operation: 'upsert',
        key: keyResult.data,
        scope: bodyResult.data.scope,
        value: bodyResult.data.value,
      })
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/state/:key', async (request, response, next) => {
    const keyResult = keySchema.safeParse(request.params.key)
    const scopeResult = scopeSchema.safeParse(request.query.scope)
    if (!keyResult.success) {
      sendValidationError(response, keyResult.error)
      return
    }
    if (!scopeResult.success) {
      sendValidationError(response, scopeResult.error)
      return
    }

    try {
      await applyStateMutation(database, documentStore, getRequestContext(), {
        operation: 'delete',
        key: keyResult.data,
        scope: scopeResult.data,
      })
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  app.use('/api', (_request, response) => {
    response.status(404).json({
      error: 'not_found',
      message: 'API route not found.',
    })
  })

  const clientDirectory = join(process.cwd(), 'dist')
  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory))
    app.use((request, response, next) => {
      if (request.method !== 'GET') {
        next()
        return
      }
      response.sendFile(join(clientDirectory, 'index.html'))
    })
  }

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    const message =
      environment.NODE_ENV === 'production'
        ? 'The server could not complete the request.'
        : error instanceof Error
          ? error.message
          : String(error)
    response.status(500).json({
      error: 'internal_error',
      message,
    })
  }
  app.use(errorHandler)

  return app
}

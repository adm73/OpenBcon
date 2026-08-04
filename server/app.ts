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
import {
  clearSessionCookie,
  createSession,
  requireRequestContext,
  revokeSession,
  setSessionCookie,
} from './auth'
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
  AuthorizationError,
  readBootstrapState,
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
import { checkForOpenBconUpdates } from './updateCheck'

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
const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(1).max(160),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
})

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
  const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>()
  const allowedOrigins = environment.CORS_ORIGIN.split(',').map((origin) =>
    origin.trim(),
  )

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
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
      const loginKey = `${request.ip}:${parsed.data.email.toLowerCase()}`
      const now = Date.now()
      if (failedLoginAttempts.size > 10000) {
        for (const [key, attempt] of failedLoginAttempts) {
          if (attempt.resetAt <= now) failedLoginAttempts.delete(key)
        }
      }
      const previousAttempt = failedLoginAttempts.get(loginKey)
      if (previousAttempt && previousAttempt.resetAt > now && previousAttempt.count >= 10) {
        response.setHeader(
          'Retry-After',
          String(Math.ceil((previousAttempt.resetAt - now) / 1000)),
        )
        response.status(429).json({
          error: 'too_many_attempts',
          message: 'Too many login attempts. Try again later.',
        })
        return
      }

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
        const nextAttempt = previousAttempt && previousAttempt.resetAt > now
          ? previousAttempt
          : { count: 0, resetAt: now + 15 * 60 * 1000 }
        nextAttempt.count += 1
        failedLoginAttempts.set(loginKey, nextAttempt)
        response.status(401).json({
          error: 'invalid_credentials',
          message: 'The email or password is incorrect.',
        })
        return
      }

      failedLoginAttempts.delete(loginKey)

      const workspaceResult = await database.query<{ workspace_id: string }>(
        `
          SELECT members.workspace_id
          FROM workspace_members AS members
          JOIN workspaces
            ON workspaces.id = members.workspace_id
           AND workspaces.status = 'active'
          WHERE members.user_id = $1
          ORDER BY members.created_at ASC
          LIMIT 1
        `,
        [user.id],
      )
      const workspaceId =
        workspaceResult.rows[0]?.workspace_id ?? environment.DEMO_WORKSPACE_ID
      if (
        environment.NODE_ENV === 'production' &&
        !workspaceResult.rows[0]?.workspace_id
      ) {
        response.status(403).json({
          error: 'workspace_required',
          message: 'The account is not assigned to an active workspace.',
        })
        return
      }

      const sessionToken = await createSession(database, user.id, workspaceId)
      setSessionCookie(response, sessionToken)

      response.json({
        user: {
          id: user.id,
          fullName: user.display_name,
          email: user.email,
          companyName: '',
          role: user.role,
          createdAt: user.created_at.toISOString(),
        },
        context: {
          userId: String(user.id),
          workspaceId,
        },
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/auth/register', async (request, response, next) => {
    const parsed = registrationSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const result = await database.query<{
        id: string
        email: string
        display_name: string
        workspace_id: string
        role: string
        created_at: Date
      }>(
        `
          WITH new_user AS (
            INSERT INTO app_users (email, display_name, role, password_hash)
            VALUES (lower($1), $2, 'owner', crypt($3, gen_salt('bf')))
            RETURNING id, email, display_name, role, created_at
          ), new_workspace AS (
            INSERT INTO workspaces (name, slug, kind, created_by)
            SELECT $4, 'workspace-' || encode(digest(random()::text || $1, 'sha256'), 'hex'), 'founder', id
            FROM new_user
            RETURNING id, created_by
          ), new_member AS (
            INSERT INTO workspace_members (workspace_id, user_id, role)
            SELECT id, created_by, 'owner'
            FROM new_workspace
          )
          SELECT
            new_user.id,
            new_user.email,
            new_user.display_name,
            new_user.role,
            new_user.created_at,
            new_workspace.id AS workspace_id
          FROM new_user
          JOIN new_workspace ON new_workspace.created_by = new_user.id
        `,
        [parsed.data.email, parsed.data.fullName, parsed.data.password, parsed.data.companyName],
      )
      const user = result.rows[0]
      if (!user) {
        throw new Error('The account could not be created.')
      }

      const sessionToken = await createSession(database, user.id, user.workspace_id)
      setSessionCookie(response, sessionToken)
      response.status(201).json({
        user: {
          id: user.id,
          fullName: user.display_name,
          email: user.email,
          companyName: parsed.data.companyName,
          role: user.role,
          createdAt: user.created_at.toISOString(),
        },
        context: {
          userId: String(user.id),
          workspaceId: user.workspace_id,
        },
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        response.status(409).json({
          error: 'account_exists',
          message: 'An account with this email already exists.',
        })
        return
      }
      next(error)
    }
  })

  app.post('/api/auth/logout', async (request, response, next) => {
    try {
      await revokeSession(database, request)
      clearSessionCookie(response)
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/bootstrap', async (request, response, next) => {
    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return
      const state = await readBootstrapState(database, documentStore, context)
      response.json({
        ...state,
        context,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/updates', async (request, response) => {
    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const currentCommit =
        typeof request.query.currentCommit === 'string'
          ? request.query.currentCommit
          : undefined
      if (currentCommit && !/^(unknown|[0-9a-f]{7,40})$/iu.test(currentCommit.trim())) {
        response.status(400).json({
          error: 'invalid_request',
          message: 'The current commit identifier is invalid.',
        })
        return
      }

      response.json(await checkForOpenBconUpdates(currentCommit))
    } catch (error) {
      response.status(502).json({
        error: 'update_check_failed',
        message:
          error instanceof Error
            ? error.message
            : 'The update service could not be reached.',
      })
    }
  })

  app.post('/api/state/batch', async (request, response, next) => {
    const parsed = batchSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return
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
      const context = await requireRequestContext(database, request, response)
      if (!context) return
      const payload = parseStripeCheckoutRequest(request.body)
      const session = await createStripeCheckoutSession(
        request,
        database,
        documentStore,
        context,
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
      const context = await requireRequestContext(database, request, response)
      if (!context) return
      const payload = parseStripeBillingPortalRequest(request.body)
      const session = await createStripeBillingPortalSession(
        request,
        database,
        documentStore,
        context,
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
      const context = await requireRequestContext(database, request, response)
      if (!context) return
      const payload = parseStripeCheckoutLookupRequest(request.body)
      const session = await lookupStripeCheckoutSession(
        database,
        documentStore,
        context,
        payload,
      )
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
      const context = await requireRequestContext(database, request, response)
      if (!context) return
      await applyStateMutation(database, documentStore, context, {
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
      const context = await requireRequestContext(database, request, response)
      if (!context) return
      await applyStateMutation(database, documentStore, context, {
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
    if (error instanceof AuthorizationError) {
      response.status(403).json({
        error: 'forbidden',
        message: error.message,
      })
      return
    }

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

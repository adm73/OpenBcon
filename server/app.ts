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
  applyStateBatch,
  applyStateMutation,
  readBootstrapState,
  type RequestContext,
} from './stateRepository'
import { isPersistentStateKey } from './stateScope'

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

export function createApp(database: Pool = databasePool) {
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

  app.get('/api/bootstrap', async (_request, response, next) => {
    try {
      const context = getRequestContext()
      const state = await readBootstrapState(database, context)
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
      await applyStateBatch(database, context, parsed.data.mutations)
      response.status(202).json({
        saved: parsed.data.mutations.length,
      })
    } catch (error) {
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
      await applyStateMutation(database, getRequestContext(), {
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
      await applyStateMutation(database, getRequestContext(), {
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

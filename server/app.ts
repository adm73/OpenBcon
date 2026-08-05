import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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

type EnvironmentMode = 'test' | 'live'

type RuntimeResources = {
  database: Pool
  documentStore: DocumentStore
}

type ModeResources = Partial<Record<EnvironmentMode, RuntimeResources>>

function getRequestedEnvironmentMode(request: express.Request): EnvironmentMode {
  const header = request.headers['x-openbcon-environment-mode']
  return header === 'live' ? 'live' : 'test'
}
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
const fundingUsageValueSchema = z.enum([
  'equipment',
  'inventory',
  'hiring',
  'advertising',
  'rent',
  'payroll',
])
const sectorValueSchema = z.enum([
  'Primary',
  'Secondary',
  'Tertiary',
  'Quaternary',
])
const industryValueSchema = z.enum([
  '11 Agriculture, forestry, fishing and hunting',
  '21 Mining, quarrying, and oil and gas extraction',
  '22 Utilities',
  '23 Construction',
  '31-33 Manufacturing',
  '41 Wholesale trade',
  '44-45 Retail trade',
  '48-49 Transportation and warehousing',
  '51 - Information and cultural industries',
  '52 - Finance and insurance',
  '53 - Real estate and rental and leasing',
  '54 - Professional, scientific and technical services',
  '55 - Management of companies and enterprises',
  '56 - Administrative and support, waste management and remediation services',
  '61 - Educational services',
  '62 - Health care and social assistance',
  '71 - Arts, entertainment and recreation',
  '72 - Accommodation and food services',
  '81 - Other services (except public administration)',
  '91 - Public administration',
])
const companyPeriodValueSchema = z.enum([
  'all-year',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
])
const applicationCreateSchema = z.object({
  programName: z.string().trim().min(1).max(160),
  programUrl: z.string().trim().max(2000).default(''),
  provider: z.string().trim().max(160).default(''),
  location: z.string().trim().max(160).default(''),
  fundingType: z.enum(['Grant', 'Loan']),
  amount: z.number().finite().nonnegative().max(1_000_000_000_000),
  deadline: z.string().trim().max(160).default('Open'),
  deadlineOrder: z.number().int().min(0).max(999).default(999),
  company: z.string().trim().min(1).max(160),
  founderName: z.string().trim().min(1).max(120),
  businessSummary: z.string().trim().min(1).max(4000),
  teamBackground: z.string().trim().max(4000).default(''),
})
const companySaveSchema = z.object({
  name: z.string().trim().min(1).max(160),
  legalName: z.string().trim().max(240).default(''),
  corporationDate: z.string().trim().max(7).default(''),
  legalStructure: z.string().trim().max(120).default(''),
  sector: sectorValueSchema.or(z.literal('')).default(''),
  founderName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().or(z.literal('')).default(''),
  emailVerified: z.boolean().default(false),
  phone: z.string().trim().max(80).default(''),
  industry: industryValueSchema.or(z.literal('')).default(''),
  stage: z.enum(['Launch', 'Growth', 'Maturity', 'Decline']).default('Launch'),
  location: z.string().trim().max(160).default(''),
  website: z.string().trim().max(2000).default(''),
  description: z.string().trim().min(1).max(4000),
  productsOrServices: z.string().trim().max(4000).default(''),
  busyPeriods: z.array(companyPeriodValueSchema).max(13).default([]),
  slowPeriods: z.array(companyPeriodValueSchema).max(13).default([]),
  mission: z.string().trim().max(4000).default(''),
  vision: z.string().trim().max(4000).default(''),
  values: z.string().trim().max(4000).default(''),
  teamBackground: z.string().trim().max(4000).default(''),
  employees: z.string().trim().max(40).default(''),
  monthlyRevenue: z.string().trim().max(40).default(''),
  fundingUsage: z.array(fundingUsageValueSchema).max(6).default([]),
  teamMembers: z
    .array(
      z.object({
        id: z.string().trim().max(120),
        name: z.string().trim().max(160),
        title: z.string().trim().max(160),
        responsibilities: z.string().trim().max(2000),
      }),
    )
    .max(50)
    .default([]),
  fundingTarget: z.string().trim().max(40).default(''),
  logo: z.string().max(3_000_000).default(''),
  readiness: z.number().int().min(0).max(100).default(20),
  status: z.enum(['Active', 'Needs review', 'Draft']).default('Draft'),
  updatedAt: z.string().trim().max(120).default(''),
})

type CompanyApiRow = {
  id: string
  name: string
  legal_name: string | null
  founder_name: string
  business_summary: string
  industry: string | null
  stage: string | null
  location: string | null
  website: string | null
  team_background: string | null
  monthly_revenue: string | number | null
  employee_count: number | null
  metadata: unknown
}

function asCompanyMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asCompanyTeamMembers(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((member) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) {
      return []
    }
    const candidate = member as Record<string, unknown>
    return [
      {
        id: typeof candidate.id === 'string' ? candidate.id : randomUUID(),
        name: typeof candidate.name === 'string' ? candidate.name : '',
        title: typeof candidate.title === 'string' ? candidate.title : '',
        responsibilities:
          typeof candidate.responsibilities === 'string'
            ? candidate.responsibilities
            : '',
      },
    ]
  })
}

function asCompanyPeriods(value: unknown) {
  const allowedPeriods = new Set([
    'all-year',
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ])
  if (!Array.isArray(value)) return []
  return value.filter(
    (period): period is string =>
      typeof period === 'string' && allowedPeriods.has(period),
  )
}

function mapCompanyRow(row: CompanyApiRow) {
  const metadata = asCompanyMetadata(row.metadata)
  return {
    id: row.id,
    logo: typeof metadata.logo === 'string' ? metadata.logo : '',
    name: row.name,
    legalName: row.legal_name ?? '',
    corporationDate:
      typeof metadata.corporationDate === 'string' ? metadata.corporationDate : '',
    legalStructure:
      typeof metadata.legalStructure === 'string' ? metadata.legalStructure : '',
    sector: typeof metadata.sector === 'string' ? metadata.sector : '',
    industry: row.industry ?? '',
    stage: row.stage ?? 'Launch',
    location: row.location ?? '',
    website: row.website ?? '',
    description: row.business_summary,
    productsOrServices:
      typeof metadata.productsOrServices === 'string'
        ? metadata.productsOrServices
        : '',
    busyPeriods: asCompanyPeriods(metadata.busyPeriods),
    slowPeriods: asCompanyPeriods(metadata.slowPeriods),
    mission: typeof metadata.mission === 'string' ? metadata.mission : '',
    vision: typeof metadata.vision === 'string' ? metadata.vision : '',
    values: typeof metadata.values === 'string' ? metadata.values : '',
    owner: row.founder_name,
    email: typeof metadata.email === 'string' ? metadata.email : '',
    emailVerified: metadata.emailVerified === true,
    phone: typeof metadata.phone === 'string' ? metadata.phone : '',
    employees: row.employee_count === null ? '' : String(row.employee_count),
    monthlyRevenue:
      row.monthly_revenue === null ? '' : String(row.monthly_revenue),
    fundingUsage: Array.isArray(metadata.fundingUsage)
      ? metadata.fundingUsage.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
    teamIntro: row.team_background ?? '',
    teamMembers: asCompanyTeamMembers(metadata.teamMembers),
    fundingTarget:
      typeof metadata.fundingTarget === 'string' ? metadata.fundingTarget : '',
    readiness:
      typeof metadata.readiness === 'number' ? metadata.readiness : 20,
    status:
      metadata.status === 'Active' || metadata.status === 'Needs review'
        ? metadata.status
        : 'Draft',
    updatedAt:
      typeof metadata.updatedAt === 'string' && metadata.updatedAt.length > 0
        ? metadata.updatedAt
        : 'Synced from database',
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
  defaultDatabase: Pool = databasePool,
  defaultDocumentStore: DocumentStore =
    environment.NODE_ENV === 'test'
      ? createInMemoryDocumentStore()
      : createDocumentStore(),
  modeResources: ModeResources = {},
) {
  const app = express()
  const requestResources = new AsyncLocalStorage<RuntimeResources>()
  const testResources = modeResources.test ?? {
    database: defaultDatabase,
    documentStore: defaultDocumentStore,
  }
  const liveResources = modeResources.live
  const database = new Proxy(defaultDatabase, {
    get(_target, property) {
      const target = requestResources.getStore()?.database ?? testResources.database
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as Pool
  const documentStore = new Proxy(defaultDocumentStore, {
    get(_target, property) {
      const target =
        requestResources.getStore()?.documentStore ?? testResources.documentStore
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as DocumentStore
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

  app.use((request, _response, next) => {
    const mode = getRequestedEnvironmentMode(request)
    const resources = mode === 'live' ? liveResources : testResources
    if (!resources) {
      next(new Error('Live mode is not configured with a live database.'))
      return
    }
    requestResources.run(resources, next)
  })
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

  app.get('/api/companies', async (request, response, next) => {
    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const result = await database.query<CompanyApiRow>(
        `
          SELECT
            companies.id::text,
            companies.name,
            companies.legal_name,
            companies.founder_name,
            companies.business_summary,
            companies.industry,
            companies.stage,
            companies.location,
            companies.website,
            companies.team_background,
            companies.monthly_revenue::text,
            companies.employee_count,
            companies.metadata
          FROM companies
          WHERE companies.workspace_id = $1
          ORDER BY companies.updated_at DESC, companies.id DESC
        `,
        [context.workspaceId],
      )
      response.json({ companies: result.rows.map(mapCompanyRow) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/companies', async (request, response, next) => {
    const parsed = companySaveSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const company = parsed.data
      const employeeCount = company.employees.trim()
        ? Number.parseInt(company.employees, 10)
        : null
      const monthlyRevenue = company.monthlyRevenue.trim()
        ? Number.parseFloat(company.monthlyRevenue.replaceAll(',', ''))
        : null
      if (
        (employeeCount !== null && !Number.isInteger(employeeCount)) ||
        (monthlyRevenue !== null && !Number.isFinite(monthlyRevenue))
      ) {
        response.status(400).json({
          error: 'invalid_request',
          message: 'Number of full-time employees and monthly revenue must be valid numbers.',
        })
        return
      }

      const result = await database.query<CompanyApiRow>(
        `
          INSERT INTO companies (
            workspace_id,
            owner_user_id,
            created_by,
            updated_by,
            name,
            legal_name,
            founder_name,
            business_summary,
            industry,
            location,
            stage,
            team_background,
            monthly_revenue,
            employee_count,
            website,
            metadata
          )
          VALUES (
            $1, $2, $2, $2, $3, NULLIF($4, ''), $5, $6,
            NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''),
            NULLIF($10, ''), $11, $12, NULLIF($13, ''), $14::jsonb
          )
          ON CONFLICT (workspace_id, name) DO UPDATE SET
            owner_user_id = EXCLUDED.owner_user_id,
            updated_by = EXCLUDED.updated_by,
            legal_name = EXCLUDED.legal_name,
            founder_name = EXCLUDED.founder_name,
            business_summary = EXCLUDED.business_summary,
            industry = EXCLUDED.industry,
            location = EXCLUDED.location,
            stage = EXCLUDED.stage,
            team_background = EXCLUDED.team_background,
            monthly_revenue = EXCLUDED.monthly_revenue,
            employee_count = EXCLUDED.employee_count,
            website = EXCLUDED.website,
            metadata = EXCLUDED.metadata,
            updated_at = now()
          RETURNING
            companies.id::text,
            companies.name,
            companies.legal_name,
            companies.founder_name,
            companies.business_summary,
            companies.industry,
            companies.stage,
            companies.location,
            companies.website,
            companies.team_background,
            companies.monthly_revenue::text,
            companies.employee_count,
            companies.metadata
        `,
        [
          context.workspaceId,
          context.userId,
          company.name,
          company.legalName,
          company.founderName,
          company.description,
          company.industry,
          company.location,
          company.stage,
          company.teamBackground,
          monthlyRevenue,
          employeeCount,
          company.website,
          JSON.stringify({
            logo: company.logo,
            corporationDate: company.corporationDate,
            legalStructure: company.legalStructure,
            sector: company.sector,
            email: company.email,
            emailVerified: company.emailVerified,
            phone: company.phone,
            productsOrServices: company.productsOrServices,
            busyPeriods: company.busyPeriods,
            slowPeriods: company.slowPeriods,
            mission: company.mission,
            vision: company.vision,
            values: company.values,
            fundingUsage: company.fundingUsage,
            fundingTarget: company.fundingTarget,
            teamMembers: company.teamMembers,
            readiness: company.readiness,
            status: company.status,
            updatedAt: company.updatedAt,
          }),
        ],
      )
      const savedCompany = result.rows[0]
      if (!savedCompany) {
        throw new Error('The company could not be saved.')
      }
      response.status(200).json({ company: mapCompanyRow(savedCompany) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/applications', async (request, response, next) => {
    const parsed = applicationCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    const context = await requireRequestContext(database, request, response)
    if (!context) return

    const client = await database.connect()
    try {
      await client.query('BEGIN')

      const companyResult = await client.query<{ id: string }>(
        `
          INSERT INTO companies (
            workspace_id,
            owner_user_id,
            created_by,
            name,
            founder_name,
            business_summary,
            team_background
          )
          VALUES ($1, $2, $2, $3, $4, $5, $6)
          ON CONFLICT (workspace_id, name) DO UPDATE SET
            owner_user_id = EXCLUDED.owner_user_id,
            founder_name = EXCLUDED.founder_name,
            business_summary = EXCLUDED.business_summary,
            team_background = EXCLUDED.team_background,
            updated_at = now()
          RETURNING id::text
        `,
        [
          context.workspaceId,
          context.userId,
          parsed.data.company,
          parsed.data.founderName,
          parsed.data.businessSummary,
          parsed.data.teamBackground,
        ],
      )
      const companyId = companyResult.rows[0]?.id
      if (!companyId) {
        throw new Error('The application company could not be created.')
      }

      const existingProgramResult = await client.query<{ id: string }>(
        `
          SELECT id::text
          FROM funding_programs
          WHERE workspace_id = $1 AND name = $2
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [context.workspaceId, parsed.data.programName],
      )
      let programId = existingProgramResult.rows[0]?.id
      if (!programId) {
        const programResult = await client.query<{ id: string }>(
          `
            INSERT INTO funding_programs (
              workspace_id,
              name,
              provider,
              category,
              program_url,
              funding_amount,
              location,
              created_by,
              updated_by
            )
            VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, NULLIF($7, ''), $8, $8)
            RETURNING id::text
          `,
          [
            context.workspaceId,
            parsed.data.programName,
            parsed.data.provider,
            parsed.data.fundingType,
            parsed.data.programUrl,
            parsed.data.amount,
            parsed.data.location,
            context.userId,
          ],
        )
        programId = programResult.rows[0]?.id
      }
      if (!programId) {
        throw new Error('The funding program could not be created.')
      }

      const title = `${parsed.data.programName} application`
      const applicationResult = await client.query<{
        id: string
        app_id: string
      }>(
        `
          INSERT INTO applications (
            workspace_id,
            funding_program_id,
            company_id,
            owner_user_id,
            source_id,
            title,
            amount,
            status,
            progress,
            deadline,
            deadline_order,
            documents_total,
            next_action
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', 0, $8, $9, 0, 'Complete the strategic report')
          RETURNING id::text, app_id
        `,
        [
          context.workspaceId,
          programId,
          companyId,
          context.userId,
          `quick-build-${randomUUID()}`,
          title,
          parsed.data.amount,
          parsed.data.deadline || 'Open',
          parsed.data.deadlineOrder,
        ],
      )
      const application = applicationResult.rows[0]
      if (!application) {
        throw new Error('The application could not be created.')
      }

      await client.query('COMMIT')
      response.status(201).json({
        id: application.id,
        appId: application.app_id,
        title,
        programName: parsed.data.programName,
        programUrl: parsed.data.programUrl,
        company: parsed.data.company,
        fundingType: parsed.data.fundingType,
        amount: parsed.data.amount,
        deadline: parsed.data.deadline || 'Open',
        deadlineOrder: parsed.data.deadlineOrder,
        owner: parsed.data.founderName,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      next(error)
    } finally {
      client.release()
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

import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
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
  hashToken,
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
import { sendPasswordResetEmail, sendVerificationEmail } from './email'
import { getRuntimeAuthConfig } from './runtimeAuthConfig'
import {
  clearGoogleFlowCookies,
  createGoogleState,
  exchangeGoogleCode,
  getGoogleAuthorizationUrl,
  googleModeCookieName,
  googleNextCookieName,
  googleStateCookieName,
  isGoogleOAuthConfigured,
  readCookie,
  setGoogleFlowCookies,
} from './googleAuth'

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
const aiModelSecretsSchema = z.object({
  models: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        apiKey: z.string().max(4000),
      }),
    )
  .max(100),
})
const authenticationSecretsSchema = z.object({
  googleClientSecret: z.string().max(4000).optional(),
  smtpPassword: z.string().max(4000).optional(),
})

type EnvironmentMode = 'test' | 'live'

const adminUserRoleSchema = z.enum(['owner', 'admin', 'member'])
const adminUserStatusSchema = z.enum(['active', 'invited', 'disabled'])
const adminUserCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  role: adminUserRoleSchema.default('member'),
  status: adminUserStatusSchema.default('active'),
  password: z.string().min(8).max(200),
  emailVerified: z.boolean().default(false),
})
const adminUserUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  role: adminUserRoleSchema.optional(),
  status: adminUserStatusSchema.optional(),
  password: z.string().min(8).max(200).optional(),
  emailVerified: z.boolean().optional(),
})

type RuntimeResources = {
  database: Pool
  documentStore: DocumentStore
}

type ModeResources = Partial<Record<EnvironmentMode, RuntimeResources>>

function getRequestedEnvironmentMode(request: express.Request): EnvironmentMode {
  const header = request.headers['x-openbcon-environment-mode']
  if (header === 'live') return 'live'
  if (request.query.mode === 'live') return 'live'
  return readCookie(request, googleModeCookieName) === 'live' ? 'live' : 'test'
}

async function requireAdminContext(
  database: Pool,
  request: express.Request,
  response: Response,
) {
  const context = await requireRequestContext(database, request, response)
  if (!context) return null
  if (context.role !== 'admin' && context.role !== 'owner') {
    response.status(403).json({
      error: 'admin_required',
      message: 'Administrator access is required for this operation.',
    })
    return null
  }
  return context
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
const passwordResetRequestSchema = z.object({
  email: z.string().trim().email(),
})
const passwordResetSchema = z.object({
  token: z.string().trim().min(20).max(256),
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
  country: z.string().trim().max(160).default('Canada'),
  fundingType: z.enum(['Grant', 'Loan']),
  amount: z.number().finite().nonnegative().max(1_000_000_000_000),
  deadline: z.string().trim().max(160).default('Open'),
  deadlineOrder: z.number().int().min(0).max(999).default(999),
  description: z.string().trim().max(4000).default(''),
  process: z.string().trim().max(6000).default(''),
  eligibility: z.string().trim().max(4000).default(''),
  eligibleUses: z.string().trim().max(4000).default(''),
  targetCompanyTypes: z.string().trim().max(4000).default(''),
  requiredEvidence: z.string().trim().max(4000).default(''),
  matchScore: z.number().int().min(0).max(100).default(0),
  sourceType: z
    .enum(['builtin', 'google-sheets', 'airtable', 'json-file', 'manual'])
    .default('manual'),
  sourceId: z.string().trim().max(160).default(''),
  sourceRecordId: z.string().trim().max(240).default(''),
  sourceVersion: z.string().trim().max(240).default(''),
  recordVersion: z.string().trim().max(240).default(''),
  company: z.string().trim().min(1).max(160),
  founderName: z.string().trim().min(1).max(120),
  businessSummary: z.string().trim().min(1).max(4000),
  teamBackground: z.string().trim().max(4000).default(''),
  documentTypeIds: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  language: z.enum(['en-CA', 'fr-CA', 'zh-CN']).default('en-CA'),
})
const applicationDocumentTypesSchema = z.object({
  documentTypeIds: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
  language: z.enum(['en-CA', 'fr-CA', 'zh-CN']).optional(),
})
const manualFundingProgramCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  fundingType: z.enum(['Grant', 'Loan']),
  provider: z.string().trim().max(160).default(''),
  amount: z.number().finite().nonnegative().max(1_000_000_000_000),
  deadline: z.string().trim().max(160).default('Open'),
  programUrl: z.string().trim().max(2000).default(''),
  location: z.string().trim().max(160).default(''),
  country: z.string().trim().max(160).default('Canada'),
  description: z.string().trim().max(4000).default(''),
  process: z.string().trim().max(6000).default(''),
  eligibility: z.string().trim().max(4000).default(''),
  eligibleUses: z.string().trim().max(4000).default(''),
  targetCompanyTypes: z.string().trim().max(4000).default(''),
  requiredEvidence: z.string().trim().max(4000).default(''),
  matchScore: z.number().int().min(0).max(100).default(0),
})
const jsonFundingProgramImportSchema = z.object({
  sourceId: z.string().trim().min(1).max(160),
  sourceName: z.string().trim().min(1).max(240),
  sourceVersion: z.string().trim().max(240).default(''),
  sourceUrl: z.string().trim().max(2000).default(''),
  category: z.enum(['Grant', 'Loan']),
  records: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(2000),
  fieldMapping: z.record(z.string(), z.string().trim().max(240)).default({}),
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

type FundingProgramApiRow = {
  id: string
  pid: string
  name: string
  provider: string | null
  category: string | null
  funding_amount: string | number | null
  deadline: string | null
  program_status: string | null
  match_score: number | null
  program_url: string | null
  location: string | null
  country: string | null
  description: string | null
  process: string | null
  eligibility: string | null
  eligible_uses: string | null
  target_company_types: string | null
  required_evidence: string | null
  source_type: string | null
  source_id: string | null
  source_record_id: string | null
  source_version: string | null
  record_version: string | null
  status: string | null
}

function jsonFieldText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => jsonFieldText(item))
      .filter(Boolean)
      .join('\n')
  }
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value === null || value === undefined ? '' : String(value).trim()
}

function jsonFieldArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => jsonFieldText(item)).filter(Boolean)
}

function jsonMappedField(
  record: Record<string, unknown>,
  fieldMapping: Record<string, string>,
  targetField: string,
  fallbackKeys: string[],
) {
  const mappedKey = fieldMapping[targetField]?.trim()
  if (mappedKey && jsonFieldText(record[mappedKey])) return record[mappedKey]
  for (const key of fallbackKeys) {
    if (jsonFieldText(record[key])) return record[key]
  }
  return undefined
}

function parseFundingAmount(value: unknown) {
  const text = jsonFieldText(value)
  if (!text || /minimum project|minimum contribution/i.test(text)) return null
  const match = text.match(/(?:maximum|up to|amount)\D{0,20}(\d[\d,]*(?:\.\d+)?)\s*(million|billion|k)?/i)
    ?? text.match(/^(?:\$|CAD\s*)?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|k)?$/i)
  if (!match) return null
  const amount = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(amount)) return null
  const multiplier = match[2]?.toLowerCase() === 'billion'
    ? 1_000_000_000
    : match[2]?.toLowerCase() === 'million'
      ? 1_000_000
      : match[2]?.toLowerCase() === 'k'
        ? 1_000
        : 1
  return Math.round(amount * multiplier)
}

function stableJsonFundingRecordId(
  category: 'Grant' | 'Loan',
  record: Record<string, unknown>,
  duplicateNumber: number,
  fieldMapping: Record<string, string>,
) {
  const identity = [
    category,
    jsonFieldText(jsonMappedField(record, fieldMapping, 'name', ['program_name'])),
    jsonFieldText(jsonMappedField(record, fieldMapping, 'provider', ['provider'])),
    jsonFieldText(jsonMappedField(record, fieldMapping, 'url', ['official_program_site'])),
  ].join('|').toLowerCase()
  const suffix = duplicateNumber > 1 ? `|duplicate-${duplicateNumber}` : ''
  return `json-${createHash('sha256').update(identity + suffix).digest('hex').slice(0, 32)}`
}

function normalizeJsonFundingRecord(
  category: 'Grant' | 'Loan',
  record: Record<string, unknown>,
  sourceVersion: string,
  duplicateNumber: number,
  fieldMapping: Record<string, string>,
) {
  const name = jsonFieldText(
    jsonMappedField(record, fieldMapping, 'name', ['program_name', 'name', 'title']),
  )
  if (!name) return null

  const locationValues = jsonFieldArray(
    jsonMappedField(record, fieldMapping, 'location', ['location']),
  )
  const status = jsonFieldText(
    jsonMappedField(record, fieldMapping, 'programStatus', ['status']),
  )
  const statusActive = record.status_active === undefined
    ? true
    : record.status_active === true
  const sourceRecordId = stableJsonFundingRecordId(
    category,
    record,
    duplicateNumber,
    fieldMapping,
  )
  const amount = parseFundingAmount(
    jsonMappedField(record, fieldMapping, 'amount', ['max_amount', 'amount']),
  ) ?? parseFundingAmount(record.money)
  const programUrl = jsonFieldText(
    jsonMappedField(record, fieldMapping, 'url', ['official_program_site', 'url']),
  )
  const metadata = {
    sourceCategory: category,
    sourceUrl: programUrl,
    shortDescription: jsonFieldText(record.short_description),
    money: jsonFieldArray(record.money),
    contactEmails: jsonFieldArray(record.contact_emails),
    locationList: locationValues,
    sourceIndex: record.index ?? null,
    previousProgramName: jsonFieldText(record.previous_program_name),
  }

  return {
    sourceRecordId,
    name,
    provider: jsonFieldText(
      jsonMappedField(record, fieldMapping, 'provider', ['provider']),
    ),
    category,
    programUrl,
    fundingAmount: amount,
    location: locationValues.join('; '),
    country: locationValues.includes('Canada') ? 'Canada' : 'Canada',
    description: jsonFieldText(
      jsonMappedField(record, fieldMapping, 'description', [
        'description',
        'short_description',
      ]),
    ),
    process:
      jsonFieldText(
        jsonMappedField(record, fieldMapping, 'process', [
          'how_to_start_steps',
          'how_to_start',
        ]),
      ),
    deadline: 'Open',
    programStatus: status,
    eligibility: jsonFieldText(
      jsonMappedField(record, fieldMapping, 'eligibility', ['eligibility']),
    ),
    eligibleUses: jsonFieldText(
      jsonMappedField(record, fieldMapping, 'eligibleUses', ['eligible_uses']),
    ),
    targetCompanyTypes: jsonFieldText(
      jsonMappedField(record, fieldMapping, 'targetCompanyTypes', [
        'target_company_types',
      ]),
    ),
    requiredEvidence: jsonFieldText(
      jsonMappedField(record, fieldMapping, 'requiredEvidence', [
        'required_evidence',
      ]),
    ),
    lifecycleStatus: statusActive ? 'active' : 'archived',
    metadata,
    sourceVersion,
    recordVersion: sourceVersion,
  }
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

function mapFundingProgramRow(row: FundingProgramApiRow) {
  const type = row.category?.trim().toLowerCase() === 'loan' ? 'Loan' : 'Grant'
  const sourceType = row.source_type?.trim() || 'manual'
  const sourceName = row.source_id?.trim() || `${sourceType} catalog`

  return {
    id: row.id,
    pid: row.pid,
    name: row.name,
    type,
    provider: row.provider ?? '',
    amount: Number(row.funding_amount ?? 0),
    deadline: row.deadline ?? 'Open',
    programStatus: row.program_status ?? '',
    match: Number(row.match_score ?? 0),
    url: row.program_url ?? '',
    location: row.location ?? '',
    country: row.country ?? 'Canada',
    description: row.description ?? '',
    process: row.process ?? '',
    eligibility: row.eligibility ?? '',
    eligibleUses: row.eligible_uses ?? '',
    targetCompanyTypes: row.target_company_types ?? '',
    requiredEvidence: row.required_evidence ?? '',
    sourceId: row.source_id ?? undefined,
    sourceName,
    sourceType,
    sourceRecordId: row.source_record_id ?? undefined,
    sourceVersion: row.source_version ?? undefined,
    recordVersion: row.record_version ?? undefined,
    status: row.status === 'archived' ? 'archived' : 'active',
  }
}

function sendValidationError(response: Response, error: z.ZodError) {
  response.status(400).json({
    error: 'invalid_request',
    message: 'The request body is invalid.',
    issues: error.issues,
  })
}

function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard'
  }
  return value
}

function publicUrl(path: string) {
  return new URL(path, environment.PUBLIC_APP_URL).toString()
}

function authErrorRedirect(response: Response, code: string) {
  response.redirect(302, publicUrl(`/login?auth_error=${encodeURIComponent(code)}`))
}

function mapAdminUserRow(row: {
  id: string | number
  email: string
  display_name: string
  role: string
  status: string
  created_at: Date | string
  updated_at?: Date | string
  email_verified_at?: Date | string | null
  google_subject?: string | null
}) {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.display_name,
    role: row.role,
    status: row.status,
    emailVerified: row.email_verified_at !== null && row.email_verified_at !== undefined,
    hasGoogleAccount: Boolean(row.google_subject),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
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
  const authRequestAttempts = new Map<string, { count: number; resetAt: number }>()
  const authRateLimitWindowMs = 15 * 60 * 1000

  function authRateLimit(request: express.Request, scope: string, limit: number) {
    const now = Date.now()
    if (authRequestAttempts.size > 10000) {
      for (const [key, attempt] of authRequestAttempts) {
        if (attempt.resetAt <= now) authRequestAttempts.delete(key)
      }
    }

    const key = `${scope}:${request.ip}`
    const previousAttempt = authRequestAttempts.get(key)
    const attempt = previousAttempt && previousAttempt.resetAt > now
      ? previousAttempt
      : { count: 0, resetAt: now + authRateLimitWindowMs }
    if (attempt.count >= limit) {
      return Math.ceil((attempt.resetAt - now) / 1000)
    }
    attempt.count += 1
    authRequestAttempts.set(key, attempt)
    return null
  }
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

  app.get('/api/auth/google/status', async (_request, response) => {
    const authConfig = await getRuntimeAuthConfig(documentStore)
    response.json({ enabled: isGoogleOAuthConfigured(authConfig.googleOAuth) })
  })

  app.get('/api/auth/google/start', async (request, response) => {
    const authConfig = await getRuntimeAuthConfig(documentStore)
    if (!isGoogleOAuthConfigured(authConfig.googleOAuth)) {
      authErrorRedirect(response, 'google_not_configured')
      return
    }

    const state = createGoogleState()
    const next = safeNextPath(typeof request.query.next === 'string' ? request.query.next : null)
    setGoogleFlowCookies(response, state, next, getRequestedEnvironmentMode(request))
    response.redirect(302, getGoogleAuthorizationUrl(state, authConfig.googleOAuth))
  })

  app.get('/api/auth/google/callback', async (request, response, next) => {
    const state = typeof request.query.state === 'string' ? request.query.state : ''
    const code = typeof request.query.code === 'string' ? request.query.code : ''
    const expectedState = readCookie(request, googleStateCookieName)
    const nextPath = safeNextPath(readCookie(request, googleNextCookieName))

    if (!state || !expectedState || state !== expectedState || !code) {
      authErrorRedirect(response, 'google_state_invalid')
      return
    }

    try {
      const authConfig = await getRuntimeAuthConfig(documentStore)
      const profile = await exchangeGoogleCode(code, authConfig.googleOAuth)
      const existingIdentity = await database.query<{
        id: string
        email: string
        display_name: string
        role: string
        created_at: Date
        google_subject: string | null
      }>(
        `
          SELECT id, email, display_name, role, created_at, google_subject
          FROM app_users
          WHERE lower(email) = lower($1) OR google_subject = $2
          LIMIT 1
        `,
        [profile.email, profile.sub],
      )

      let userId: string
      let workspaceId: string | undefined
      const existingUser = existingIdentity.rows[0]
      if (existingUser && existingUser.email.toLowerCase() !== profile.email.toLowerCase()) {
        authErrorRedirect(response, 'google_identity_conflict')
        return
      }

      if (existingUser) {
        userId = existingUser.id
        await database.query(
          `
            UPDATE app_users
            SET google_subject = $2, email_verified_at = COALESCE(email_verified_at, now())
            WHERE id = $1
          `,
          [userId, profile.sub],
        )
      } else {
        const inserted = await database.query<{ id: string }>(
          `
            INSERT INTO app_users (email, display_name, role, password_hash, email_verified_at, google_subject)
            VALUES (lower($1), $2, 'owner', NULL, now(), $3)
            RETURNING id
          `,
          [profile.email, profile.name?.trim() || profile.email.split('@')[0], profile.sub],
        )
        const insertedUser = inserted.rows[0]
        if (!insertedUser) throw new Error('The Google account could not be created.')
        userId = insertedUser.id

        const workspace = await database.query<{ id: string }>(
          `
            INSERT INTO workspaces (name, slug, kind, created_by)
            VALUES ($1, 'workspace-' || encode(digest(random()::text || $2, 'sha256'), 'hex'), 'founder', $2)
            RETURNING id
          `,
          [`${profile.name?.trim() || 'Google'} workspace`, userId],
        )
        workspaceId = workspace.rows[0]?.id
        if (!workspaceId) throw new Error('The Google workspace could not be created.')
        await database.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [workspaceId, userId],
        )
      }

      if (!workspaceId) {
        const workspace = await database.query<{ workspace_id: string }>(
          `
            SELECT workspace_id
            FROM workspace_members
            WHERE user_id = $1
            ORDER BY created_at ASC
            LIMIT 1
          `,
          [userId],
        )
        workspaceId = workspace.rows[0]?.workspace_id
      }
      if (!workspaceId) throw new Error('The account is not assigned to a workspace.')

      const sessionToken = await createSession(database, userId, workspaceId)
      setSessionCookie(response, sessionToken)
      clearGoogleFlowCookies(response)
      response.redirect(302, publicUrl(nextPath))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/auth/verify-email', async (request, response, next) => {
    const token = typeof request.query.token === 'string' ? request.query.token : ''
    if (!token) {
      authErrorRedirect(response, 'verification_invalid')
      return
    }

    try {
      const result = await database.query<{
        token_id: string
        user_id: string
        workspace_id: string
      }>(
        `
          SELECT tokens.id AS token_id, tokens.user_id, members.workspace_id
          FROM email_verification_tokens AS tokens
          JOIN workspace_members AS members ON members.user_id = tokens.user_id
          WHERE tokens.token_hash = $1
            AND tokens.consumed_at IS NULL
            AND tokens.expires_at > now()
          ORDER BY members.created_at ASC
          LIMIT 1
        `,
        [hashToken(token)],
      )
      const record = result.rows[0]
      if (!record) {
        authErrorRedirect(response, 'verification_invalid')
        return
      }

      const client = await database.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `UPDATE app_users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`,
          [record.user_id],
        )
        await client.query(
          `UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1`,
          [record.token_id],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      const sessionToken = await createSession(database, record.user_id, record.workspace_id)
      setSessionCookie(response, sessionToken)
      response.redirect(302, publicUrl('/dashboard?auth=verified'))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/funding-programs', async (request, response, next) => {
    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const result = await database.query<FundingProgramApiRow>(
        `
          SELECT
            funding_programs.id::text,
            funding_programs.pid,
            funding_programs.name,
            funding_programs.provider,
            funding_programs.category,
            funding_programs.funding_amount::text,
            funding_programs.deadline,
            funding_programs.program_status,
            funding_programs.match_score,
            funding_programs.program_url,
            funding_programs.location,
            funding_programs.country,
            funding_programs.description,
            funding_programs.process,
            funding_programs.eligibility,
            funding_programs.eligible_uses,
            funding_programs.target_company_types,
            funding_programs.required_evidence,
            funding_programs.source_type,
            funding_programs.source_id,
            funding_programs.source_record_id,
            funding_programs.source_version,
            funding_programs.record_version,
            funding_programs.status
          FROM funding_programs
          WHERE funding_programs.status = 'active'
            AND (
              funding_programs.workspace_id = $1
              OR funding_programs.workspace_id IS NULL
            )
          ORDER BY funding_programs.updated_at DESC, funding_programs.name ASC
        `,
        [context.workspaceId],
      )

      response.json({
        programs: result.rows.map(mapFundingProgramRow),
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/funding-programs', async (request, response, next) => {
    const parsed = manualFundingProgramCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const sourceRecordId = `manual-${randomUUID()}`
      const recordVersion = `manual-${new Date().toISOString()}`
      const result = await database.query<FundingProgramApiRow>(
        `
          INSERT INTO funding_programs (
            workspace_id,
            name,
            provider,
            category,
            program_url,
            funding_amount,
            location,
            country,
            description,
            process,
            deadline,
            eligibility,
            eligible_uses,
            target_company_types,
            required_evidence,
            match_score,
            source_type,
            source_id,
            source_record_id,
            source_version,
            record_version,
            status,
            created_by,
            updated_by
          )
          VALUES (
            $1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, NULLIF($7, ''), $8,
            $9, $10, $11, $12, $13, $14, $15, $16, 'manual', 'manual-import',
            $17, 'manual-v1', $18, 'active', $19, $19
          )
          RETURNING
            id::text,
            pid,
            name,
            provider,
            category,
            funding_amount::text,
            deadline,
            program_status,
            match_score,
            program_url,
            location,
            country,
            description,
            process,
            eligibility,
            eligible_uses,
            target_company_types,
            required_evidence,
            source_type,
            source_id,
            source_record_id,
            source_version,
            record_version,
            status
        `,
        [
          context.workspaceId,
          parsed.data.name,
          parsed.data.provider,
          parsed.data.fundingType,
          parsed.data.programUrl,
          parsed.data.amount,
          parsed.data.location,
          parsed.data.country,
          parsed.data.description,
          parsed.data.process,
          parsed.data.deadline,
          parsed.data.eligibility,
          parsed.data.eligibleUses,
          parsed.data.targetCompanyTypes,
          parsed.data.requiredEvidence,
          parsed.data.matchScore,
          sourceRecordId,
          recordVersion,
          context.userId,
        ],
      )

      const program = result.rows[0]
      if (!program) {
        throw new Error('The funding program could not be imported.')
      }

      response.status(201).json({ program: mapFundingProgramRow(program) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/funding-programs/import', async (request, response, next) => {
    const parsed = jsonFundingProgramImportSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const sourceVersion = parsed.data.sourceVersion || createHash('sha256')
        .update(JSON.stringify(parsed.data.records))
        .digest('hex')
      const duplicateCounts = new Map<string, number>()
      const normalizedRecords = parsed.data.records.flatMap((record) => {
        const identity = [
          parsed.data.category,
          jsonFieldText(record.program_name),
          jsonFieldText(record.provider),
          jsonFieldText(record.official_program_site),
        ].join('|').toLowerCase()
        const duplicateNumber = (duplicateCounts.get(identity) ?? 0) + 1
        duplicateCounts.set(identity, duplicateNumber)
        const normalized = normalizeJsonFundingRecord(
          parsed.data.category,
          record,
          sourceVersion,
          duplicateNumber,
          parsed.data.fieldMapping,
        )
        return normalized ? [normalized] : []
      })

      if (normalizedRecords.length === 0) {
        response.status(400).json({
          error: 'invalid_catalog',
          message: 'The JSON catalog did not contain any records with program_name.',
        })
        return
      }

      const client = await database.connect()
      let imported = 0
      let updated = 0
      const sourceRecordIds = normalizedRecords.map((record) => record.sourceRecordId)

      try {
        await client.query('BEGIN')
        for (const record of normalizedRecords) {
          const result = await client.query<{ inserted: boolean }>(
            `
              INSERT INTO funding_programs (
                workspace_id,
                name,
                provider,
                category,
                program_url,
                funding_amount,
                currency,
                location,
                country,
                description,
                process,
                deadline,
                program_status,
                eligibility,
                eligible_uses,
                target_company_types,
                required_evidence,
                match_score,
                source_type,
                source_id,
                source_record_id,
                source_version,
                record_version,
                status,
                metadata,
                created_by,
                updated_by
              )
              VALUES (
                $1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, 'CAD',
                NULLIF($7, ''), $8, $9, $10, $11, $12, $13, $14, $15, $16,
                0, 'json-file', $17, $18, $19, $19, $20, $21, $22, $22
              )
              ON CONFLICT (workspace_id, source_id, source_record_id)
              WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL
              DO UPDATE SET
                name = EXCLUDED.name,
                provider = EXCLUDED.provider,
                category = EXCLUDED.category,
                program_url = EXCLUDED.program_url,
                funding_amount = EXCLUDED.funding_amount,
                currency = EXCLUDED.currency,
                location = EXCLUDED.location,
                country = EXCLUDED.country,
                description = EXCLUDED.description,
                process = EXCLUDED.process,
                deadline = EXCLUDED.deadline,
                program_status = EXCLUDED.program_status,
                eligibility = EXCLUDED.eligibility,
                eligible_uses = EXCLUDED.eligible_uses,
                target_company_types = EXCLUDED.target_company_types,
                required_evidence = EXCLUDED.required_evidence,
                source_version = EXCLUDED.source_version,
                record_version = EXCLUDED.record_version,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
              RETURNING (xmax = 0) AS inserted
            `,
            [
              context.workspaceId,
              record.name,
              record.provider,
              record.category,
              record.programUrl,
              record.fundingAmount,
              record.location,
              record.country,
              record.description,
              record.process,
              record.deadline,
              record.programStatus,
              record.eligibility,
              record.eligibleUses,
              record.targetCompanyTypes,
              record.requiredEvidence,
              parsed.data.sourceId,
              record.sourceRecordId,
              sourceVersion,
              record.lifecycleStatus,
              JSON.stringify({
                ...record.metadata,
                sourceName: parsed.data.sourceName,
                sourceUrl: parsed.data.sourceUrl || record.metadata.sourceUrl,
              }),
              context.userId,
            ],
          )
          if (result.rows[0]?.inserted) imported += 1
          else updated += 1
        }

        const archivedResult = await client.query<{ count: string }>(
          `
            WITH archived AS (
              UPDATE funding_programs
              SET status = 'archived', updated_at = now(), updated_by = $1
              WHERE workspace_id = $2
                AND source_id = $3
                AND source_type = 'json-file'
                AND source_record_id IS NOT NULL
                AND NOT (source_record_id = ANY($4::text[]))
              RETURNING id
            )
            SELECT count(*)::text AS count FROM archived
          `,
          [context.userId, context.workspaceId, parsed.data.sourceId, sourceRecordIds],
        )

        const programsResult = await client.query<FundingProgramApiRow>(
          `
            SELECT
              id::text,
              pid,
              name,
              provider,
              category,
              funding_amount::text,
              deadline,
              program_status,
              match_score,
              program_url,
              location,
              country,
              description,
              process,
              eligibility,
              eligible_uses,
              target_company_types,
              required_evidence,
              source_type,
              source_id,
              source_record_id,
              source_version,
              record_version,
              status
            FROM funding_programs
            WHERE workspace_id = $1
              AND source_id = $2
              AND status = 'active'
            ORDER BY name ASC
          `,
          [context.workspaceId, parsed.data.sourceId],
        )

        await client.query('COMMIT')
        response.status(200).json({
          programs: programsResult.rows.map(mapFundingProgramRow),
          imported,
          updated,
          archived: Number(archivedResult.rows[0]?.count ?? 0),
          sourceVersion,
        })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/funding-programs/source/:sourceId/archive', async (request, response, next) => {
    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const sourceId = request.params.sourceId?.trim()
      if (!sourceId || sourceId.length > 160) {
        response.status(400).json({
          error: 'invalid_source_id',
          message: 'A valid funding data source ID is required.',
        })
        return
      }

      const result = await database.query<{ count: string }>(
        `
          WITH archived AS (
            UPDATE funding_programs
            SET status = 'archived', updated_at = now(), updated_by = $1
            WHERE workspace_id = $2
              AND source_id = $3
              AND source_type = 'json-file'
              AND status = 'active'
            RETURNING id
          )
          SELECT count(*)::text AS count FROM archived
        `,
        [context.userId, context.workspaceId, sourceId],
      )

      response.json({ archived: Number(result.rows[0]?.count ?? 0) })
    } catch (error) {
      next(error)
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
        email_verified_at?: Date | null
        google_subject?: string | null
      }>(
        `
          SELECT id, email, display_name, role, created_at, email_verified_at, google_subject
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
          emailVerified: user.email_verified_at !== null || Boolean(user.google_subject),
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
    const retryAfter = authRateLimit(request, 'register', 10)
    if (retryAfter !== null) {
      response.setHeader('Retry-After', String(retryAfter))
      response.status(429).json({
        error: 'too_many_attempts',
        message: 'Too many registration attempts. Try again later.',
      })
      return
    }

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

      const verificationToken = randomBytes(32).toString('base64url')
      await database.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id],
      )
      await database.query(
        `
          INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + interval '24 hours')
        `,
        [user.id, hashToken(verificationToken)],
      )

      const verificationUrl = publicUrl(
        `/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}&mode=${getRequestedEnvironmentMode(request)}`,
      )

      const sessionToken = await createSession(database, user.id, user.workspace_id)
      setSessionCookie(response, sessionToken)

      let emailVerification: {
        sent: boolean
        previewVerificationUrl?: string
        detail?: string
      } = { sent: false }
      try {
        const delivery = await sendVerificationEmail({
          email: user.email,
          fullName: user.display_name,
          verificationUrl,
        }, (await getRuntimeAuthConfig(documentStore)).smtp)
        emailVerification = {
          sent: true,
          ...(environment.NODE_ENV !== 'production' && delivery.previewUrl
            ? { previewVerificationUrl: delivery.previewUrl }
            : {}),
        }
      } catch (error) {
        if (environment.NODE_ENV !== 'production') {
          emailVerification = {
            sent: false,
            ...(error instanceof Error ? { detail: error.message } : {}),
          }
        }
      }

      response.status(201).json({
        user: {
          id: user.id,
          fullName: user.display_name,
          email: user.email,
          companyName: parsed.data.companyName,
          role: user.role,
          createdAt: user.created_at.toISOString(),
          emailVerified: false,
        },
        context: {
          userId: String(user.id),
          workspaceId: user.workspace_id,
        },
        emailVerification,
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

  app.post('/api/auth/request-password-reset', async (request, response, next) => {
    const retryAfter = authRateLimit(request, 'password-reset', 5)
    if (retryAfter !== null) {
      response.setHeader('Retry-After', String(retryAfter))
      response.status(429).json({
        error: 'too_many_attempts',
        message: 'Too many password reset requests. Try again later.',
      })
      return
    }

    const parsed = passwordResetRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    const genericResponse = () => response.status(202).json({
      sent: true,
      message: 'If an account exists for this email, a password reset link has been sent.',
    })

    try {
      const result = await database.query<{
        id: string
        email: string
        display_name: string
      }>(
        `
          SELECT id, email, display_name
          FROM app_users
          WHERE lower(email) = lower($1)
            AND status = 'active'
            AND password_hash IS NOT NULL
          LIMIT 1
        `,
        [parsed.data.email],
      )
      const user = result.rows[0]
      if (!user) {
        return genericResponse()
      }

      const resetToken = randomBytes(32).toString('base64url')
      await database.query(
        `DELETE FROM password_reset_tokens WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id],
      )
      await database.query(
        `
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + interval '30 minutes')
        `,
        [user.id, hashToken(resetToken)],
      )

      const resetUrl = publicUrl(
        `/reset-password?token=${encodeURIComponent(resetToken)}&mode=${getRequestedEnvironmentMode(request)}`,
      )
      try {
        const delivery = await sendPasswordResetEmail({
          email: user.email,
          fullName: user.display_name,
          resetUrl,
        }, (await getRuntimeAuthConfig(documentStore)).smtp)
        response.status(202).json({
          sent: true,
          message: 'If an account exists for this email, a password reset link has been sent.',
          ...(environment.NODE_ENV !== 'production' && delivery.previewUrl
            ? { previewResetUrl: delivery.previewUrl }
            : {}),
        })
      } catch (error) {
        process.stderr.write(
          `[email:error] password reset delivery failed for ${user.email}: ${error instanceof Error ? error.message : String(error)}\n`,
        )
        genericResponse()
      }
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/auth/reset-password', async (request, response, next) => {
    const parsed = passwordResetSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const result = await database.query<{ id: string }>(
        `
          WITH valid_token AS (
            SELECT id, user_id
            FROM password_reset_tokens
            WHERE token_hash = $1
              AND consumed_at IS NULL
              AND expires_at > now()
            LIMIT 1
          ), updated_user AS (
            UPDATE app_users
            SET password_hash = crypt($2, gen_salt('bf')), updated_at = now()
            WHERE id = (SELECT user_id FROM valid_token)
              AND status = 'active'
              AND password_hash IS NOT NULL
            RETURNING id
          ), consumed_token AS (
            UPDATE password_reset_tokens
            SET consumed_at = now()
            WHERE id = (SELECT id FROM valid_token)
              AND EXISTS (SELECT 1 FROM updated_user)
            RETURNING id
          ), revoked_sessions AS (
            DELETE FROM auth_sessions
            WHERE user_id = (SELECT id FROM updated_user)
          )
          SELECT id FROM consumed_token
        `,
        [hashToken(parsed.data.token), parsed.data.password],
      )

      if (!result.rows[0]) {
        response.status(400).json({
          error: 'invalid_reset_token',
          message: 'This reset link is invalid or has expired.',
        })
        return
      }

      clearSessionCookie(response)
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/auth/resend-verification', async (request, response, next) => {
    const retryAfter = authRateLimit(request, 'resend-verification', 5)
    if (retryAfter !== null) {
      response.setHeader('Retry-After', String(retryAfter))
      response.status(429).json({
        error: 'too_many_attempts',
        message: 'Too many verification email requests. Try again later.',
      })
      return
    }

    const parsed = z.object({ email: z.string().trim().email() }).safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const result = await database.query<{
        id: string
        email: string
        display_name: string
        email_verified_at: Date | null
      }>(
        `SELECT id, email, display_name, email_verified_at FROM app_users WHERE lower(email) = lower($1) LIMIT 1`,
        [parsed.data.email],
      )
      const user = result.rows[0]
      if (!user || user.email_verified_at) {
        response.status(202).json({ sent: true })
        return
      }

      const verificationToken = randomBytes(32).toString('base64url')
      await database.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id],
      )
      await database.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')`,
        [user.id, hashToken(verificationToken)],
      )
      const verificationUrl = publicUrl(
        `/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}&mode=${getRequestedEnvironmentMode(request)}`,
      )
      const delivery = await sendVerificationEmail({
        email: user.email,
        fullName: user.display_name,
        verificationUrl,
      }, (await getRuntimeAuthConfig(documentStore)).smtp)
      response.status(202).json({
        sent: true,
        ...(environment.NODE_ENV !== 'production' && delivery.previewUrl
          ? { previewVerificationUrl: delivery.previewUrl }
          : {}),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/admin/users', async (request, response, next) => {
    try {
      const context = await requireAdminContext(database, request, response)
      if (!context) return

      const query = typeof request.query.query === 'string'
        ? request.query.query.trim()
        : ''
      const result = await database.query<{
        id: string
        email: string
        display_name: string
        role: string
        status: string
        created_at: Date
        updated_at: Date
        email_verified_at: Date | null
        google_subject: string | null
      }>(
        `
          SELECT id, email, display_name, role, status, created_at, updated_at,
                 email_verified_at, google_subject
          FROM app_users
          WHERE ($1 = '' OR email ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%')
          ORDER BY created_at DESC, id DESC
        `,
        [query],
      )
      response.json({ users: result.rows.map(mapAdminUserRow) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/admin/users', async (request, response, next) => {
    const parsed = adminUserCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireAdminContext(database, request, response)
      if (!context) return

      const result = await database.query<{
        id: string
        email: string
        display_name: string
        role: string
        status: string
        created_at: Date
        updated_at: Date
        email_verified_at: Date | null
        google_subject: string | null
      }>(
        `
          INSERT INTO app_users
            (email, display_name, role, status, password_hash, email_verified_at)
          VALUES (
            lower($1), $2, $3, $4, crypt($5, gen_salt('bf')),
            CASE WHEN $6 THEN now() ELSE NULL END
          )
          RETURNING id, email, display_name, role, status, created_at, updated_at,
                    email_verified_at, google_subject
        `,
        [
          parsed.data.email,
          parsed.data.fullName,
          parsed.data.role,
          parsed.data.status,
          parsed.data.password,
          parsed.data.emailVerified,
        ],
      )
      const user = result.rows[0]
      if (!user) throw new Error('The user could not be created.')
      response.status(201).json({ user: mapAdminUserRow(user) })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        response.status(409).json({
          error: 'account_exists',
          message: 'A user with this email already exists.',
        })
        return
      }
      next(error)
    }
  })

  app.patch('/api/admin/users/:id', async (request, response, next) => {
    const parsed = adminUserUpdateSchema.safeParse(request.body)
    const userId = z.coerce.number().int().positive().safeParse(request.params.id)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }
    if (!userId.success) {
      sendValidationError(response, userId.error)
      return
    }

    try {
      const context = await requireAdminContext(database, request, response)
      if (!context) return

      const existingResult = await database.query<{
        id: string
        email: string
        display_name: string
        role: string
        status: string
        email_verified_at: Date | null
      }>(
        `SELECT id, email, display_name, role, status, email_verified_at FROM app_users WHERE id = $1`,
        [userId.data],
      )
      const existing = existingResult.rows[0]
      if (!existing) {
        response.status(404).json({ error: 'not_found', message: 'User not found.' })
        return
      }

      const nextRole = parsed.data.role ?? existing.role
      const nextStatus = parsed.data.status ?? existing.status
      if (
        String(existing.id) === String(context.userId) &&
        (nextRole !== 'admin' || nextStatus !== 'active')
      ) {
        response.status(409).json({
          error: 'current_admin_required',
          message: 'You cannot remove administrator access from your own active account.',
        })
        return
      }

      const result = await database.query<{
        id: string
        email: string
        display_name: string
        role: string
        status: string
        created_at: Date
        updated_at: Date
        email_verified_at: Date | null
        google_subject: string | null
      }>(
        `
          UPDATE app_users
          SET email = lower($2),
              display_name = $3,
              role = $4,
              status = $5,
              password_hash = CASE
                WHEN NULLIF($6, '') IS NULL THEN password_hash
                ELSE crypt($6, gen_salt('bf'))
              END,
              email_verified_at = CASE WHEN $7 THEN COALESCE(email_verified_at, now()) ELSE NULL END
          WHERE id = $1
          RETURNING id, email, display_name, role, status, created_at, updated_at,
                    email_verified_at, google_subject
        `,
        [
          userId.data,
          parsed.data.email ?? existing.email,
          parsed.data.fullName ?? existing.display_name,
          nextRole,
          nextStatus,
          parsed.data.password ?? '',
          parsed.data.emailVerified ?? existing.email_verified_at !== null,
        ],
      )
      const user = result.rows[0]
      if (!user) throw new Error('The user could not be updated.')
      response.json({ user: mapAdminUserRow(user) })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        response.status(409).json({
          error: 'account_exists',
          message: 'A user with this email already exists.',
        })
        return
      }
      next(error)
    }
  })

  app.delete('/api/admin/users/:id', async (request, response, next) => {
    const userId = z.coerce.number().int().positive().safeParse(request.params.id)
    if (!userId.success) {
      sendValidationError(response, userId.error)
      return
    }

    try {
      const context = await requireAdminContext(database, request, response)
      if (!context) return
      if (String(userId.data) === String(context.userId)) {
        response.status(409).json({
          error: 'current_admin_required',
          message: 'You cannot delete your own administrator account.',
        })
        return
      }

      const target = await database.query<{ role: string; status: string }>(
        `SELECT role, status FROM app_users WHERE id = $1`,
        [userId.data],
      )
      const user = target.rows[0]
      if (!user) {
        response.status(404).json({ error: 'not_found', message: 'User not found.' })
        return
      }
      if (user.role === 'admin' && user.status === 'active') {
        const admins = await database.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM app_users WHERE role = 'admin' AND status = 'active'`,
        )
        if (Number(admins.rows[0]?.count ?? 0) <= 1) {
          response.status(409).json({
            error: 'last_admin_required',
            message: 'The last active administrator cannot be deleted.',
          })
          return
        }
      }

      await database.query(`DELETE FROM app_users WHERE id = $1`, [userId.data])
      response.status(204).end()
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
        response.status(409).json({
          error: 'user_in_use',
          message: 'This user owns workspace data and cannot be deleted. Disable the account instead.',
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
              country,
              description,
              process,
              deadline,
              eligibility,
              eligible_uses,
              target_company_types,
              required_evidence,
              match_score,
              source_type,
              source_id,
              source_record_id,
              source_version,
              record_version,
              created_by,
              updated_by
            )
            VALUES (
              $1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, NULLIF($7, ''),
              NULLIF($8, ''), $9, $10, $11, $12, $13, $14, $15, $16, $17,
              NULLIF($18, ''), NULLIF($19, ''),
              COALESCE(NULLIF($20, ''), 'quick-build-v1'),
              COALESCE(NULLIF($21, ''), 'quick-build-v1'),
              $22, $22
            )
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
            parsed.data.country,
            parsed.data.description,
            parsed.data.process,
            parsed.data.deadline,
            parsed.data.eligibility,
            parsed.data.eligibleUses,
            parsed.data.targetCompanyTypes,
            parsed.data.requiredEvidence,
            parsed.data.matchScore,
            parsed.data.sourceType,
            parsed.data.sourceId,
            parsed.data.sourceRecordId,
            parsed.data.sourceVersion,
            parsed.data.recordVersion,
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
            next_action,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', 0, $8, $9, 0, 'Complete the strategic report', jsonb_build_object('document_type_ids', $10::jsonb, 'language', $11))
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
          JSON.stringify(parsed.data.documentTypeIds),
          parsed.data.language,
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
        documentTypeIds: parsed.data.documentTypeIds,
        language: parsed.data.language,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      next(error)
    } finally {
      client.release()
    }
  })

  app.patch('/api/applications/:applicationId/document-types', async (request, response, next) => {
    const parsed = applicationDocumentTypesSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const applicationId = request.params.applicationId.trim()
      if (!/^\d+$/u.test(applicationId)) {
        response.status(400).json({
          error: 'invalid_application_id',
          message: 'The application identifier is invalid.',
        })
        return
      }

      const result = await database.query(
        `
          UPDATE applications
          SET metadata = jsonb_set(
            jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{document_type_ids}',
              $1::jsonb,
              true
            ),
            '{language}',
            CASE
              WHEN $2 = '' THEN COALESCE(metadata->'language', '"en-CA"'::jsonb)
              ELSE to_jsonb($2::text)
            END,
            true
          ),
          updated_at = now()
          WHERE id = $3
            AND workspace_id = $4
          RETURNING id
        `,
        [
          JSON.stringify(parsed.data.documentTypeIds),
          parsed.data.language ?? '',
          applicationId,
          context.workspaceId,
        ],
      )

      if (result.rowCount !== 1) {
        response.status(404).json({
          error: 'application_not_found',
          message: 'The application could not be found.',
        })
        return
      }

      response.json({ documentTypeIds: parsed.data.documentTypeIds })
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

  app.post('/api/platform/ai-secrets', async (request, response, next) => {
    const parsed = aiModelSecretsSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireRequestContext(database, request, response)
      if (!context) return

      const currentValue = await documentStore.findStateValue(
        'platform',
        'platform',
        'bconomics-platform-config-v1',
      )
      const currentRecord =
        currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
          ? (currentValue as Record<string, unknown>)
          : null
      const currentAI =
        currentRecord?.ai &&
        typeof currentRecord.ai === 'object' &&
        !Array.isArray(currentRecord.ai)
          ? (currentRecord.ai as Record<string, unknown>)
          : null
      if (
        !currentRecord ||
        !currentAI ||
        !Array.isArray(currentAI.models)
      ) {
        response.status(409).json({
          error: 'platform_config_missing',
          message: 'The platform AI configuration must be saved before storing model keys.',
        })
        return
      }

      const submittedKeys = new Map(
        parsed.data.models.map((model) => [model.id, model.apiKey]),
      )
      const currentConfig = currentRecord as Record<string, unknown>
      const currentModels = currentAI.models as Array<Record<string, unknown>>
      const nextConfig = {
        ...currentConfig,
        ai: {
          ...currentAI,
          models: currentModels.map((model) => {
            const nextKey = submittedKeys.get(String(model.id ?? ''))
            return nextKey === undefined ? model : { ...model, apiKey: nextKey }
          }),
        },
      }

      await applyStateMutation(database, documentStore, context, {
        operation: 'upsert',
        key: 'bconomics-platform-config-v1',
        scope: 'platform',
        value: nextConfig,
      })
      response.status(202).json({ saved: parsed.data.models.length })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/platform/auth-secrets', async (request, response, next) => {
    const parsed = authenticationSecretsSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error)
      return
    }

    try {
      const context = await requireAdminContext(database, request, response)
      if (!context) return

      const currentValue = await documentStore.findStateValue(
        'platform',
        'platform',
        'bconomics-platform-config-v1',
      )
      const currentConfig =
        currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
          ? (currentValue as Record<string, unknown>)
          : {}
      const currentAuthentication =
        currentConfig.authentication &&
        typeof currentConfig.authentication === 'object' &&
        !Array.isArray(currentConfig.authentication)
          ? (currentConfig.authentication as Record<string, unknown>)
          : {}
      const currentGoogleOAuth =
        currentAuthentication.googleOAuth &&
        typeof currentAuthentication.googleOAuth === 'object' &&
        !Array.isArray(currentAuthentication.googleOAuth)
          ? (currentAuthentication.googleOAuth as Record<string, unknown>)
          : {}
      const currentSMTP =
        currentAuthentication.smtp &&
        typeof currentAuthentication.smtp === 'object' &&
        !Array.isArray(currentAuthentication.smtp)
          ? (currentAuthentication.smtp as Record<string, unknown>)
          : {}

      const nextAuthentication = {
        ...currentAuthentication,
        googleOAuth: {
          ...currentGoogleOAuth,
          ...(parsed.data.googleClientSecret !== undefined &&
          parsed.data.googleClientSecret.trim()
            ? { clientSecret: parsed.data.googleClientSecret }
            : {}),
        },
        smtp: {
          ...currentSMTP,
          ...(parsed.data.smtpPassword !== undefined && parsed.data.smtpPassword.trim()
            ? { password: parsed.data.smtpPassword }
            : {}),
        },
      }

      await applyStateMutation(database, documentStore, context, {
        operation: 'upsert',
        key: 'bconomics-platform-config-v1',
        scope: 'platform',
        value: {
          ...currentConfig,
          authentication: nextAuthentication,
        },
      })
      response.status(202).json({ saved: true })
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

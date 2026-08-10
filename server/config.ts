import 'dotenv/config'
import { z } from 'zod'

function booleanFromEnvironment(defaultValue: boolean) {
  return z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? defaultValue : value === 'true',
    )
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  OPENBCON_ENVIRONMENT_MODE: z.enum(['test', 'live']).default('test'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://admin:bconomics@localhost:5432/dbob1234567890'),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  DATABASE_URL_LIVE: z.string().min(1).optional(),
  // Platform catalogs (funding programs) are shared by both runtime modes.
  DATABASE_URL_SHARED: z.string().min(1).optional(),
  DATABASE_SSL: booleanFromEnvironment(false),
  DATABASE_SSL_REJECT_UNAUTHORIZED: booleanFromEnvironment(true),
  DATABASE_SSL_CA: z.string().min(1).optional(),
  MONGODB_URL: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017'),
  MONGODB_DATABASE: z.string().min(1).default('dbob1234567890'),
  MONGODB_DATABASE_SHARED: z.string().min(1).optional(),
  MONGODB_DATABASE_TEST: z.string().min(1).optional(),
  MONGODB_DATABASE_LIVE: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().positive().default(8787),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STATE_BODY_LIMIT: z.string().default('12mb'),
  APP_STATE_ENCRYPTION_KEY: z.string().min(32).optional(),
  AUTO_MIGRATE: booleanFromEnvironment(true),
  SEED_DEMO_DATA: booleanFromEnvironment(true),
  DEMO_USER_ID: z
    .string()
    .regex(/^\d+$/u)
    .default('1'),
  DEMO_USER_PASSWORD: z.string().min(8).optional(),
  DEMO_WORKSPACE_ID: z
    .string()
    .uuid()
    .default('00000000-0000-4000-8000-000000000002'),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().min(1).default('OpenBcon <no-reply@localhost>'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_SECURE: booleanFromEnvironment(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
})

export const environment = environmentSchema
  .superRefine((values, context) => {
    if (values.NODE_ENV !== 'production') return

    if (!values.APP_STATE_ENCRYPTION_KEY || values.APP_STATE_ENCRYPTION_KEY.startsWith('replace_')) {
      context.addIssue({
        code: 'custom',
        path: ['APP_STATE_ENCRYPTION_KEY'],
        message: 'A production encryption key is required.',
      })
    }
    if (values.CORS_ORIGIN.includes('*') || /localhost|127\.0\.0\.1/iu.test(values.CORS_ORIGIN)) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: 'Production CORS_ORIGIN must use the public HTTPS origin.',
      })
    }
    if (values.SEED_DEMO_DATA) {
      context.addIssue({
        code: 'custom',
        path: ['SEED_DEMO_DATA'],
        message: 'Demo data seeding must be disabled in production.',
      })
    }
    if (values.EMAIL_PROVIDER === 'smtp') {
      for (const [path, value] of [
        ['SMTP_HOST', values.SMTP_HOST],
        ['SMTP_USER', values.SMTP_USER],
        ['SMTP_PASSWORD', values.SMTP_PASSWORD],
      ] as const) {
        if (!value) {
          context.addIssue({
            code: 'custom',
            path: [path],
            message: 'SMTP configuration is required when EMAIL_PROVIDER=smtp.',
          })
        }
      }
    }
    if (values.OPENBCON_ENVIRONMENT_MODE === 'live' && values.EMAIL_PROVIDER !== 'smtp') {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'Live Mode requires SMTP email delivery.',
      })
    }
    if (!values.DATABASE_URL_SHARED || !values.DATABASE_URL_TEST || !values.DATABASE_URL_LIVE) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_SHARED'],
        message: 'Production requires separate shared, Test, and Live PostgreSQL databases.',
      })
    }
    if (values.DATABASE_URL_SHARED && values.DATABASE_URL_TEST === values.DATABASE_URL_SHARED) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_TEST'],
        message: 'Test PostgreSQL must not reuse the shared catalog database.',
      })
    }
    if (values.DATABASE_URL_SHARED && values.DATABASE_URL_LIVE === values.DATABASE_URL_SHARED) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_LIVE'],
        message: 'Live PostgreSQL must not reuse the shared catalog database.',
      })
    }
    if (values.DATABASE_URL_TEST && values.DATABASE_URL_LIVE === values.DATABASE_URL_TEST) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_LIVE'],
        message: 'Live PostgreSQL must not reuse the Test database.',
      })
    }
    if (!values.MONGODB_DATABASE_SHARED || !values.MONGODB_DATABASE_TEST || !values.MONGODB_DATABASE_LIVE) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_DATABASE_SHARED'],
        message: 'Production requires separate shared, Test, and Live MongoDB databases.',
      })
    }
    if (values.MONGODB_DATABASE_SHARED && values.MONGODB_DATABASE_TEST === values.MONGODB_DATABASE_SHARED) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_DATABASE_TEST'],
        message: 'Test MongoDB must not reuse the shared platform database.',
      })
    }
    if (values.MONGODB_DATABASE_LIVE && values.MONGODB_DATABASE_LIVE === values.MONGODB_DATABASE_SHARED) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_DATABASE_LIVE'],
        message: 'Live MongoDB must not reuse the shared platform database.',
      })
    }
    if (values.MONGODB_DATABASE_TEST && values.MONGODB_DATABASE_LIVE === values.MONGODB_DATABASE_TEST) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_DATABASE_LIVE'],
        message: 'Live MongoDB must not reuse the Test database.',
      })
    }
  })
  .parse(process.env)

export const platformOwnerId = 'platform'

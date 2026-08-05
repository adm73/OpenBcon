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
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://bconomics:bconomics@localhost:5432/bconomics'),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  DATABASE_URL_LIVE: z.string().min(1).optional(),
  DATABASE_SSL: booleanFromEnvironment(false),
  MONGODB_URL: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017'),
  MONGODB_DATABASE: z.string().min(1).default('bconomics'),
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
  })
  .parse(process.env)

export const platformOwnerId = 'platform'

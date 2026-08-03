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
  DATABASE_SSL: booleanFromEnvironment(false),
  MONGODB_URL: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017'),
  MONGODB_DATABASE: z.string().min(1).default('bconomics'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STATE_BODY_LIMIT: z.string().default('12mb'),
  APP_STATE_ENCRYPTION_KEY: z.string().optional(),
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
})

export const environment = environmentSchema.parse(process.env)

export const platformOwnerId = 'platform'

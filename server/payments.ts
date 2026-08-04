import type { Request } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'
import { environment } from './config'
import type { DocumentStore } from './documentStore'
import { readPlatformStateValue } from './stateRepository'
import {
  AuthorizationError,
  type QueryClient,
  type RequestContext,
} from './stateRepository'
import { decryptStoredConfigValue } from './secureState'

const paymentCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  offeringType: z.enum(['product', 'service']),
  billingType: z.enum(['one-time', 'monthly', 'annual']),
  amount: z.string(),
  currency: z.enum(['CAD', 'USD']),
  provider: z.enum(['stripe', 'waffo-pancake']),
  externalProductId: z.string(),
  externalPriceId: z.string(),
  active: z.boolean(),
})

const paymentConfigSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.enum(['stripe', 'waffo-pancake', 'manual']),
    currency: z.enum(['CAD', 'USD']),
    testMode: z.boolean(),
    webhookUrl: z.string(),
    testSecretKeyReference: z.string().optional(),
    liveSecretKeyReference: z.string().optional(),
    testPublishableKeyReference: z.string().optional(),
    livePublishableKeyReference: z.string().optional(),
    webhookSecretReference: z.string(),
    checkoutSuccessUrl: z.string(),
    checkoutCancelUrl: z.string(),
    billingPortalReturnUrl: z.string(),
    priceCatalog: z.array(paymentCatalogItemSchema).optional(),
    secretKeyReference: z.string().optional(),
  })
  .transform((payments) => ({
    enabled: payments.enabled,
    provider: payments.provider,
    currency: payments.currency,
    testMode: payments.testMode,
    webhookUrl: payments.webhookUrl,
    testSecretKeyReference:
      payments.testSecretKeyReference ?? payments.secretKeyReference ?? '',
    liveSecretKeyReference:
      payments.liveSecretKeyReference ?? payments.secretKeyReference ?? '',
    testPublishableKeyReference: payments.testPublishableKeyReference ?? '',
    livePublishableKeyReference: payments.livePublishableKeyReference ?? '',
    webhookSecretReference: payments.webhookSecretReference,
    checkoutSuccessUrl: payments.checkoutSuccessUrl,
    checkoutCancelUrl: payments.checkoutCancelUrl,
    billingPortalReturnUrl: payments.billingPortalReturnUrl,
    priceCatalog: payments.priceCatalog ?? [],
  }))

const checkoutRequestSchema = z.object({
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  priceItemId: z.string().trim().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerId: z.string().trim().min(1).optional(),
  platformName: z.string().trim().min(1).max(120).optional(),
  payments: paymentConfigSchema.optional(),
}).refine(
  (payload) => Boolean(payload.priceItemId || payload.billingCycle),
  'Either priceItemId or billingCycle is required.',
)

const billingPortalRequestSchema = z.object({
  customerId: z.string().trim().min(1),
  platformName: z.string().trim().min(1).max(120).optional(),
  payments: paymentConfigSchema.optional(),
})

const checkoutLookupRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  payments: paymentConfigSchema.optional(),
})

export type StripePaymentConfig = z.infer<typeof paymentConfigSchema>
export type StripeCheckoutRequest = z.infer<typeof checkoutRequestSchema>
export type StripeBillingPortalRequest = z.infer<
  typeof billingPortalRequestSchema
>
export type StripeCheckoutLookupRequest = z.infer<
  typeof checkoutLookupRequestSchema
>

type ResolvedPlatformPayments = {
  platformName: string
  payments: StripePaymentConfig
}

type BillingContext = Pick<RequestContext, 'userId' | 'workspaceId'>

async function assertOwnedBillingResource(
  database: QueryClient,
  context: BillingContext,
  resourceType: 'checkout_session' | 'customer',
  resourceId: string,
) {
  const result = await database.query<{ resource_id: string }>(
    `
      SELECT resource_id
      FROM billing_resource_bindings
      WHERE resource_type = $1
        AND resource_id = $2
        AND workspace_id = $3
        AND user_id = $4
      LIMIT 1
    `,
    [resourceType, resourceId, context.workspaceId, context.userId],
  )
  if (!result.rows[0]) {
    throw new AuthorizationError('The billing resource is not owned by this workspace.')
  }
}

async function bindBillingResource(
  database: QueryClient,
  context: BillingContext,
  resourceType: 'checkout_session' | 'customer',
  resourceId: string,
) {
  await database.query(
    `
      INSERT INTO billing_resource_bindings
        (resource_type, resource_id, workspace_id, user_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (resource_type, resource_id) DO NOTHING
    `,
    [resourceType, resourceId, context.workspaceId, context.userId],
  )
}

function normalizeReference(
  reference: string,
  label:
    | 'testSecretKeyReference'
    | 'liveSecretKeyReference'
    | 'webhookSecretReference',
) {
  const trimmed = reference.trim()
  if (!/^[A-Z][A-Z0-9_]*$/u.test(trimmed)) {
    throw new Error(`Payment setting "${label}" is empty or invalid.`)
  }
  return trimmed
}

function readSecret(
  reference: string,
  label:
    | 'testSecretKeyReference'
    | 'liveSecretKeyReference'
    | 'webhookSecretReference',
) {
  const decrypted = decryptStoredConfigValue(reference)
  const trimmed = decrypted.trim()
  if (!trimmed) {
    throw new Error(`Payment setting "${label}" is required.`)
  }

  if (!/^[A-Z][A-Z0-9_]*$/u.test(trimmed)) {
    return trimmed
  }

  const normalized = normalizeReference(trimmed, label)
  const value = process.env[normalized]
  if (!value) {
    throw new Error(`Environment variable ${normalized} is not set.`)
  }
  return value
}

function createStripeClient(payments: StripePaymentConfig) {
  const secretReference = payments.testMode
    ? payments.testSecretKeyReference
    : payments.liveSecretKeyReference
  const secretLabel = payments.testMode
    ? 'testSecretKeyReference'
    : 'liveSecretKeyReference'
  const secretKey = readSecret(secretReference, secretLabel)
  return new Stripe(secretKey)
}

function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers['x-forwarded-proto']
  const forwardedHost = request.headers['x-forwarded-host']

  if (typeof forwardedProto === 'string' && typeof forwardedHost === 'string') {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/u, '')
  }

  const origin = request.headers.origin
  if (typeof origin === 'string' && origin.startsWith('http')) {
    return origin.replace(/\/$/u, '')
  }

  const protocol = request.protocol
  const host = request.get('host')
  if (!host) {
    throw new Error('Could not determine the current application origin.')
  }

  return `${protocol}://${host}`.replace(/\/$/u, '')
}

function resolveAbsoluteUrl(
  request: Request,
  configuredValue: string,
  fallbackPath: string,
) {
  const origin = getRequestOrigin(request)
  const trimmed = configuredValue.trim()

  if (!trimmed) {
    return `${origin}${fallbackPath}`
  }

  if (/^https?:\/\//u.test(trimmed)) {
    return trimmed
  }

  return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
}

function parseAmountToMinorUnits(value: string) {
  const normalized = value.trim().replace(/,/gu, '')
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) {
    throw new Error(`Invalid Stripe price value "${value}".`)
  }

  return Math.round(Number.parseFloat(normalized) * 100)
}

function resolveStripeCatalogItem(
  payments: StripePaymentConfig,
  priceItemId: string,
) {
  const item = payments.priceCatalog.find((entry) => entry.id === priceItemId)

  if (!item) {
    throw new Error(`Pricing option "${priceItemId}" was not found.`)
  }

  if (!item.active) {
    throw new Error(`Pricing option "${item.name}" is not currently active.`)
  }

  if (item.provider !== 'stripe') {
    throw new Error(
      `Pricing option "${item.name}" is linked to ${item.provider}, not Stripe.`,
    )
  }

  return item
}

function getSubscriptionAmount(billingCycle: 'monthly' | 'annual') {
  return billingCycle === 'annual'
    ? partnerProSubscriptionPricing.annual
    : partnerProSubscriptionPricing.monthly
}

const partnerProSubscriptionPricing = {
  monthly: '79',
  annual: '790',
} as const

function getStripeCurrency(currency: StripePaymentConfig['currency']) {
  return currency.toLowerCase() as 'cad' | 'usd'
}

function getStripeInterval(billingCycle: 'monthly' | 'annual') {
  return billingCycle === 'annual' ? 'year' : 'month'
}

function ensureStripeEnabled(payments: StripePaymentConfig) {
  if (!payments.enabled) {
    throw new Error('Payments are disabled in platform configuration.')
  }
  if (payments.provider !== 'stripe') {
    throw new Error(
      `The current payment provider is "${payments.provider}", not Stripe.`,
    )
  }
}

function getCheckoutSuccessUrl(request: Request, payments: StripePaymentConfig) {
  return resolveAbsoluteUrl(
    request,
    payments.checkoutSuccessUrl,
    '/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}#billing',
  )
}

function getCheckoutCancelUrl(request: Request, payments: StripePaymentConfig) {
  return resolveAbsoluteUrl(
    request,
    payments.checkoutCancelUrl,
    '/settings?checkout=cancel#billing',
  )
}

function getBillingPortalReturnUrl(
  request: Request,
  payments: StripePaymentConfig,
) {
  return resolveAbsoluteUrl(
    request,
    payments.billingPortalReturnUrl,
    '/settings#billing',
  )
}

export function parseStripeCheckoutRequest(body: unknown) {
  return checkoutRequestSchema.parse(body)
}

export function parseStripeBillingPortalRequest(body: unknown) {
  return billingPortalRequestSchema.parse(body)
}

export function parseStripeCheckoutLookupRequest(body: unknown) {
  return checkoutLookupRequestSchema.parse(body)
}

export async function readResolvedPlatformPayments(
  _database: QueryClient,
  documentStore: DocumentStore,
  overrides?: {
    platformName?: string
    payments?: StripePaymentConfig
  },
) {
  const storedConfig = await readPlatformStateValue(
    documentStore,
    'bconomics-platform-config-v1',
  )

  if (storedConfig && typeof storedConfig === 'object' && !Array.isArray(storedConfig)) {
    const config = storedConfig as Record<string, unknown>
    const storedPayments = config.payments
    if (!storedPayments || typeof storedPayments !== 'object' || Array.isArray(storedPayments)) {
      throw new Error('Stripe settings have not been configured yet.')
    }

    return {
      platformName:
        typeof config.platformName === 'string' && config.platformName.trim()
          ? config.platformName.trim()
          : 'Bconomics.ai',
      payments: paymentConfigSchema.parse(storedPayments),
    } satisfies ResolvedPlatformPayments
  }

  // Unit tests may inject a payment payload without a Mongo document store.
  // Never allow this fallback in a real environment.
  if (environment.NODE_ENV === 'test' && overrides?.payments) {
    return {
      platformName: overrides.platformName?.trim() || 'Bconomics.ai',
      payments: overrides.payments,
    } satisfies ResolvedPlatformPayments
  }

  throw new Error('Platform payment settings have not been configured yet.')
}

export async function createStripeCheckoutSession(
  request: Request,
  database: QueryClient,
  documentStore: DocumentStore,
  context: BillingContext,
  payload: StripeCheckoutRequest,
) {
  const resolved = await readResolvedPlatformPayments(database, documentStore, {
    platformName: payload.platformName,
    payments: payload.payments,
  })
  const { platformName, payments } = resolved
  ensureStripeEnabled(payments)

  if (payload.customerId) {
    await assertOwnedBillingResource(database, context, 'customer', payload.customerId)
  }

  const stripe = createStripeClient(payments)
  const selectedItem = payload.priceItemId
    ? resolveStripeCatalogItem(payments, payload.priceItemId)
    : null
  const billingCycle = payload.billingCycle ?? 'monthly'
  const checkoutMode =
    selectedItem?.billingType === 'one-time' ? 'payment' : 'subscription'
  const session = await stripe.checkout.sessions.create({
    mode: checkoutMode,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    success_url: getCheckoutSuccessUrl(request, payments),
    cancel_url: getCheckoutCancelUrl(request, payments),
    customer: payload.customerId,
    customer_email: payload.customerId ? undefined : payload.customerEmail,
    line_items: [
      selectedItem
        ? selectedItem.externalPriceId.trim()
          ? {
              quantity: 1,
              price: selectedItem.externalPriceId.trim(),
            }
          : {
              quantity: 1,
              price_data: {
                currency: getStripeCurrency(selectedItem.currency),
                ...(selectedItem.billingType === 'one-time'
                  ? {}
                  : {
                      recurring: {
                        interval:
                          selectedItem.billingType === 'annual' ? 'year' : 'month',
                      },
                    }),
                unit_amount: parseAmountToMinorUnits(selectedItem.amount),
                product_data: {
                  name: selectedItem.name,
                  description:
                    selectedItem.description ||
                    `${selectedItem.offeringType} purchase for ${platformName}.`,
                },
              },
            }
        : {
            quantity: 1,
            price_data: {
              currency: getStripeCurrency(payments.currency),
              recurring: {
                interval: getStripeInterval(billingCycle),
              },
              unit_amount: parseAmountToMinorUnits(
                getSubscriptionAmount(billingCycle),
              ),
              product_data: {
                name: `${platformName} Partner Pro`,
                description: `Recurring ${billingCycle} subscription for ${platformName}.`,
              },
            },
          },
    ],
    metadata: {
      billing_cycle: selectedItem?.billingType ?? billingCycle,
      price_item_id: selectedItem?.id ?? 'partner-pro',
      price_item_name: selectedItem?.name ?? `${platformName} Partner Pro`,
      platform_name: platformName,
      test_mode: String(payments.testMode),
      workspace_id: context.workspaceId,
      user_id: context.userId,
    },
    ...(checkoutMode === 'subscription'
      ? {
          subscription_data: {
            metadata: {
              billing_cycle: selectedItem?.billingType ?? billingCycle,
              price_item_id: selectedItem?.id ?? 'partner-pro',
              price_item_name: selectedItem?.name ?? `${platformName} Partner Pro`,
              platform_name: platformName,
              test_mode: String(payments.testMode),
              workspace_id: context.workspaceId,
              user_id: context.userId,
            },
          },
        }
      : {
          payment_intent_data: {
            metadata: {
              billing_cycle: selectedItem?.billingType ?? 'one-time',
              price_item_id: selectedItem?.id ?? 'one-time',
              price_item_name: selectedItem?.name ?? `${platformName} purchase`,
              platform_name: platformName,
              test_mode: String(payments.testMode),
              workspace_id: context.workspaceId,
              user_id: context.userId,
            },
          },
        }),
  })

  if (!session.url) {
    throw new Error('Stripe did not return a hosted Checkout URL.')
  }

  await bindBillingResource(database, context, 'checkout_session', session.id)
  if (typeof session.customer === 'string') {
    await bindBillingResource(database, context, 'customer', session.customer)
  }

  return {
    id: session.id,
    url: session.url,
  }
}

export async function createStripeBillingPortalSession(
  request: Request,
  database: QueryClient,
  documentStore: DocumentStore,
  context: BillingContext,
  payload: StripeBillingPortalRequest,
) {
  const { payments } = await readResolvedPlatformPayments(database, documentStore, {
    platformName: payload.platformName,
    payments: payload.payments,
  })
  ensureStripeEnabled(payments)
  await assertOwnedBillingResource(database, context, 'customer', payload.customerId)

  const stripe = createStripeClient(payments)
  const session = await stripe.billingPortal.sessions.create({
    customer: payload.customerId,
    return_url: getBillingPortalReturnUrl(request, payments),
  })

  return {
    url: session.url,
  }
}

export async function lookupStripeCheckoutSession(
  database: QueryClient,
  documentStore: DocumentStore,
  context: BillingContext,
  payload: StripeCheckoutLookupRequest,
) {
  const { payments } = await readResolvedPlatformPayments(database, documentStore, {
    payments: payload.payments,
  })
  ensureStripeEnabled(payments)

  const stripe = createStripeClient(payments)
  await assertOwnedBillingResource(
    database,
    context,
    'checkout_session',
    payload.sessionId,
  )
  const session = await stripe.checkout.sessions.retrieve(payload.sessionId)

  if (typeof session.customer === 'string') {
    await bindBillingResource(database, context, 'customer', session.customer)
  }

  return {
    customerId: typeof session.customer === 'string' ? session.customer : null,
    subscriptionId:
      typeof session.subscription === 'string' ? session.subscription : null,
    paymentStatus: session.payment_status ?? null,
    status: session.status ?? null,
  }
}

export async function verifyStripeWebhookEvent(
  requestBody: Buffer,
  signature: string,
  _database: QueryClient,
) {
  const webhookReference =
    process.env.STRIPE_WEBHOOK_SECRET?.trim() || 'STRIPE_WEBHOOK_SECRET'
  const webhookSecret = readSecret(webhookReference, 'webhookSecretReference')
  const stripeSecretKey =
    process.env.STRIPE_TEST_SECRET_KEY?.trim() ||
    process.env.STRIPE_LIVE_SECRET_KEY?.trim()

  if (!stripeSecretKey) {
    throw new Error(
      'Stripe webhook validation requires STRIPE_TEST_SECRET_KEY or STRIPE_LIVE_SECRET_KEY.',
    )
  }

  const stripe = new Stripe(stripeSecretKey)

  return stripe.webhooks.constructEvent(requestBody, signature, webhookSecret)
}

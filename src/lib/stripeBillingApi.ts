import type { PaymentConfig } from '../config/platform'

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

type StripeCheckoutSessionResponse = {
  id: string
  url: string
}

type StripeBillingPortalSessionResponse = {
  url: string
}

type StripeCheckoutLookupResponse = {
  customerId: string | null
  subscriptionId: string | null
  paymentStatus: string | null
  status: string | null
}

type StripeCheckoutRequest = {
  billingCycle?: 'monthly' | 'annual'
  priceItemId?: string
  customerEmail?: string
  customerId?: string
  platformName: string
  payments: PaymentConfig
}

type StripeBillingPortalRequest = {
  customerId: string
  platformName: string
  payments: PaymentConfig
}

type StripeCheckoutLookupRequest = {
  sessionId: string
  payments: PaymentConfig
}

async function postJson<TResponse>(
  path: string,
  body: unknown,
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `Stripe request failed with status ${response.status}.`
    try {
      const errorBody = (await response.json()) as { message?: string }
      if (errorBody.message) message = errorBody.message
    } catch {
      // Ignore non-JSON errors and return the generic message.
    }

    throw new Error(message)
  }

  return (await response.json()) as TResponse
}

export function createStripeCheckoutSession(request: StripeCheckoutRequest) {
  return postJson<StripeCheckoutSessionResponse>(
    '/payments/stripe/checkout-session',
    request,
  )
}

export function createStripeBillingPortalSession(
  request: StripeBillingPortalRequest,
) {
  return postJson<StripeBillingPortalSessionResponse>(
    '/payments/stripe/billing-portal',
    request,
  )
}

export function lookupStripeCheckoutSession(
  request: StripeCheckoutLookupRequest,
) {
  return postJson<StripeCheckoutLookupResponse>(
    '/payments/stripe/checkout-session/lookup',
    request,
  )
}

import type { SyncedResourceRecord } from './fundingSources'

export type ToolType =
  | 'Software'
  | 'Cloud Service'
  | 'Financial Service'
  | 'Credit Card'

export type ToolPricing =
  | 'Free plan'
  | 'Paid plans'
  | 'Usage-based'
  | 'Compare offers'

export type ToolRecord = {
  id: string
  name: string
  description: string
  category: string
  bestFor: string
  type: ToolType
  pricing: ToolPricing
  region: 'Canada' | 'Global'
  provider: string
  tags: string[]
  visits: number
  updatedAt: string
  featured: boolean
  partnerOffer: boolean
  url: string
  sourceId?: string
  sourceName: string
}

export const builtInTools: ToolRecord[] = [
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description:
      'Business email, shared files, meetings, calendars, and collaborative documents in one workspace.',
    category: 'Productivity',
    bestFor: 'Team communication',
    type: 'Software',
    pricing: 'Paid plans',
    region: 'Global',
    provider: 'Google',
    tags: ['Email', 'Documents', 'Meetings'],
    visits: 2840,
    updatedAt: 'Updated this week',
    featured: true,
    partnerOffer: false,
    url: 'https://workspace.google.com/',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'aws-activate',
    name: 'AWS Activate',
    description:
      'Startup-focused access to cloud infrastructure resources, technical guidance, and provider programs.',
    category: 'Cloud & infrastructure',
    bestFor: 'Building scalable products',
    type: 'Cloud Service',
    pricing: 'Usage-based',
    region: 'Global',
    provider: 'Amazon Web Services',
    tags: ['Hosting', 'Database', 'AI infrastructure'],
    visits: 2310,
    updatedAt: 'Updated this week',
    featured: true,
    partnerOffer: true,
    url: 'https://aws.amazon.com/activate/',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'hubspot-crm',
    name: 'HubSpot CRM',
    description:
      'Manage contacts, sales pipelines, marketing activity, and customer conversations from one platform.',
    category: 'Sales & CRM',
    bestFor: 'Building a sales pipeline',
    type: 'Software',
    pricing: 'Free plan',
    region: 'Global',
    provider: 'HubSpot',
    tags: ['CRM', 'Sales', 'Marketing'],
    visits: 1980,
    updatedAt: 'Updated this month',
    featured: true,
    partnerOffer: false,
    url: 'https://www.hubspot.com/products/crm',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description:
      'Accept online payments, manage subscriptions, issue invoices, and build financial workflows.',
    category: 'Payments',
    bestFor: 'Selling online',
    type: 'Financial Service',
    pricing: 'Usage-based',
    region: 'Global',
    provider: 'Stripe',
    tags: ['Payments', 'Billing', 'Subscriptions'],
    visits: 1740,
    updatedAt: 'Updated this month',
    featured: true,
    partnerOffer: false,
    url: 'https://stripe.com/en-ca',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'quickbooks-online',
    name: 'QuickBooks Online',
    description:
      'Track income and expenses, manage invoices, reconcile transactions, and prepare business reports.',
    category: 'Accounting',
    bestFor: 'Managing business finances',
    type: 'Software',
    pricing: 'Paid plans',
    region: 'Canada',
    provider: 'Intuit',
    tags: ['Bookkeeping', 'Invoices', 'Reporting'],
    visits: 1520,
    updatedAt: 'Updated this month',
    featured: false,
    partnerOffer: false,
    url: 'https://quickbooks.intuit.com/ca/',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'notion',
    name: 'Notion',
    description:
      'Organize company knowledge, projects, product plans, operating procedures, and team documentation.',
    category: 'Productivity',
    bestFor: 'Company operations',
    type: 'Software',
    pricing: 'Free plan',
    region: 'Global',
    provider: 'Notion',
    tags: ['Projects', 'Knowledge base', 'Docs'],
    visits: 1310,
    updatedAt: 'Updated last month',
    featured: false,
    partnerOffer: false,
    url: 'https://www.notion.com/',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description:
      'Launch and operate an online store with product, payment, order, and customer management.',
    category: 'Commerce',
    bestFor: 'Launching an online store',
    type: 'Software',
    pricing: 'Paid plans',
    region: 'Canada',
    provider: 'Shopify',
    tags: ['E-commerce', 'POS', 'Orders'],
    visits: 1160,
    updatedAt: 'Updated last month',
    featured: false,
    partnerOffer: false,
    url: 'https://www.shopify.com/ca',
    sourceName: 'Bconomics directory',
  },
  {
    id: 'rbc-business-credit-cards',
    name: 'RBC Business Credit Cards',
    description:
      'Compare business credit card options for company purchases, expense management, and rewards.',
    category: 'Business banking',
    bestFor: 'Managing business expenses',
    type: 'Credit Card',
    pricing: 'Compare offers',
    region: 'Canada',
    provider: 'RBC Royal Bank',
    tags: ['Credit card', 'Expenses', 'Rewards'],
    visits: 920,
    updatedAt: 'Updated last month',
    featured: false,
    partnerOffer: false,
    url: 'https://www.rbcroyalbank.com/business/credit-cards/',
    sourceName: 'Bconomics directory',
  },
]

function inferToolType(record: SyncedResourceRecord): ToolType {
  const content = `${record.title} ${record.description} ${record.category}`.toLowerCase()
  if (content.includes('credit card') || content.includes('mastercard') || content.includes('visa')) {
    return 'Credit Card'
  }
  if (content.includes('bank') || content.includes('payment') || content.includes('finance')) {
    return 'Financial Service'
  }
  if (content.includes('cloud') || content.includes('hosting') || content.includes('server')) {
    return 'Cloud Service'
  }
  return 'Software'
}

export function mapSyncedTools(records: SyncedResourceRecord[]): ToolRecord[] {
  return records.map((record) => ({
    id: `synced-${record.id}`,
    name: record.title,
    description: record.description,
    category: record.category || 'Business software',
    bestFor: record.category || 'Business operations',
    type: inferToolType(record),
    pricing: 'Paid plans',
    region: 'Canada',
    provider: record.sourceName,
    tags: [record.category || 'Business'],
    visits: 0,
    updatedAt: record.updatedAt,
    featured: record.status === 'Active',
    partnerOffer: false,
    url: record.url,
    sourceId: record.sourceId,
    sourceName: record.sourceName,
  }))
}

export function loadToolCatalog(records: SyncedResourceRecord[]) {
  return [...builtInTools, ...mapSyncedTools(records)]
}

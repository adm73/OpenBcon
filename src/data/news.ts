import {
  loadResourceRecords,
  type FundingDataSource,
  type SyncedResourceRecord,
} from './fundingSources'

export type NewsAccent = 'violet' | 'teal' | 'orange' | 'navy'

export type NewsArticle = {
  slug: string
  category:
    | 'product'
    | 'funding'
    | 'community'
    | 'practice'
    | 'fundingAlerts'
    | 'aiBusiness'
    | 'startupCapital'
  date: string
  readMinutes: number
  accent: NewsAccent
  translationKey?: string
  sectionKeys?: string[]
  title?: string
  summary?: string
  imageUrl?: string
  sections?: Array<{ heading: string; body: string }>
}

export const newsArticles: NewsArticle[] = [
  {
    slug: 'one-connected-funding-workflow',
    category: 'product',
    date: '2026-08-11',
    readMinutes: 4,
    accent: 'violet',
    translationKey: 'connectedWorkflow',
    sectionKeys: ['context', 'workflow', 'next'],
  },
  {
    slug: 'making-grants-and-loans-easier-to-navigate',
    category: 'funding',
    date: '2026-08-05',
    readMinutes: 5,
    accent: 'teal',
    translationKey: 'fundingCatalog',
    sectionKeys: ['problem', 'signal', 'practice'],
  },
  {
    slug: 'why-open-funding-infrastructure-matters',
    category: 'community',
    date: '2026-07-28',
    readMinutes: 3,
    accent: 'orange',
    translationKey: 'openInfrastructure',
    sectionKeys: ['belief', 'community', 'invitation'],
  },
  {
    slug: 'from-funding-package-to-advisory-system',
    category: 'practice',
    date: '2026-07-18',
    readMinutes: 6,
    accent: 'navy',
    translationKey: 'advisorySystem',
    sectionKeys: ['shift', 'system', 'outcome'],
  },
]

export function getNewsArticle(slug: string | undefined) {
  return newsArticles.find((article) => article.slug === slug)
}

function metadataValue(record: SyncedResourceRecord, aliases: string[]) {
  const metadata = record.metadata ?? {}
  const normalized = new Map(
    Object.entries(metadata).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      value,
    ]),
  )

  for (const alias of aliases) {
    const value = normalized.get(alias.toLowerCase().replace(/[^a-z0-9]/g, ''))
    if (value?.trim()) return value.trim()
  }
  return ''
}

function dynamicNewsArticle(record: SyncedResourceRecord, index: number): NewsArticle {
  const category = metadataValue(record, ['category', 'type']).toLowerCase()
  const categoryKey = category.replace(/[\s_-]/g, '')
  const supportedCategory: NewsArticle['category'] = categoryKey.includes('fundingalert') || categoryKey.includes('fund')
    ? 'fundingAlerts'
    : categoryKey.includes('aibusiness') || categoryKey.includes('artificialintelligence')
      ? 'aiBusiness'
      : categoryKey.includes('community')
        ? 'community'
        : categoryKey.includes('practice')
          ? 'practice'
          : categoryKey.includes('product')
            ? 'product'
            : 'startupCapital'
  const content = record.content || record.description
  const slug = record.slug || record.id
  const rawDate = record.date || record.updatedAt
  const date = Number.isFinite(Date.parse(`${rawDate}T12:00:00`))
    ? rawDate
    : new Date().toISOString().slice(0, 10)

  return {
    slug,
    category: supportedCategory,
    date,
    readMinutes: record.readMinutes || 1,
    accent: (['violet', 'teal', 'orange', 'navy'] as NewsAccent[])[index % 4],
    title: record.title,
    summary:
      metadataValue(record, ['summary', 'subtitle', 'excerpt']) || record.description,
    imageUrl: record.imageUrl,
    sections: content
      ? [{
          heading: metadataValue(record, ['section heading', 'heading']) || 'Article',
          body: content,
        }]
      : [],
  }
}

export function getSyncedNewsArticles(dataSources: FundingDataSource[]) {
  const enabledSourceIds = dataSources
    .filter((source) => source.enabled && source.module === 'news')
    .map((source) => source.id)
  const records = loadResourceRecords('news', enabledSourceIds)
  return records.length ? records.map(dynamicNewsArticle) : newsArticles
}

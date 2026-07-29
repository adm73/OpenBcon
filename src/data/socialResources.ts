import type { SyncedResourceRecord } from './fundingSources'

export type SocialResourceType =
  | 'Investor'
  | 'Angel Investor'
  | 'VC Fund'
  | 'Accelerator'
  | 'Advisor'
  | 'Company'

export type SocialResourceRecord = {
  id: string
  name: string
  description: string
  type: SocialResourceType
  organization: string
  location: string
  sectors: string[]
  stages: string[]
  ticket: string
  verified: boolean
  connection: 'Open to introductions' | 'Warm path available' | 'Research only'
  updatedAt: string
  url: string
  sourceId?: string
  sourceName: string
}

export const builtInSocialResources: SocialResourceRecord[] = [
  {
    id: 'maya-chen',
    name: 'Maya Chen',
    description:
      'Early-stage investor backing Canadian founders building practical climate and enterprise software.',
    type: 'Investor',
    organization: 'Northshore Ventures',
    location: 'Toronto, ON',
    sectors: ['CleanTech', 'B2B SaaS'],
    stages: ['Seed', 'Series A'],
    ticket: '$250K–$2M',
    verified: true,
    connection: 'Open to introductions',
    updatedAt: 'Verified this week',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'david-okafor',
    name: 'David Okafor',
    description:
      'Operator-turned-angel supporting technical founders with go-to-market strategy and follow-on introductions.',
    type: 'Angel Investor',
    organization: 'Independent',
    location: 'Vancouver, BC',
    sectors: ['FinTech', 'B2B SaaS'],
    stages: ['Pre-seed', 'Seed'],
    ticket: '$25K–$150K',
    verified: true,
    connection: 'Warm path available',
    updatedAt: 'Verified 3 days ago',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'maple-leaf-capital',
    name: 'Maple Leaf Capital',
    description:
      'Canadian venture fund investing in technology-enabled manufacturing, climate, and supply-chain businesses.',
    type: 'VC Fund',
    organization: 'Maple Leaf Capital',
    location: 'Canada',
    sectors: ['Advanced Manufacturing', 'CleanTech'],
    stages: ['Series A', 'Growth'],
    ticket: '$1M–$8M',
    verified: true,
    connection: 'Open to introductions',
    updatedAt: 'Verified this month',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'innovate-north',
    name: 'Innovate North Accelerator',
    description:
      'Twelve-week commercialization program connecting high-growth Canadian companies with mentors and investors.',
    type: 'Accelerator',
    organization: 'Innovate North',
    location: 'Montreal, QC',
    sectors: ['Technology', 'Consumer'],
    stages: ['Pre-seed', 'Seed'],
    ticket: 'Program support',
    verified: true,
    connection: 'Open to introductions',
    updatedAt: 'Verified this month',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'ravi-patel',
    name: 'Ravi Patel',
    description:
      'Investment principal focused on scalable health, food, and community-impact companies across Canada.',
    type: 'Investor',
    organization: 'First Growth Partners',
    location: 'Calgary, AB',
    sectors: ['HealthTech', 'Food & Beverage'],
    stages: ['Seed', 'Series A'],
    ticket: '$500K–$3M',
    verified: true,
    connection: 'Research only',
    updatedAt: 'Verified last month',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'amira-wilson',
    name: 'Amira Wilson',
    description:
      'Funding advisor helping founders prepare investor materials, financial narratives, and capital strategies.',
    type: 'Advisor',
    organization: 'ScalePath Advisory',
    location: 'Halifax, NS',
    sectors: ['Professional Services', 'Technology'],
    stages: ['Pre-seed', 'Seed'],
    ticket: 'Advisory',
    verified: false,
    connection: 'Warm path available',
    updatedAt: 'Updated last month',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'meridian-foods',
    name: 'Meridian Foods',
    description:
      'National food company seeking pilot partnerships with emerging Canadian brands and manufacturing innovators.',
    type: 'Company',
    organization: 'Meridian Foods',
    location: 'Toronto, ON',
    sectors: ['Food & Beverage', 'Retail'],
    stages: ['Commercial pilot', 'Growth'],
    ticket: 'Strategic partnership',
    verified: true,
    connection: 'Open to introductions',
    updatedAt: 'Verified 2 months ago',
    url: '',
    sourceName: 'Bconomics network',
  },
  {
    id: 'launch-east',
    name: 'Launch East Ventures',
    description:
      'Atlantic Canadian seed fund and founder network supporting export-oriented technology companies.',
    type: 'VC Fund',
    organization: 'Launch East Ventures',
    location: 'Atlantic Canada',
    sectors: ['Technology', 'OceanTech'],
    stages: ['Pre-seed', 'Seed'],
    ticket: '$100K–$1M',
    verified: true,
    connection: 'Warm path available',
    updatedAt: 'Verified 2 months ago',
    url: '',
    sourceName: 'Bconomics network',
  },
]

function inferType(record: SyncedResourceRecord): SocialResourceType {
  const content = `${record.title} ${record.description} ${record.category}`.toLowerCase()
  if (content.includes('angel')) return 'Angel Investor'
  if (content.includes('venture') || content.includes('vc') || content.includes('fund')) {
    return 'VC Fund'
  }
  if (content.includes('accelerator') || content.includes('incubator')) {
    return 'Accelerator'
  }
  if (content.includes('advisor') || content.includes('consult')) return 'Advisor'
  if (content.includes('company') || content.includes('corporate')) return 'Company'
  return 'Investor'
}

export function mapSyncedSocialResources(
  records: SyncedResourceRecord[],
): SocialResourceRecord[] {
  return records.map((record) => ({
    id: `synced-${record.id}`,
    name: record.title,
    description: record.description,
    type: inferType(record),
    organization: record.category || 'Independent',
    location: 'Canada',
    sectors: ['General'],
    stages: ['Seed'],
    ticket: 'Contact for details',
    verified: record.status === 'Active',
    connection:
      record.status === 'Active' ? 'Open to introductions' : 'Research only',
    updatedAt: record.updatedAt,
    url: record.url,
    sourceId: record.sourceId,
    sourceName: record.sourceName,
  }))
}

export function loadSocialResourceCatalog(records: SyncedResourceRecord[]) {
  return [...builtInSocialResources, ...mapSyncedSocialResources(records)]
}

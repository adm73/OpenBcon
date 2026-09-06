import type { DocumentStore } from './documentStore'
import { platformOwnerId } from './config'

export const newsPipelineStateKey = 'bconomics-news-pipeline-state-v1'
export const syncedResourcesStateKey = 'bconomics-synced-resource-records-v1'
export const newsPipelineIntervalMs = 6 * 60 * 60 * 1000

const defaultNewsSpreadsheetUrl =
  'https://docs.google.com/spreadsheets/d/12Ae0WAJC-tU_xjEBwLCBxKEgMHZU-5YppUzhP4r90TI/edit?gid=1860086141#gid=1860086141'
const defaultCaseStudiesSpreadsheetUrl =
  'https://docs.google.com/spreadsheets/d/12Ae0WAJC-tU_xjEBwLCBxKEgMHZU-5YppUzhP4r90TI/edit'

type PipelineSource = {
  id: string
  name: string
  module: 'news' | 'case-studies'
  provider: string
  enabled: boolean
  spreadsheetUrl?: string
  sheetName?: string
}

type ResourceRecord = {
  id: string
  module: 'news' | 'case-studies'
  title: string
  description: string
  category: string
  status: 'Active'
  url: string
  updatedAt: string
  sourceId: string
  sourceName: string
  slug: string
  date: string
  readMinutes: number
  imageUrl?: string
  content?: string
  metadata: Record<string, string>
}

export type NewsPipelineRunSummary = {
  sources: number
  records: number
  added: number
  updated: number
  removed: number
}

export type NewsPipelineRun = NewsPipelineRunSummary & {
  startedAt: string
  finishedAt: string
  status: 'success' | 'error'
  error?: string
}

export type NewsPipelineState = {
  intervalHours: 6
  status: 'idle' | 'running' | 'success' | 'error'
  lastRunAt: string | null
  nextRunAt: string | null
  lastSuccessAt: string | null
  lastError: string
  lastRunSummary: NewsPipelineRunSummary
  recentRuns: NewsPipelineRun[]
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const emptySummary: NewsPipelineRunSummary = {
  sources: 0,
  records: 0,
  added: 0,
  updated: 0,
  removed: 0,
}

export function defaultNewsPipelineState(now = new Date()): NewsPipelineState {
  return {
    intervalHours: 6,
    status: 'idle',
    lastRunAt: null,
    nextRunAt: new Date(now.getTime() + newsPipelineIntervalMs).toISOString(),
    lastSuccessAt: null,
    lastError: '',
    lastRunSummary: { ...emptySummary },
    recentRuns: [],
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    const next = csv[index + 1]
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(cell.trim())
      if (row.some((value) => value)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  row.push(cell.trim())
  if (row.some((value) => value)) rows.push(row)

  const headers = rows.shift() ?? []
  return rows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header.trim(), values[index] ?? '']),
  ))
}

function field(row: Record<string, string>, aliases: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]))
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias))?.trim()
    if (value) return value
  }
  return ''
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'untitled'
}

function sourceCsvUrl(source: PipelineSource) {
  const url = source.spreadsheetUrl?.trim() || ''
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return url
  const sheet = source.sheetName?.trim()
  if (sheet) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`
  }
  const gid = url.match(/[?#&]gid=(\d+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
}

function classifyNews(title: string, content: string, metadata: Record<string, string>) {
  const explicit = field(metadata, ['category', 'type']).toLowerCase()
  const text = `${explicit} ${title} ${content}`.toLowerCase()
  if (/fund|grant|loan|subsid|government|financ|deadline|eligib|program/.test(text)) return 'fundingAlerts'
  if (/\bai\b|openai|anthropic|google|microsoft|llm|automation|copilot|generative|model/.test(text)) return 'aiBusiness'
  return 'startupCapital'
}

function readMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.min(12, Math.ceil(words / 180)))
}

function safeDate(value: string, fallback: Date) {
  const timestamp = Date.parse(`${value}T12:00:00`)
  return Number.isFinite(timestamp) ? value : fallback.toISOString().slice(0, 10)
}

function defaultSources(): PipelineSource[] {
  return [
    {
      id: 'google-sheets-news',
      name: 'News',
      module: 'news',
      provider: 'google-sheets',
      enabled: true,
      spreadsheetUrl: defaultNewsSpreadsheetUrl,
    },
    {
      id: 'google-sheets-case-studies',
      name: 'Case Studies',
      module: 'case-studies',
      provider: 'google-sheets',
      enabled: true,
      spreadsheetUrl: defaultCaseStudiesSpreadsheetUrl,
      sheetName: 'Case Studies',
    },
  ]
}

function configuredSources(value: unknown) {
  const config = asRecord(value)
  const savedSources = Array.isArray(config?.dataSources) ? config.dataSources : []
  const sources = savedSources
    .map(asRecord)
    .filter((source): source is Record<string, unknown> => Boolean(source))
    .map((source) => ({
      id: asString(source.id),
      name: asString(source.name),
      module: asString(source.module) as PipelineSource['module'],
      provider: asString(source.provider),
      enabled: source.enabled !== false,
      spreadsheetUrl: asString(source.spreadsheetUrl),
      sheetName: asString(source.sheetName),
    }))
    .filter((source) =>
      source.enabled &&
      (source.module === 'news' || source.module === 'case-studies') &&
      source.provider === 'google-sheets' &&
      source.spreadsheetUrl,
    )

  return sources.length > 0 ? sources : defaultSources()
}

function toResourceRecords(source: PipelineSource, rows: Record<string, string>[], now: Date) {
  const usedSlugs = new Map<string, number>()
  return rows.flatMap((row, index) => {
    const title = field(row, ['title', 'name', 'headline'])
    if (!title) return []
    const content = field(row, ['content', 'body', 'article', 'full text'])
    const description = field(row, ['description', 'summary', 'excerpt', 'subtitle']) || content.slice(0, 260)
    const date = safeDate(field(row, ['date', 'published', 'published at', 'publish date', 'updated']), now)
    const baseSlug = slugify(field(row, ['slug', 'path', 'handle']) || title)
    const count = usedSlugs.get(baseSlug) ?? 0
    usedSlugs.set(baseSlug, count + 1)
    const slug = count ? `${baseSlug}-${count + 1}` : baseSlug
    const metadata = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value]))
    const id = `${source.id}:${slug}`
    return [{
      id,
      module: source.module,
      title,
      description,
      category: source.module === 'news' ? classifyNews(title, content, metadata) : 'caseStudy',
      status: 'Active' as const,
      url: field(row, ['url', 'link', 'website', 'source']),
      updatedAt: new Date(`${date}T12:00:00`).toISOString(),
      sourceId: source.id,
      sourceName: source.name,
      slug,
      date,
      readMinutes: readMinutes(content || description),
      imageUrl: field(row, ['image', 'image url', 'image_url', 'thumbnail']) || undefined,
      content: content || undefined,
      metadata: { ...metadata, pipelineIndex: String(index) },
    }]
  })
}

function mergeResourceRecords(existing: ResourceRecord[], next: ResourceRecord[], sourceIds: Set<string>) {
  const retained = existing.filter((record) => !sourceIds.has(record.sourceId))
  const deduped = new Map<string, ResourceRecord>()
  for (const record of [...retained, ...next]) {
    const key = `${record.module}:${record.title.toLowerCase().trim()}:${record.url}`
    if (!deduped.has(key)) deduped.set(key, record)
  }
  return [...deduped.values()]
}

function calculateSummary(previous: ResourceRecord[], next: ResourceRecord[], sources: number): NewsPipelineRunSummary {
  const previousById = new Map(previous.map((record) => [record.id, record]))
  const nextById = new Map(next.map((record) => [record.id, record]))
  let added = 0
  let updated = 0
  for (const [id, record] of nextById) {
    const old = previousById.get(id)
    if (!old) added += 1
    else if (JSON.stringify(old) !== JSON.stringify(record)) updated += 1
  }
  let removed = 0
  for (const id of previousById.keys()) if (!nextById.has(id)) removed += 1
  return { sources, records: next.length, added, updated, removed }
}

async function writePipelineState(store: DocumentStore, state: NewsPipelineState) {
  await store.upsertState({
    scope: 'platform',
    ownerId: platformOwnerId,
    key: newsPipelineStateKey,
    value: state,
    updatedAt: new Date(),
  })
}

export async function readNewsPipelineState(store: DocumentStore) {
  const value = await store.findStateValue('platform', platformOwnerId, newsPipelineStateKey)
  const record = asRecord(value)
  return record ? { ...defaultNewsPipelineState(), ...record } as NewsPipelineState : defaultNewsPipelineState()
}

export async function runNewsPipeline(
  store: DocumentStore,
  options: { fetcher?: FetchLike; now?: Date } = {},
) {
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? new Date()
  const startedAt = now.toISOString()
  const previousState = await readNewsPipelineState(store)
  const runningState: NewsPipelineState = {
    ...previousState,
    status: 'running',
    lastRunAt: startedAt,
    lastError: '',
  }
  await writePipelineState(store, runningState)

  try {
    const config = await store.findStateValue('platform', platformOwnerId, 'bconomics-platform-config-v1')
    const sources = configuredSources(config)
    const sourceIds = new Set(sources.map((source) => source.id))
    const resourceValue = await store.findStateValue('platform', platformOwnerId, syncedResourcesStateKey)
    const previous = Array.isArray(resourceValue) ? resourceValue.filter((value): value is ResourceRecord => Boolean(asRecord(value))) : []
    const synced: ResourceRecord[] = []

    for (const source of sources) {
      const response = await fetcher(sourceCsvUrl(source), { headers: { accept: 'text/csv,text/plain' } })
      if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}.`)
      const rows = parseCsv(await response.text())
      synced.push(...toResourceRecords(source, rows, now))
    }

    const next = mergeResourceRecords(previous, synced, sourceIds)
    const summary = calculateSummary(previous, next, sources.length)
    await store.upsertState({
      scope: 'platform',
      ownerId: platformOwnerId,
      key: syncedResourcesStateKey,
      value: next,
      updatedAt: now,
    })
    const finishedAt = new Date(now.getTime()).toISOString()
    const run: NewsPipelineRun = { ...summary, startedAt, finishedAt, status: 'success' }
    const state: NewsPipelineState = {
      ...runningState,
      status: 'success',
      nextRunAt: new Date(now.getTime() + newsPipelineIntervalMs).toISOString(),
      lastSuccessAt: finishedAt,
      lastRunSummary: summary,
      recentRuns: [run, ...runningState.recentRuns].slice(0, 10),
    }
    await writePipelineState(store, state)
    return state
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const finishedAt = new Date(now.getTime()).toISOString()
    const run: NewsPipelineRun = {
      ...emptySummary,
      startedAt,
      finishedAt,
      status: 'error',
      error: message,
    }
    const state: NewsPipelineState = {
      ...runningState,
      status: 'error',
      nextRunAt: new Date(now.getTime() + newsPipelineIntervalMs).toISOString(),
      lastError: message,
      recentRuns: [run, ...runningState.recentRuns].slice(0, 10),
    }
    await writePipelineState(store, state)
    throw error
  }
}

export function startNewsPipelineScheduler(store: DocumentStore) {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      await runNewsPipeline(store)
    } catch {
      // The error is recorded in shared state and surfaced in Admin Console.
    } finally {
      running = false
    }
  }
  void run()
  const timer = setInterval(run, newsPipelineIntervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}

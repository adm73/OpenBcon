import type { Pool } from 'pg'

type DatabaseApplicationRow = {
  id: string
  app_id: string
  title: string
  funding_program_id?: string
  program_name: string
  program_url: string | null
  company_name: string
  category: string | null
  amount: number | string | null
  status: string
  progress: number
  deadline: string
  deadline_order: number
  documents_complete: number
  documents_total: number
  next_action: string
  note: string
  owner: string
  metadata: unknown
  updated_at: Date
}

type DatabaseStrategicReportRow = {
  report_id: string
  application_id: string
  result: unknown
  context_snapshot: unknown
  completed_at: Date | null
  updated_at: Date
}

function getFundingType(category: string | null) {
  return /loan|financing|credit/i.test(category ?? '') ? 'Loan' : 'Grant'
}

function isUsableStrategicReviewReport(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  return (
    typeof report.id === 'string' &&
    Boolean(report.generatedPackage) &&
    typeof report.generatedPackage === 'object'
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asApplicationLanguage(value: unknown) {
  return value === 'fr-CA' || value === 'zh-CN' ? value : 'en-CA'
}

function documentLabelForSection(
  sectionKey: string,
  documentTypeId: string,
  documentTypeName: string,
) {
  const value = `${sectionKey} ${documentTypeId} ${documentTypeName}`
  if (/financial|forecast|cash[-_\s]?flow/iu.test(value)) {
    return 'Financial Model'
  }
  if (/technology|technical|digital/iu.test(value)) {
    return 'Technology Analysis'
  }
  return 'Business Analysis'
}

function mapStrategicReportRow(
  row: DatabaseStrategicReportRow,
  application: DatabaseApplicationRow,
) {
  const result = asRecord(row.result)
  if (!result) return null

  const context = asRecord(row.context_snapshot)
  const sectionConfigs = new Map(
    (Array.isArray(context?.advisory_sections) ? context.advisory_sections : [])
      .map(asRecord)
      .filter((section): section is Record<string, unknown> => Boolean(section))
      .map((section) => [asString(section.id), section] as const),
  )
  const agents = new Map(
    (Array.isArray(context?.advisory_agents) ? context.advisory_agents : [])
      .map(asRecord)
      .filter((agent): agent is Record<string, unknown> => Boolean(agent))
      .map((agent) => [asString(agent.id), asString(agent.name, 'Advisory agent')] as const),
  )
  const rawSections = Array.isArray(result.sections) ? result.sections : []
  const sections = rawSections
    .map(asRecord)
    .filter((section): section is Record<string, unknown> => Boolean(section))
    .map((section, index) => {
      const id = asString(section.section_key, `section-${index + 1}`)
      const config = sectionConfigs.get(id)
      const documentTypeId = asString(config?.document_type_id)
      const documentTypeName = asString(config?.document_type_name)
      const layout = asString(
        config?.layout,
        /(?:^|-)cover-page$/iu.test(id) ? 'cover-page' : 'main-content',
      )
      return {
        id,
        title: asString(section.title, asString(config?.title, 'Report section')),
        body: asString(section.content),
        agent: agents.get(asString(config?.agent_id)) ?? 'Advisory agent',
        documentLabel: documentLabelForSection(id, documentTypeId, documentTypeName),
        layout: layout === 'cover-page' ? 'cover-page' : 'main-content',
      }
    })
  const forecast = asRecord(result.financial_forecast)
  const completedAt = (row.completed_at ?? row.updated_at).toISOString()
  const keyStrengths = asStringArray(result.key_strengths)
  const risks = asStringArray(result.risks)
  const nextSteps = asStringArray(result.next_steps)
  const programName = asString(result.program_name, application.program_name)
  const businessName = asString(result.business_name, application.company_name)
  const title = asString(result.title, `${programName} Business Plan`)
  const readinessScore = Math.min(
    96,
    Math.max(72, 70 + sections.length * 3 + Math.min(keyStrengths.length, 3)),
  )
  const fundingRequest = `$${Number(application.amount ?? 0).toLocaleString('en-CA')} CAD`
  const generatedPackage = {
    title,
    strategicReportId: row.report_id,
    programName,
    businessName,
    fundingRequest,
    sourceMaterial: 'Database strategic_reports record',
    completedAt,
    readinessScore,
    thoughts: [...keyStrengths, ...risks, ...nextSteps].slice(0, 8),
    documents: [
      {
        title,
        readinessScore,
        summary: asString(result.executive_summary),
        sections: sections.map((section) => ({ title: section.title, body: section.body })),
        metrics: [
          { label: 'Funding Request', value: fundingRequest },
          { label: 'Program', value: programName },
          { label: 'Business', value: businessName },
          { label: 'Sections', value: `${sections.length}` },
        ],
        milestones: nextSteps,
        financialForecast: forecast,
      },
    ],
    sections,
    financialForecast: forecast,
  }

  return {
    id: row.report_id,
    applicationId: application.id,
    generatedPackage,
  }
}

export async function readApplicationsForWorkspace(
  database: Pick<Pool, 'query'>,
  workspaceId: string,
  catalogDatabase: Pick<Pool, 'query'> = database,
) {
  const result = catalogDatabase === database
    ? await database.query<DatabaseApplicationRow>(
      `
      SELECT
        applications.id::text,
        applications.app_id,
        applications.title,
        funding_programs.name AS program_name,
        funding_programs.program_url,
        companies.name AS company_name,
        funding_programs.category,
        applications.amount,
        applications.status,
        applications.progress,
        applications.deadline,
        applications.deadline_order,
        applications.documents_complete,
        applications.documents_total,
        applications.next_action,
        applications.note,
        app_users.display_name AS owner,
        applications.metadata,
        applications.updated_at
      FROM applications
      JOIN funding_programs ON funding_programs.id = applications.funding_program_id
      JOIN companies ON companies.id = applications.company_id
      JOIN app_users ON app_users.id = applications.owner_user_id
      WHERE applications.workspace_id = $1
      ORDER BY applications.id ASC
    `,
      [workspaceId],
    )
    : await database.query<DatabaseApplicationRow>(
      `
      SELECT
        applications.id::text,
        applications.app_id,
        applications.title,
        applications.funding_program_id::text,
        companies.name AS company_name,
        applications.amount,
        applications.status,
        applications.progress,
        applications.deadline,
        applications.deadline_order,
        applications.documents_complete,
        applications.documents_total,
        applications.next_action,
        applications.note,
        app_users.display_name AS owner,
        applications.metadata,
        applications.updated_at
      FROM applications
      JOIN companies ON companies.id = applications.company_id
      JOIN app_users ON app_users.id = applications.owner_user_id
      WHERE applications.workspace_id = $1
      ORDER BY applications.id ASC
    `,
      [workspaceId],
    )

  if (catalogDatabase !== database) {
    const programIds = [...new Set(result.rows.map((row) => row.funding_program_id).filter(Boolean))]
    const programs = new Map<string, {
      program_name: string
      program_url: string | null
      category: string | null
    }>()
    if (programIds.length > 0) {
      const placeholders = programIds.map((_, index) => `$${index + 1}`).join(', ')
      const programResult = await catalogDatabase.query<{
        id: string
        program_name: string
        program_url: string | null
        category: string | null
      }>(
        `
          SELECT id::text, name AS program_name, program_url, category
          FROM funding_programs
          WHERE id::text IN (${placeholders})
        `,
        programIds,
      )
      for (const program of programResult.rows) programs.set(program.id, program)
    }
    for (const row of result.rows) {
      const program = row.funding_program_id ? programs.get(row.funding_program_id) : undefined
      row.program_name = program?.program_name ?? 'Funding program'
      row.program_url = program?.program_url ?? null
      row.category = program?.category ?? null
    }
  }

  const strategicReportsResult = await database.query<DatabaseStrategicReportRow>(
    `
      SELECT
        strategic_reports.id::text AS report_id,
        strategic_reports.application_id::text,
        strategic_reports.result,
        strategic_reports.context_snapshot,
        strategic_reports.completed_at,
        strategic_reports.updated_at
      FROM strategic_reports
      WHERE strategic_reports.workspace_id = $1
        AND strategic_reports.status = 'completed'
        AND strategic_reports.result IS NOT NULL
      ORDER BY strategic_reports.updated_at DESC
    `,
    [workspaceId],
  )
  const strategicReportsByApplicationId = new Map(
    strategicReportsResult.rows.map((report) => [report.application_id, report]),
  )

  return result.rows.map((row) => {
    const databaseReport = strategicReportsByApplicationId.get(row.id)
    const mappedDatabaseReport = databaseReport
      ? mapStrategicReportRow(databaseReport, row)
      : null

    return {
    id: row.id,
    appId: row.app_id,
    title: row.title,
    programName: row.program_name,
    programUrl: row.program_url ?? '',
    company: row.company_name,
    fundingType: getFundingType(row.category),
    amount: Number(row.amount ?? 0),
    status: row.status,
    progress: row.progress,
    deadline: row.deadline,
    deadlineOrder: row.deadline_order,
    owner: row.owner,
    updatedAt: row.updated_at.toISOString(),
    documentsComplete: row.documents_complete,
    documentsTotal: row.documents_total,
    nextAction: row.next_action,
    note: row.note,
    documentTypeIds: asStringArray(asRecord(row.metadata)?.document_type_ids),
    language: asApplicationLanguage(asRecord(row.metadata)?.language),
    strategicReviewReports: mappedDatabaseReport ? [mappedDatabaseReport] : [],
    }
  })
}

export async function syncApplicationsSnapshot(
  database: Pick<Pool, 'query'>,
  workspaceId: string,
  value: unknown,
) {
  if (!Array.isArray(value)) return

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!/^\d+$/u.test(id)) continue

    const reports = Array.isArray(record.strategicReviewReports)
      ? record.strategicReviewReports.filter(isUsableStrategicReviewReport).slice(-1)
      : []
    await database.query(
      `
        UPDATE applications
        SET
          title = $2,
          amount = $3,
          status = $4,
          progress = $5,
          deadline = $6,
          deadline_order = $7,
          documents_complete = $8,
          documents_total = $9,
          next_action = $10,
          note = $11,
          strategic_review_reports = $12::jsonb
        WHERE id = $1
          AND workspace_id = $13
      `,
      [
        id,
        typeof record.title === 'string' ? record.title : 'Application',
        typeof record.amount === 'number' ? record.amount : 0,
        typeof record.status === 'string' ? record.status : 'Draft',
        typeof record.progress === 'number' ? record.progress : 0,
        typeof record.deadline === 'string' ? record.deadline : 'Open',
        typeof record.deadlineOrder === 'number' ? record.deadlineOrder : 999,
        typeof record.documentsComplete === 'number' ? record.documentsComplete : 0,
        typeof record.documentsTotal === 'number' ? record.documentsTotal : 0,
        typeof record.nextAction === 'string' ? record.nextAction : '',
        typeof record.note === 'string' ? record.note : '',
        JSON.stringify(reports),
        workspaceId,
      ],
    )
  }
}

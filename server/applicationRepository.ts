import type { Pool } from 'pg'

type DatabaseApplicationRow = {
  id: string
  app_id: string
  title: string
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
  strategic_review_reports: unknown
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

export async function readApplicationsForWorkspace(
  database: Pick<Pool, 'query'>,
  workspaceId: string,
) {
  const result = await database.query<DatabaseApplicationRow>(
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
        applications.strategic_review_reports,
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

  return result.rows.map((row) => ({
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
    strategicReviewReports: Array.isArray(row.strategic_review_reports)
      ? (() => {
          const reports = row.strategic_review_reports.filter(isUsableStrategicReviewReport)
          const latestReport = reports.at(-1)
          return latestReport ? [latestReport] : []
        })()
      : [],
  }))
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

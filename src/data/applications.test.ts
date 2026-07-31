import { describe, expect, it } from 'vitest'
import {
  getStrategicReviewReports,
  initialApplications,
  loadApplications,
  materializeSavedProgramApplication,
  upsertGeneratedApplication,
  updateApplicationRecord,
} from './applications'
import type { GeneratedPackage } from '../types'

const testGeneratedPackage: GeneratedPackage = {
  title: 'Atlantic Innovation Fund Funding Package',
  programName: 'Atlantic Innovation Fund',
  businessName: 'Blue Harbor Labs',
  fundingRequest: '$42,000 CAD',
  sourceMaterial: 'Official URL',
  completedAt: '2026-07-30T10:00:00.000Z',
  readinessScore: 88,
  thoughts: [],
  documents: [],
  sections: [],
}

describe('applications', () => {
  it('provides a complete demo pipeline', () => {
    const applications = loadApplications()

    expect(applications).toHaveLength(6)
    expect(new Set(applications.map((application) => application.status))).toEqual(
      new Set(['Draft', 'In Review', 'Ready', 'Submitted', 'Awarded']),
    )
    expect(applications[0]?.programUrl).toBe('https://feddev-ontario.canada.ca/en/funding')
  })

  it('updates one application without mutating the original list', () => {
    const updated = updateApplicationRecord(
      initialApplications,
      initialApplications[0].id,
      { status: 'Ready', progress: 90 },
    )

    expect(
      updated.find((application) => application.id === initialApplications[0].id),
    ).toMatchObject({
      status: 'Ready',
      progress: 90,
    })
    expect(initialApplications[0].status).toBe('In Review')
  })

  it('adds a generated application record that My Applications can read', () => {
    const updated = upsertGeneratedApplication(initialApplications, {
      programName: 'Atlantic Innovation Fund',
      company: 'Blue Harbor Labs',
      fundingType: 'Grant',
      amount: 42000,
      deadline: 'Oct 12, 2026',
      owner: 'Riley Hart',
      readinessScore: 88,
      documentCount: 3,
      generatedAt: new Date('2026-07-30T10:00:00.000Z'),
    })

    expect(updated[0]).toMatchObject({
      title: 'Atlantic Innovation Fund application',
      company: 'Blue Harbor Labs',
      programName: 'Atlantic Innovation Fund',
      programUrl: '',
      status: 'Ready',
      amount: 42000,
      documentsTotal: 3,
    })
    expect(updated[0]?.id).toMatch(/^\d+$/u)
  })

  it('updates the same generated application instead of duplicating it', () => {
    const firstPass = upsertGeneratedApplication(initialApplications, {
      programName: 'Atlantic Innovation Fund',
      company: 'Blue Harbor Labs',
      fundingType: 'Grant',
      amount: 42000,
      deadline: 'Oct 12, 2026',
      owner: 'Riley Hart',
      readinessScore: 52,
      documentCount: 3,
      generatedAt: new Date('2026-07-30T10:00:00.000Z'),
    })
    const secondPass = upsertGeneratedApplication(firstPass, {
      programName: 'Atlantic Innovation Fund',
      company: 'Blue Harbor Labs',
      fundingType: 'Grant',
      amount: 42000,
      deadline: 'Oct 12, 2026',
      owner: 'Riley Hart',
      readinessScore: 91,
      documentCount: 4,
      generatedAt: new Date('2026-07-30T11:00:00.000Z'),
    })

    expect(secondPass.filter((application) => application.id === firstPass[0]?.id)).toHaveLength(1)
    expect(secondPass[0]).toMatchObject({
      progress: 91,
      documentsTotal: 4,
    })
    expect(secondPass[0]?.id).toMatch(/^\d+$/u)
  })

  it('keeps multiple strategic review reports linked to one application', () => {
    const firstReport = {
      id: 'strategic-review-1',
      applicationId: '100000000001',
      generatedPackage: testGeneratedPackage,
    }
    const secondReport = {
      ...firstReport,
      id: 'strategic-review-2',
      generatedPackage: {
        ...testGeneratedPackage,
        completedAt: '2026-07-30T11:00:00.000Z',
      },
    }
    const firstPass = upsertGeneratedApplication(initialApplications, {
      id: '100000000001',
      programName: 'Atlantic Innovation Fund',
      company: 'Blue Harbor Labs',
      fundingType: 'Grant',
      amount: 42000,
      deadline: 'Oct 12, 2026',
      owner: 'Riley Hart',
      readinessScore: 88,
      documentCount: 1,
      generatedPackage: testGeneratedPackage,
      strategicReviewReport: firstReport,
    })
    const secondPass = upsertGeneratedApplication(firstPass, {
      id: firstPass[0]?.id,
      programName: 'Atlantic Innovation Fund',
      company: 'Blue Harbor Labs',
      fundingType: 'Grant',
      amount: 42000,
      deadline: 'Oct 12, 2026',
      owner: 'Riley Hart',
      readinessScore: 91,
      documentCount: 1,
      generatedPackage: secondReport.generatedPackage,
      strategicReviewReport: secondReport,
    })

    expect(getStrategicReviewReports(secondPass)).toHaveLength(2)
    expect(getStrategicReviewReports(secondPass).map((report) => report.id)).toEqual([
      'strategic-review-2',
      'strategic-review-1',
    ])
  })

  it('migrates a legacy generated package into a strategic review report', () => {
    const legacyApplication = {
      ...initialApplications[0],
      generatedPackage: testGeneratedPackage,
    }

    const reports = getStrategicReviewReports([legacyApplication])

    expect(reports[0]).toMatchObject({
      id: 'legacy-100000000001',
      applicationId: '100000000001',
    })
  })

  it('materializes a saved program into an application with step-one fields', () => {
    const result = materializeSavedProgramApplication(initialApplications, {
      programName: 'Atlantic Innovation Fund',
      programUrl: 'https://example.com/atlantic-innovation-fund',
      company: 'Blue Harbor Labs',
      fundingType: 'Grant',
      amount: 42000,
      deadline: 'Oct 12, 2026',
      owner: 'Riley Hart',
      stage: 'Preparing',
      note: 'Review the intake checklist before drafting.',
    })

    expect(result.applications[0]).toMatchObject({
      id: result.applicationId,
      title: 'Atlantic Innovation Fund application',
      programName: 'Atlantic Innovation Fund',
      programUrl: 'https://example.com/atlantic-innovation-fund',
      company: 'Blue Harbor Labs',
      amount: 42000,
      owner: 'Riley Hart',
      status: 'In Review',
      note: 'Review the intake checklist before drafting.',
    })
    expect(result.applicationId).toMatch(/^\d+$/u)
  })
})

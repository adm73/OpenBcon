import { describe, expect, it } from 'vitest'
import { defaultProfile, documentTypes, fundingTracks } from '../data/demo'
import { buildDocument, calculateApprovalReadiness, formatCurrency } from './generator'

describe('funding document generator', () => {
  it('formats Canadian currency without cents', () => {
    expect(formatCurrency(250000)).toContain('250,000')
  })

  it('keeps approval readiness within a useful score range', () => {
    const score = calculateApprovalReadiness(defaultProfile)

    expect(score).toBeGreaterThanOrEqual(32)
    expect(score).toBeLessThanOrEqual(120)
  })

  it('builds a complete business plan preview', () => {
    const document = buildDocument(
      defaultProfile,
      fundingTracks[0],
      documentTypes[0],
    )

    expect(document.title).toContain(defaultProfile.companyName)
    expect(document.readinessScore).toBeGreaterThanOrEqual(68)
    expect(document.metrics).toHaveLength(4)
    expect(document.sections.length).toBeGreaterThanOrEqual(4)
    expect(document.milestones.length).toBeGreaterThanOrEqual(4)
  })
})

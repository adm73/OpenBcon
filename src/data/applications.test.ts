import { describe, expect, it } from 'vitest'
import {
  initialApplications,
  loadApplications,
  updateApplicationRecord,
} from './applications'

describe('applications', () => {
  it('provides a complete demo pipeline', () => {
    const applications = loadApplications()

    expect(applications).toHaveLength(6)
    expect(new Set(applications.map((application) => application.status))).toEqual(
      new Set(['Draft', 'In Review', 'Ready', 'Submitted', 'Awarded']),
    )
  })

  it('updates one application without mutating the original list', () => {
    const updated = updateApplicationRecord(
      initialApplications,
      'app-feddev-growth',
      { status: 'Ready', progress: 90 },
    )

    expect(updated.find((application) => application.id === 'app-feddev-growth')).toMatchObject({
      status: 'Ready',
      progress: 90,
    })
    expect(initialApplications[0].status).toBe('In Review')
  })
})

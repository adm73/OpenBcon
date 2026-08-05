import { describe, expect, it } from 'vitest'
import {
  commercialLicenseDefaults,
  defaultNotificationBar,
  defaultPlatformConfig,
  normalizeAdvisoryHubSections,
  sanitizePlatformConfigForPersistence,
} from './platform'

describe('platform config persistence', () => {
  it('keeps the notification bar disabled by default', () => {
    expect(defaultPlatformConfig.notificationBar).toEqual(defaultNotificationBar)
    expect(defaultPlatformConfig.notificationBar.enabled).toBe(false)
    expect(defaultPlatformConfig.notificationBar.audience).toBe('all')
  })

  it('defaults the workspace to test mode', () => {
    expect(defaultPlatformConfig.environmentMode).toBe('test')
  })

  it('defaults the platform language to English', () => {
    expect(defaultPlatformConfig.language).toBe('en-CA')
  })

  it('provides a prompt for every Strategic Report document type', () => {
    expect(defaultPlatformConfig.advisoryHub.documentTypes.map((documentType) => documentType.name)).toEqual([
      'Business Analysis',
      'Technical Analysis',
      'Financial Model',
    ])
    expect(
      defaultPlatformConfig.advisoryHub.documentTypes.every(
        (documentType) => documentType.prompt.trim().length > 0,
      ),
    ).toBe(true)
  })

  it('provides the default Business Analysis section outline', () => {
    expect(
      defaultPlatformConfig.advisoryHub.sections
        .filter((section) => section.documentTypeId === 'business-analysis')
        .slice(0, 7)
        .map((section) => section.title),
    ).toEqual([
      'Cover Page',
      'Executive Summary',
      'Business Overview',
      'Sales & Marketing',
      'Operating Plan',
      'People',
      'Action Plan',
    ])
  })

  it('provides the default Technology Analysis section outline', () => {
    expect(
      defaultPlatformConfig.advisoryHub.sections
        .filter((section) => section.documentTypeId === 'technical-analysis')
        .map((section) => section.title),
    ).toEqual([
      'Cover Page',
      'Executive Summary',
      'Business & Technology Overview',
      'Technology Assessment',
      'Gap & Opportunity Analysis',
      'Technology Roadmap',
      'AI Review & Improve',
    ])
  })

  it('assigns cover-page layout only to the default cover sections', () => {
    const coverSections = defaultPlatformConfig.advisoryHub.sections.filter(
      (section) => section.layout === 'cover-page',
    )

    expect(coverSections.map((section) => section.id)).toEqual([
      'cover-page',
      'technology-cover-page',
    ])
    expect(
      defaultPlatformConfig.advisoryHub.sections
        .filter((section) => section.layout === 'main-content')
        .every((section) => section.title !== 'Cover Page'),
    ).toBe(true)
  })

  it('provides editable definitions for the report layouts', () => {
    expect(defaultPlatformConfig.advisoryHub.layouts.map((layout) => layout.id)).toEqual([
      'cover-page',
      'main-content',
    ])
    expect(
      defaultPlatformConfig.advisoryHub.layouts.every(
        (layout) => layout.name.trim().length > 0 && layout.css.includes(':'),
      ),
    ).toBe(true)
  })

  it('does not re-add sections removed from the persisted configuration', () => {
    const sections = normalizeAdvisoryHubSections(
      defaultPlatformConfig.advisoryHub.sections.filter(
        (section) => !['funding-narrative', 'ai-review'].includes(section.id),
      ),
      defaultPlatformConfig.advisoryHub.agents,
      defaultPlatformConfig.advisoryHub.documentTypes,
    )

    expect(sections.some((section) => section.id === 'funding-narrative')).toBe(false)
    expect(sections.some((section) => section.id === 'ai-review')).toBe(false)
  })

  it('removes AI credentials before persistence', () => {
    const config = {
      ...defaultPlatformConfig,
      ai: {
        ...defaultPlatformConfig.ai,
        models: defaultPlatformConfig.ai.models.map((model, index) =>
          index === 0
            ? {
                ...model,
                apiKey: 'secret-value-that-must-not-persist',
                authorization: 'Bearer secret-value-that-must-not-persist',
              }
            : model,
        ),
      },
    }

    const persisted = sanitizePlatformConfigForPersistence(config)

    expect(persisted.ai.models[0]?.apiKey).toBe('')
    expect(persisted.ai.models[0]?.authorization).toBe('')
  })

  it('keeps commercial licensing terms fixed', () => {
    const persisted = sanitizePlatformConfigForPersistence({
      ...defaultPlatformConfig,
      commercialLicensePrice: 'Custom price',
      commercialLicenseUrl: 'https://example.com/custom-license',
    })

    expect(persisted.commercialLicensePrice).toBe(commercialLicenseDefaults.price)
    expect(persisted.commercialLicenseUrl).toBe(commercialLicenseDefaults.url)
  })
})

import { describe, expect, it } from 'vitest'
import {
  commercialLicenseDefaults,
  defaultNotificationBar,
  defaultPlatformConfig,
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

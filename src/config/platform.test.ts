import { describe, expect, it } from 'vitest'
import {
  defaultPlatformConfig,
  sanitizePlatformConfigForPersistence,
} from './platform'

describe('platform config persistence', () => {
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
})

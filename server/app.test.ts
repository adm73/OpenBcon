import type { Pool } from 'pg'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app'

function createDatabaseStub() {
  return {
    query: vi.fn(async () => ({
      rows: [],
      rowCount: 1,
    })),
  } as unknown as Pool
}

describe('persistence API', () => {
  it('reports database health', async () => {
    const response = await request(createApp(createDatabaseStub())).get(
      '/api/health',
    )

    expect(response.status).toBe(200)
    expect(response.body.database).toBe('connected')
  })

  it('returns an empty bootstrap payload for a new workspace', async () => {
    const response = await request(createApp(createDatabaseStub())).get(
      '/api/bootstrap',
    )

    expect(response.status).toBe(200)
    expect(response.body.values).toEqual({})
  })

  it('rejects authentication tokens as persistent state', async () => {
    const response = await request(createApp(createDatabaseStub()))
      .put('/api/state/bconomics-access-token')
      .send({
        scope: 'user',
        value: 'secret',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('invalid_request')
  })
})

import { describe, expect, it } from 'vitest'
import { builtInFundingPrograms } from './fundingSources'
import { addSavedProgram, loadSavedProgramEntries } from './savedPrograms'

describe('saved programs', () => {
  it('creates a focused default shortlist', () => {
    const entries = loadSavedProgramEntries(builtInFundingPrograms)

    expect(entries).toHaveLength(4)
    expect(entries[0]).toMatchObject({
      programId: builtInFundingPrograms[0].id,
      stage: 'Preparing',
      priority: 'High',
    })
  })

  it('adds new programs to the top without creating duplicates', () => {
    const initial = loadSavedProgramEntries(builtInFundingPrograms)
    const newProgramId = builtInFundingPrograms[5].id
    const added = addSavedProgram(initial, newProgramId)
    const duplicate = addSavedProgram(added, newProgramId)

    expect(added[0]).toMatchObject({
      programId: newProgramId,
      stage: 'Researching',
    })
    expect(duplicate).toHaveLength(added.length)
  })
})

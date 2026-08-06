import { describe, expect, it } from 'vitest'
import {
  addSavedProgram,
  loadSavedProgramEntries,
  type SavedProgramEntry,
} from './savedPrograms'

describe('saved programs', () => {
  it('starts empty when no saved program cache exists', () => {
    expect(loadSavedProgramEntries()).toEqual([])
  })

  it('adds new programs to the top without creating duplicates', () => {
    const initial: SavedProgramEntry[] = []
    const newProgramId = 'program-1'
    const added = addSavedProgram(initial, newProgramId)
    const duplicate = addSavedProgram(added, newProgramId)

    expect(added[0]).toMatchObject({
      programId: newProgramId,
      stage: 'Researching',
    })
    expect(duplicate).toHaveLength(added.length)
  })
})

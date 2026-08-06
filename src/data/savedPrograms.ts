import {
  persistPersistentItem,
  setPersistentItem,
} from '../persistence/storage'

export type SavedProgramStage = 'Researching' | 'Preparing' | 'Ready to apply'
export type SavedProgramPriority = 'High' | 'Medium' | 'Low'

export type SavedProgramEntry = {
  programId: string
  applicationId?: string
  stage: SavedProgramStage
  priority: SavedProgramPriority
  note: string
  savedAt: string
}

export const savedProgramsStorageKey = 'bconomics-saved-programs-v1'

export function loadSavedProgramEntries() {
  if (typeof window === 'undefined') return []

  try {
    const saved = window.localStorage.getItem(savedProgramsStorageKey)
    return saved ? (JSON.parse(saved) as SavedProgramEntry[]) : []
  } catch {
    return []
  }
}

export function saveSavedProgramEntries(entries: SavedProgramEntry[]) {
  setPersistentItem(savedProgramsStorageKey, JSON.stringify(entries))
}

export async function persistSavedProgramEntries(entries: SavedProgramEntry[]) {
  return persistPersistentItem(savedProgramsStorageKey, JSON.stringify(entries))
}

export function addSavedProgram(
  entries: SavedProgramEntry[],
  programId: string,
) {
  if (entries.some((entry) => entry.programId === programId)) return entries

  return [
    {
      programId,
      stage: 'Researching' as const,
      priority: 'Medium' as const,
      note: '',
      savedAt: new Intl.DateTimeFormat('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    },
    ...entries,
  ]
}

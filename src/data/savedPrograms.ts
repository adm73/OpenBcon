import type { FundingProgramRecord } from './fundingSources'
import { setPersistentItem } from '../persistence/storage'

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

function createDefaultEntries(programs: FundingProgramRecord[]): SavedProgramEntry[] {
  const stages: SavedProgramStage[] = [
    'Preparing',
    'Researching',
    'Ready to apply',
    'Researching',
  ]
  const priorities: SavedProgramPriority[] = ['High', 'Medium', 'High', 'Low']

  return programs.slice(0, 4).map((program, index) => ({
    programId: program.id,
    stage: stages[index] ?? 'Researching',
    priority: priorities[index] ?? 'Medium',
    note:
      index === 0
        ? 'Confirm eligible project costs with the finance team.'
        : index === 1
          ? 'Review the application guide and required attachments.'
          : '',
    savedAt: ['Jul 28, 2026', 'Jul 26, 2026', 'Jul 22, 2026', 'Jul 18, 2026'][
      index
    ],
  }))
}

export function loadSavedProgramEntries(programs: FundingProgramRecord[]) {
  if (typeof window === 'undefined') return createDefaultEntries(programs)

  try {
    const saved = window.localStorage.getItem(savedProgramsStorageKey)
    return saved
      ? (JSON.parse(saved) as SavedProgramEntry[])
      : createDefaultEntries(programs)
  } catch {
    return createDefaultEntries(programs)
  }
}

export function saveSavedProgramEntries(entries: SavedProgramEntry[]) {
  setPersistentItem(savedProgramsStorageKey, JSON.stringify(entries))
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

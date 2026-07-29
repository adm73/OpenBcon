import { useEffect, useState, type ReactNode } from 'react'
import {
  hydratePersistentStorage,
  type PersistenceMode,
} from './storage'

export function PersistenceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<PersistenceMode>('local')

  useEffect(() => {
    let active = true
    hydratePersistentStorage().then((nextMode) => {
      if (!active) return
      setMode(nextMode)
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready) {
    return (
      <main className="persistence-loading">
        <span>B</span>
        <strong>Opening your workspace</strong>
        <small>Connecting to secure storage...</small>
      </main>
    )
  }

  return (
    <>
      {children}
      <span className="persistence-mode" data-mode={mode} aria-hidden="true" />
    </>
  )
}

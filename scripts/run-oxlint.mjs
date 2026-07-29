import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDirs = [
  fileURLToPath(new URL('../src/', import.meta.url)),
  fileURLToPath(new URL('../server/', import.meta.url)),
]
const allowedExtensions = new Set(['.ts', '.tsx'])

async function collectFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        return collectFiles(entryPath)
      }

      return allowedExtensions.has(extname(entry.name)) ? [entryPath] : []
    }),
  )

  return files.flat().sort()
}

const sourceFiles = (
  await Promise.all(rootDirs.map((rootDir) => collectFiles(rootDir)))
).flat()

if (sourceFiles.length === 0) {
  process.exit(0)
}

const child = spawn('npx', ['oxlint', ...sourceFiles], {
  shell: true,
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

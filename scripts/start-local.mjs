import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cwd } from 'node:process'

const root = cwd()
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const environment = {
  ...process.env,
  OPENBCON_CHECKOUT_ROOT: root,
  OPENBCON_UPDATE_AGENT_URL:
    process.env.OPENBCON_UPDATE_AGENT_URL || 'http://127.0.0.1:8788',
  OPENBCON_UPDATE_TOKEN:
    process.env.OPENBCON_UPDATE_TOKEN || randomBytes(32).toString('hex'),
  UPDATE_AGENT_BIND_ADDRESS: '127.0.0.1',
  UPDATE_AGENT_PORT: '8788',
  OPENBCON_LOCAL_UPDATE_MODE: 'true',
}

const children = [
  spawn(npmCommand, ['run', 'dev:api'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  }),
  spawn(npmCommand, ['run', 'dev:web'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['deploy/update-agent.mjs'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  }),
]

let shuttingDown = false

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(exitCode), 250)
}

for (const child of children) {
  child.on('error', () => shutdown(1))
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code ?? 1) !== 0 && signal !== 'SIGTERM') shutdown(code ?? 1)
  })
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

process.stdout.write(
  'Local deployment mode enabled: Admin Console updates use the private updater on 127.0.0.1:8788.\n',
)

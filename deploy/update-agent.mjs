import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

// Keep the container checkout path separate from OPENBCON_ROOT, which is the
// host path Compose needs when the deployment script recreates services.
const root = process.env.OPENBCON_CHECKOUT_ROOT || process.env.OPENBCON_ROOT || '/workspace'
const statusFile = join(root, 'deploy', '.update-status.json')
const token = process.env.OPENBCON_UPDATE_TOKEN || ''
const bindAddress = process.env.UPDATE_AGENT_BIND_ADDRESS || '0.0.0.0'
const port = Number(process.env.UPDATE_AGENT_PORT || 8788)
const commitPattern = /^[0-9a-f]{7,40}$/iu
let updateRunning = false

function now() {
  return new Date().toISOString()
}

function defaultStatus() {
  return {
    status: 'idle',
    phase: 'idle',
    message: 'The update service is ready.',
    currentCommit: '',
    targetCommit: '',
    startedAt: null,
    finishedAt: null,
  }
}

function readStatus() {
  try {
    return { ...defaultStatus(), ...JSON.parse(readFileSync(statusFile, 'utf8')) }
  } catch {
    return defaultStatus()
  }
}

function writeStatus(next) {
  const temporaryFile = `${statusFile}.tmp`
  writeFileSync(temporaryFile, `${JSON.stringify(next)}\n`, { mode: 0o600 })
  renameSync(temporaryFile, statusFile)
}

function updateStatus(patch) {
  const next = { ...readStatus(), ...patch }
  writeStatus(next)
  return next
}

function send(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function hasValidToken(request) {
  const provided = request.headers['x-openbcon-update-token']
  if (!token || typeof provided !== 'string') return false
  const expectedBuffer = Buffer.from(token)
  const providedBuffer = Buffer.from(provided)
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  )
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 8192) reject(new Error('Request body is too large.'))
    })
    request.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Request body must be valid JSON.'))
      }
    })
    request.on('error', reject)
  })
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, OPENBCON_ROOT: root, OPENBCON_SKIP_UPDATE_AGENT: '1' },
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const append = (chunk) => {
      output = `${output}${chunk}`.slice(-12000)
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', (error) => resolve({ code: 1, output: error.message }))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

async function runUpdate(requestedCommit) {
  const startedAt = now()
  updateRunning = true
  try {
    if (!existsSync(join(root, '.git'))) throw new Error('The deployment checkout is not a Git repository.')
    if (!existsSync(join(root, 'deploy', 'deploy.sh'))) throw new Error('The deployment script is missing from the checkout.')

    const clean = await run('git', ['status', '--porcelain', '--untracked-files=no'])
    if (clean.code !== 0) throw new Error(`Git status failed: ${clean.output.trim()}`)
    if (clean.output.trim()) throw new Error('The deployment checkout has local tracked changes. Review them on the VPS before updating.')

    const branch = await run('git', ['symbolic-ref', '--short', 'HEAD'])
    if (branch.code !== 0 || branch.output.trim() !== 'main') throw new Error('Automatic updates require the deployment checkout to be on the main branch.')

    updateStatus({ status: 'running', phase: 'fetching', message: 'Fetching the latest OpenBcon release from GitHub.', startedAt, finishedAt: null })
    const fetchResult = await run('git', ['fetch', '--tags', 'origin', 'main'])
    if (fetchResult.code !== 0) throw new Error(`Git fetch failed: ${fetchResult.output.trim()}`)

    const current = await run('git', ['rev-parse', '--verify', 'HEAD'])
    const remote = await run('git', ['rev-parse', '--verify', 'origin/main'])
    if (current.code !== 0 || remote.code !== 0) throw new Error('Could not resolve the current or latest OpenBcon commit.')
    const currentCommit = current.output.trim()
    const targetCommit = remote.output.trim()
    if (requestedCommit && (!commitPattern.test(requestedCommit) || !targetCommit.startsWith(requestedCommit.toLowerCase()))) {
      throw new Error('The requested update commit is not the latest commit on origin/main.')
    }

    if (currentCommit === targetCommit) {
      return updateStatus({ status: 'succeeded', phase: 'current', message: 'OpenBcon is already up to date.', currentCommit, targetCommit, startedAt, finishedAt: now() })
    }

    const ancestry = await run('git', ['merge-base', '--is-ancestor', currentCommit, targetCommit])
    if (ancestry.code !== 0) throw new Error('The deployment checkout has diverged from origin/main. Automatic updates stopped without changing code.')

    updateStatus({ status: 'running', phase: 'fast_forwarding', message: 'Fast-forwarding the deployment checkout.', currentCommit, targetCommit })
    const merge = await run('git', ['merge', '--ff-only', 'origin/main'])
    if (merge.code !== 0) throw new Error(`Git fast-forward failed: ${merge.output.trim()}`)

    updateStatus({ status: 'running', phase: 'deploying', message: 'Building and restarting OpenBcon services. Database volumes are preserved.', currentCommit, targetCommit })
    const deploy = await run('bash', ['deploy/deploy.sh'])
    if (deploy.code !== 0) throw new Error(`OpenBcon deployment failed: ${deploy.output.trim()}`)

    return updateStatus({ status: 'succeeded', phase: 'completed', message: 'OpenBcon was updated successfully. Refresh the browser.', currentCommit: targetCommit, targetCommit, startedAt, finishedAt: now() })
  } catch (error) {
    return updateStatus({ status: 'failed', phase: 'failed', message: error instanceof Error ? error.message : 'The OpenBcon update failed.', startedAt, finishedAt: now() })
  } finally {
    updateRunning = false
  }
}

if (!token) {
  throw new Error('OPENBCON_UPDATE_TOKEN is required for the update service.')
}

const server = createServer(async (request, response) => {
  if (!hasValidToken(request)) return send(response, 401, { message: 'Invalid update service token.' })
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, { status: 'ok' })
  if (request.method === 'GET' && request.url === '/status') return send(response, 200, readStatus())
  if (request.method !== 'POST' || request.url !== '/update') return send(response, 404, { message: 'Not found.' })
  if (updateRunning) return send(response, 409, { message: 'An OpenBcon update is already running.', ...readStatus() })

  let body
  try {
    body = await readRequestBody(request)
  } catch (error) {
    return send(response, 400, { message: error instanceof Error ? error.message : 'Invalid request.' })
  }
  const requestedCommit = typeof body?.targetCommit === 'string' ? body.targetCommit.trim().toLowerCase() : ''
  if (requestedCommit && !commitPattern.test(requestedCommit)) return send(response, 400, { message: 'The requested commit identifier is invalid.' })

  updateStatus({ status: 'running', phase: 'queued', message: 'The OpenBcon update has been queued.', startedAt: now(), finishedAt: null })
  void runUpdate(requestedCommit)
  return send(response, 202, readStatus())
})

server.listen(port, bindAddress, () => {
  process.stdout.write(`OpenBcon update agent listening on ${bindAddress}:${port}\n`)
})

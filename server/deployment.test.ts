import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'

const temporaryDirectories: string[] = []
const children: ChildProcess[] = []
const hostPathScript = resolve('deploy/host-path.sh')
const composeAvailable = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status === 0

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'openbcon-deployment-'))
  temporaryDirectories.push(root)
  mkdirSync(join(root, 'bin'))
  mkdirSync(join(root, 'deploy'))
  return root
}

function executable(root: string, name: string, script: string) {
  writeFileSync(join(root, 'bin', name), `#!/bin/sh\n${script}\n`, { mode: 0o755 })
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit')
      child.kill()
      await stopped
    }
  }
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('deployment host paths', () => {
  it.skipIf(!composeAvailable)('renders Caddy and updater host mounts without changing data volumes', () => {
    const root = fixture()
    const composeFile = join(root, 'deploy', 'docker-compose.production.yml')
    const envFile = join(root, 'deploy', '.env.production')
    writeFileSync(composeFile, readFileSync(resolve('deploy/docker-compose.production.yml')))
    const settings = {
      OPENBCON_ROOT: '/srv/openbcon',
      POSTGRES_PASSWORD: 'test-postgres-password',
      MONGODB_ROOT_PASSWORD: 'test-mongo-password',
      OPENBCON_UPDATE_TOKEN: 'test-token',
      PUBLIC_DOMAIN: 'example.test',
      DASHBOARD_DOMAIN: 'dashboard.example.test',
      CORS_ORIGIN: 'https://example.test,https://dashboard.example.test',
    }
    writeFileSync(envFile, Object.entries(settings).map(([key, value]) => `${key}=${value}\n`).join(''))
    const config = JSON.parse(execFileSync('docker', ['compose', '--env-file', envFile, '-f', composeFile, 'config', '--format', 'json'], {
      encoding: 'utf8', env: { ...process.env, ...settings },
    }))
    expect(config.services.caddy.volumes).toContainEqual(expect.objectContaining({
      source: '/srv/openbcon/deploy/Caddyfile', target: '/etc/caddy/Caddyfile', read_only: true,
    }))
    const caddyMount = config.services.caddy.volumes.find((mount: { target: string }) => mount.target === '/etc/caddy/Caddyfile')
    expect(caddyMount.bind?.create_host_path ?? false).toBe(false)
    expect(config.services.updater.volumes).toContainEqual(expect.objectContaining({ source: '/srv/openbcon', target: '/workspace' }))
    expect(config.services.updater.environment.OPENBCON_ROOT).toBe('/srv/openbcon')
    expect(config.volumes['bconomics-postgres-data'].name).toBe('deploy_bconomics-postgres-data')
    expect(config.volumes['bconomics-mongodb-data'].name).toBe('deploy_bconomics-mongodb-data')
    expect(config.volumes['caddy-data'].name).toBe('deploy_caddy-data')
    expect(config.volumes['caddy-config'].name).toBe('deploy_caddy-config')
  })

  it('uses the server directory for direct deployments and saved paths inside the updater', () => {
    for (const [checkout, configured, updater, expected] of [
      ['/srv/openbcon', '/old/location', '0', '/srv/openbcon'],
      ['/workspace', '/opt/openbcon', '1', '/opt/openbcon'],
      ['/workspace', '"/srv/customer portal"', '1', '/srv/customer portal'],
    ]) {
      const output = execFileSync('bash', ['-c', 'source "$1"; resolve_openbcon_host_root "$2" "$3" "$4"', '--', hostPathScript, checkout, configured, updater], { encoding: 'utf8' })
      expect(output.trim()).toBe(expected)
    }
  })

  it('recovers missing or poisoned settings from the updater bind mount', () => {
    const root = fixture()
    executable(root, 'docker', 'printf "%s\\n" /srv/actual-openbcon')
    for (const configured of ['', '/workspace', '/workspace/deploy', 'relative/path']) {
      const output = execFileSync('bash', ['-c', 'source "$1"; resolve_openbcon_host_root /workspace "$2" 1', '--', hostPathScript, configured], {
        encoding: 'utf8', env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
      })
      expect(output.trim()).toBe('/srv/actual-openbcon')
    }
  })

  it('fails before Compose when the host path cannot be recovered', () => {
    const root = fixture()
    executable(root, 'docker', 'exit 1')
    const result = spawnSync('bash', ['-c', 'source "$1"; resolve_openbcon_host_root /workspace /workspace 1', '--', hostPathScript], {
      encoding: 'utf8', env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Set OPENBCON_ROOT')
  })

  it('exports the saved host path even when an old agent injects /workspace', () => {
    const root = fixture()
    for (const file of ['deploy.sh', 'host-path.sh']) {
      writeFileSync(join(root, 'deploy', file), readFileSync(resolve('deploy', file)))
    }
    writeFileSync(join(root, 'deploy', '.env.production'), 'PUBLIC_DOMAIN=example.test\nDASHBOARD_DOMAIN=dashboard.example.test\nOPENBCON_ROOT=/srv/openbcon\nOPENBCON_UPDATE_TOKEN=test-token\n')
    executable(root, 'docker', 'printf "%s" "$OPENBCON_ROOT" > "$TEST_CAPTURE"\nexit 73')
    // deploy.sh uses GNU sed on Linux; adapt only the fixture on macOS.
    if (process.platform === 'darwin') {
      executable(root, 'sed', 'if [ "$1" = -i ]; then shift; exec /usr/bin/sed -i "" "$@"; fi\nexec /usr/bin/sed "$@"')
    }
    const capture = join(root, 'captured-root')
    const result = spawnSync('bash', [join(root, 'deploy', 'deploy.sh')], {
      encoding: 'utf8', env: { ...process.env, OPENBCON_ROOT: '/workspace', OPENBCON_SKIP_UPDATE_AGENT: '1', TEST_CAPTURE: capture, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
    })
    // The fake Compose intentionally stops at config validation, before services start.
    expect(result.status).toBe(1)
    expect(readFileSync(capture, 'utf8')).toBe('/srv/openbcon')
    expect(readFileSync(join(root, 'deploy', '.env.production'), 'utf8')).toContain('OPENBCON_ROOT=/srv/openbcon')
  })
})

describe('update agent retries', () => {
  it('deploys even when HEAD already equals origin/main and preserves the host root', async () => {
    const root = fixture()
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, 'deploy', 'deploy.sh'), '# fixture')
    executable(root, 'git', 'if [ "$1" = rev-parse ]; then printf "%s\\n" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; elif [ "$1" = describe ]; then printf "%s\\n" v5.0.1; fi')
    executable(root, 'cp', 'exit 0')
    executable(root, 'bash', 'printf "%s" "$OPENBCON_ROOT" > "$TEST_CAPTURE"\nexit 0')
    const capture = join(root, 'deploy-called')
    const child = spawn(process.execPath, [resolve('deploy/update-agent.mjs')], {
      env: { ...process.env, OPENBCON_CHECKOUT_ROOT: root, OPENBCON_ROOT: '/opt/openbcon', OPENBCON_UPDATE_TOKEN: 'test-token', OPENBCON_LOCAL_UPDATE_MODE: 'false', UPDATE_AGENT_BIND_ADDRESS: '127.0.0.1', UPDATE_AGENT_PORT: '0', TEST_CAPTURE: capture, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.push(child)
    const address = await new Promise<string>((accept, reject) => {
      let output = ''
      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
        const match = output.match(/127\.0\.0\.1:(\d+)/)
        if (match) accept(`http://127.0.0.1:${match[1]}`)
      })
      child.on('error', reject)
      child.on('exit', () => reject(new Error('Update agent stopped before listening')))
    })
    const headers = { 'X-OpenBcon-Update-Token': 'test-token', 'Content-Type': 'application/json' }
    const response = await fetch(`${address}/update`, { method: 'POST', headers, body: '{}' })
    expect(response.status).toBe(202)
    let status: { status?: string; phase?: string; message?: string } = {}
    for (let index = 0; index < 100; index += 1) {
      status = await (await fetch(`${address}/status`, { headers })).json() as typeof status
      if (status.status !== 'running') break
      await new Promise((done) => setTimeout(done, 20))
    }
    expect(status.status, status.message).toBe('succeeded')
    expect(status.phase).toBe('completed')
    expect(readFileSync(capture, 'utf8')).toBe('/opt/openbcon')
  })
})

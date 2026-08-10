import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function gitMetadata(args: string[], fallback: string) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback
  } catch {
    return fallback
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const appCommit =
    process.env.VITE_APP_COMMIT?.trim() ||
    fileEnv.VITE_APP_COMMIT?.trim() ||
    gitMetadata(['rev-parse', '--short=12', 'HEAD'], 'unknown')
  const appVersion =
    process.env.VITE_APP_VERSION?.trim() ||
    fileEnv.VITE_APP_VERSION?.trim() ||
    gitMetadata(['describe', '--tags', '--exact-match', 'HEAD'], 'unreleased')

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_APP_COMMIT': JSON.stringify(appCommit),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8787',
          changeOrigin: true,
        },
        '/ai-api': {
          target: process.env.VITE_BUSINESS_PLAN_API_PROXY_TARGET ?? 'http://localhost:8010',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-api/u, ''),
        },
      },
    },
  }
})

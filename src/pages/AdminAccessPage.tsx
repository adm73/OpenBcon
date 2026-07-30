import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getAdminAccessCode,
  grantAdminAccess,
} from '../auth/adminAccess'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'

export function AdminAccessPage() {
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)
  const location = useLocation()
  const [accessCode, setAccessCode] = useState('')
  const [notice, setNotice] = useState('')
  const configuredAccessCode = getAdminAccessCode()
  const hasDirectAccessCode = configuredAccessCode.length > 0
  const nextPath = `${location.pathname}${location.search}${location.hash}`

  function unlockAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasDirectAccessCode) {
      setNotice('Open the workspace first, then use the Admin Console entry from the sidebar.')
      return
    }

    if (accessCode.trim() !== configuredAccessCode) {
      setNotice('The admin access code was not recognized.')
      return
    }

    grantAdminAccess('access-code')
    window.location.assign(nextPath)
  }

  return (
    <main className="admin-lock-shell">
      <section className="admin-lock-card">
        <span className="admin-lock-badge">Admin protected</span>
        <h1>Admin Console requires an active admin session.</h1>
        <p>
          Direct access to <code>/admin</code> is locked. Open the workspace first and
          use the Admin Console entry from the sidebar, or unlock this screen with an
          access code when one has been configured for the deployment.
        </p>

        <div className="admin-lock-actions">
          <Link className="admin-lock-primary" to="/dashboard">
            Open workspace
          </Link>
          <Link className="admin-lock-secondary" to="/">
            Back to landing page
          </Link>
        </div>

        <form className="admin-lock-form" onSubmit={unlockAdmin}>
          <label>
            <span>Admin access code</span>
            <input
              type="password"
              value={accessCode}
              onChange={(event) => {
                setAccessCode(event.target.value)
                if (notice) {
                  setNotice('')
                }
              }}
              placeholder={
                hasDirectAccessCode
                  ? 'Enter the deployment access code'
                  : 'No direct access code configured'
              }
              disabled={!hasDirectAccessCode}
            />
          </label>
          <button type="submit" disabled={!hasDirectAccessCode}>
            Unlock admin
          </button>
        </form>

        {notice ? (
          <p className="admin-lock-notice" role="alert">
            {notice}
          </p>
        ) : null}

        <div className="admin-lock-note">
          <strong>Current community-edition behavior</strong>
          <p>
            This guard reduces casual exposure, but production-grade protection still
            belongs on the server. Pair it with real authentication before public
            deployment.
          </p>
          <p>
            Product: {platformName}
          </p>
        </div>
      </section>
    </main>
  )
}

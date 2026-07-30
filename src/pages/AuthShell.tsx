import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName, getPlatformInitial } from '../lib/platformBrand'

type AuthShellProps = {
  badge: string
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({
  badge,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)
  const platformInitial = getPlatformInitial(config)

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-copy">
          <Link className="auth-brand" to="/">
            <span>
              {config.platformLogo ? (
                <img src={config.platformLogo} alt={`${platformName} logo`} />
              ) : (
                platformInitial
              )}
            </span>
            <strong>{platformName}</strong>
          </Link>
          <span className="auth-badge">{badge}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="auth-card-form">{children}</div>

        {footer ? <div className="auth-card-footer">{footer}</div> : null}
      </section>

      <aside className="auth-side-panel">
        <span>Funding workspace</span>
        <h2>One account for readiness, discovery, applications, and document generation.</h2>
        <ul>
          <li>Manage your companies and funding records in one place.</li>
          <li>Generate business plans and funding narratives from the same profile.</li>
          <li>Control open-source settings, data sources, and AI modes from one workspace.</li>
        </ul>
      </aside>
    </main>
  )
}

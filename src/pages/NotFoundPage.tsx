import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'

export function NotFoundPage() {
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)

  useEffect(() => {
    document.title = `Page not found | ${platformName}`
  }, [platformName])

  return (
    <main className="not-found-page">
      <div className="not-found-mark">404</div>
      <p className="eyebrow">Page not found</p>
      <h1>This route does not exist.</h1>
      <p>
        The page may have moved, the module may be disabled, or the address may be
        incorrect.
      </p>
      <div className="hero-actions">
        <Link className="button button-primary" to="/dashboard">
          Return to dashboard
        </Link>
        <Link className="button button-secondary" to="/">
          Visit landing page
        </Link>
      </div>
    </main>
  )
}

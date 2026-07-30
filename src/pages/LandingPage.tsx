import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { hasActiveSession } from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { dashboardMetrics, landingHighlights } from '../data/demo'
import {
  OPEN_BCON_REPO_URL,
  shouldShowOpenBconAttribution,
} from '../licensing/openBconAttribution'

const TTE_WEBSITE_URL = 'https://www.tritrient.com'

export function LandingPage() {
  const { config } = usePlatformConfig()
  const isSignedIn = hasActiveSession()
  const showOpenBconAttribution = shouldShowOpenBconAttribution(config)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    document.title = `${config.productName}${config.productSuffix} | Funding-ready business documents`
  }, [config.productName, config.productSuffix])

  return (
    <div className="landing-v2">
      <header className="landing-v2-header">
        <Link className="landing-v2-brand" to="/">
          <span>{config.productName.charAt(0)}</span>
          <strong>{config.productName}{config.productSuffix}</strong>
        </Link>
        <nav>
          <a href="#">Homepage</a>
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#opensource">Open source</a>
        </nav>
        <div className="landing-v2-header-actions">
          <Link to={isSignedIn ? '/dashboard' : '/login'}>
            {isSignedIn ? 'Go to dashboard' : 'Sign in'}
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-v2-hero">
          <div className="landing-v2-copy">
            <p><span /> Funding infrastructure for ambitious businesses</p>
            <h1>{config.landingHeadline}</h1>
            <p>{config.landingSubheadline}</p>
            <div className="landing-v2-actions">
              <Link to="/dashboard">Explore the live workspace <b>→</b></Link>
              <Link to="/signup">Create a founder account</Link>
            </div>
            <div className="landing-v2-proof">
              <span><b>75+</b> funding programs tracked</span>
              <span><b>96%</b> document readiness</span>
              <span><b>30 sec</b> first draft generation</span>
            </div>
          </div>

          <div className="landing-v2-product">
            <div className="landing-v2-windowbar">
              <span><i /><i /><i /></span>
              <small>Funding workspace</small>
              <b>Live</b>
            </div>
            <div className="landing-v2-preview">
              <aside>
                <strong><span>B</span> conomics.ai</strong>
                <i className="is-active">Overview</i>
                <i>Funding readiness</i>
                <i>Applications</i>
                <i>Quick generate</i>
              </aside>
              <section>
                <small>FUNDING READINESS</small>
                <h2>Everything required to apply with confidence.</h2>
                <div className="landing-v2-preview-score">
                  <strong>72</strong>
                  <span>Almost ready<br /><b>+8 this month</b></span>
                </div>
                <div className="landing-v2-preview-bars">
                  <i><b style={{ width: '84%' }} /></i>
                  <i><b style={{ width: '68%' }} /></i>
                  <i><b style={{ width: '76%' }} /></i>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="landing-v2-trust">
          <span>Designed for</span>
          <strong>Founders</strong>
          <strong>Advisors</strong>
          <strong>Economic development teams</strong>
          <strong>Funding consultants</strong>
        </section>

        <section className="landing-v2-features" id="features">
          <div className="landing-v2-section-copy">
            <p>One connected platform</p>
            <h2>From “where do I start?” to a submission-ready package.</h2>
            <span>
              Bconomics keeps program discovery, business context, financial
              readiness, and document generation in one accountable workspace.
            </span>
          </div>
          <div className="landing-v2-feature-grid">
            {landingHighlights.map((item, index) => (
              <article key={item.label}>
                <span>0{index + 1}</span>
                <h3>{item.label}</h3>
                <p>{item.body}</p>
                <b>Explore capability →</b>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-v2-workflow" id="workflow">
          <div>
            <p>Guided from day one</p>
            <h2>Funding work without fragmented documents or guesswork.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div><strong>Build your business profile</strong><p>Capture the company, market, team, and financial context once.</p></div>
            </li>
            <li>
              <span>02</span>
              <div><strong>Match the right opportunity</strong><p>Prioritize grants and loans by eligibility, timing, and strategic fit.</p></div>
            </li>
            <li>
              <span>03</span>
              <div><strong>Generate and improve</strong><p>Create editable plans, forecasts, and narratives aligned to reviewer criteria.</p></div>
            </li>
          </ol>
        </section>

        <section className="landing-v2-open" id="opensource">
          <div className="landing-v2-open-copy">
            <p>Open core. Commercially sustainable.</p>
            <h2>Own the platform. Extend the workflow. Choose your license.</h2>
            <span>
              Run the AGPL community edition, contribute on GitHub, or purchase a
              commercial license for proprietary deployments and OEM distribution.
            </span>
            <div className="landing-v2-actions">
              <a href={config.commercialLicenseUrl}>
                Commercial license · {config.commercialLicensePrice}
              </a>
              <Link to="/login?next=/admin">Request admin access</Link>
            </div>
          </div>
          <div className="landing-v2-license-card">
            <span>Community edition</span>
            <strong>AGPL-3.0</strong>
            <p>Full source access with network copyleft obligations.</p>
            <hr />
            {dashboardMetrics.map((metric) => (
              <div key={metric.label}><span>{metric.label}</span><b>{metric.value}</b></div>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-v2-footer">
        <div className="landing-v2-footer-top">
          <div className="landing-v2-footer-brand-block">
            <Link className="landing-v2-brand" to="/">
              <span>{config.productName.charAt(0)}</span>
              <strong>{config.productName}{config.productSuffix}</strong>
            </Link>
            <p className="landing-v2-footer-description">
              Open funding infrastructure for the next generation of businesses.
            </p>
          </div>
          <div className="landing-v2-footer-navs">
            <div className="landing-v2-footer-column">
              <span>Sitemap</span>
              <a href="#">Homepage</a>
              <a href="#features">Features</a>
              <a href="#workflow">How it works</a>
              <a href="#opensource">Open source</a>
            </div>
            <div className="landing-v2-footer-column">
              <span>Platform</span>
              <Link to={isSignedIn ? '/dashboard' : '/login'}>
                {isSignedIn ? 'Go to dashboard' : 'Sign in'}
              </Link>
            </div>
          </div>
        </div>

        <div className="landing-v2-footer-bottom">
          <div className="landing-v2-footer-copyright">
            <span>
              Copyright &copy; {currentYear}{' '}
              <a href={TTE_WEBSITE_URL} target="_blank" rel="noreferrer">
                T.T.E
              </a>
            </span>
          </div>
          <div className="landing-v2-footer-links">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
          </div>
          {showOpenBconAttribution ? (
            <div className="landing-v2-footer-powered">
              <span>Powered by OpenBcon.</span>
              <a
                className="openbcon-attribution-link"
                href={OPEN_BCON_REPO_URL}
                target="_blank"
                rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.2-.02-2.18-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.09 1.77 1.2 1.77 1.2 1.03 1.78 2.69 1.27 3.35.97.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.29-5.24-5.74 0-1.27.45-2.31 1.19-3.12-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.19a10.9 10.9 0 0 1 5.78 0c2.2-1.5 3.17-1.19 3.17-1.19.62 1.58.23 2.75.11 3.04.74.81 1.19 1.85 1.19 3.12 0 4.46-2.7 5.45-5.28 5.73.41.36.78 1.08.78 2.18 0 1.57-.01 2.84-.01 3.23 0 .31.21.68.8.56a11.55 11.55 0 0 0 7.85-10.92C23.5 5.66 18.35.5 12 .5Z"
                  />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          ) : (
            <div />
          )}
        </div>
      </footer>
    </div>
  )
}

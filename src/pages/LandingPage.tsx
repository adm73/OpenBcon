import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { OpenBconAttribution } from '../components/OpenBconAttribution'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { dashboardMetrics, landingHighlights } from '../data/demo'

export function LandingPage() {
  const { config } = usePlatformConfig()

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
          <a href="#platform">Platform</a>
          <a href="#workflow">How it works</a>
          <a href="#opensource">Open source</a>
        </nav>
        <div>
          <Link to="/login">Log in</Link>
          <Link to="/signup">Create account</Link>
          <Link to="/dashboard">Open workspace</Link>
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

        <section className="landing-v2-features" id="platform">
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
        <div className="landing-v2-footer-brand">
          <Link className="landing-v2-brand" to="/">
            <span>{config.productName.charAt(0)}</span>
            <strong>{config.productName}{config.productSuffix}</strong>
          </Link>
          <OpenBconAttribution variant="landing" />
        </div>
        <p>Open funding infrastructure for the next generation of businesses.</p>
        <Link to="/dashboard">Launch workspace →</Link>
      </footer>
    </div>
  )
}

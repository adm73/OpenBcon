import { usePlatformConfig } from '../config/usePlatformConfig'
import {
  OPEN_BCON_REPO_URL,
  shouldShowOpenBconAttribution,
} from '../licensing/openBconAttribution'

const TTE_WEBSITE_URL = 'https://www.tritrient.com'

type OpenBconAttributionProps = {
  variant?: 'landing' | 'sidebar'
}

export function OpenBconAttribution({
  variant = 'landing',
}: OpenBconAttributionProps) {
  const { config } = usePlatformConfig()

  if (!shouldShowOpenBconAttribution(config)) {
    return null
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className={`openbcon-attribution openbcon-attribution-${variant}`}>
      <div className="openbcon-attribution-copyright">
        <span>
          Copyright &copy; {currentYear}{' '}
          <a href={TTE_WEBSITE_URL} target="_blank" rel="noreferrer">
            T.T.E
          </a>
        </span>
      </div>
      <div className="openbcon-attribution-powered">
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
    </div>
  )
}

import { usePlatformConfig } from '../config/usePlatformConfig'
import {
  OPEN_BCON_REPO_URL,
  shouldShowOpenBconAttribution,
} from '../licensing/openBconAttribution'

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

  return (
    <div className={`openbcon-attribution openbcon-attribution-${variant}`}>
      <span>本项目由 OpenBcon 提供技术支持</span>
      <a href={OPEN_BCON_REPO_URL} target="_blank" rel="noreferrer">
        GitHub
      </a>
    </div>
  )
}

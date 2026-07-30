import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { renderLegalContent } from '../lib/legalContent'
import { getPlatformDisplayName } from '../lib/platformBrand'

type LegalDocumentPageProps = {
  documentType: 'privacyPolicy' | 'termsOfService'
}

const legalDocumentMeta = {
  privacyPolicy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    description:
      'How this workspace handles personal, business, and operational information.',
  },
  termsOfService: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    description:
      'The terms that govern access to and use of this workspace.',
  },
} as const

export function LegalDocumentPage({
  documentType,
}: LegalDocumentPageProps) {
  const { config } = usePlatformConfig()
  const meta = legalDocumentMeta[documentType]
  const documentConfig = config[documentType]
  const content = renderLegalContent(documentConfig)
  const platformName = getPlatformDisplayName(config)

  useEffect(() => {
    document.title = `${meta.title} | ${platformName}`
  }, [meta.title, platformName])

  return (
    <main className="legal-page">
      <div className="legal-page-shell">
        <header className="legal-page-header">
          <Link className="legal-page-back" to="/">
            ← Back to home
          </Link>
          <div>
            <p>{meta.eyebrow}</p>
            <h1>{meta.title}</h1>
            <span>{meta.description}</span>
          </div>
        </header>

        <article className="legal-page-card">
          <div className="legal-page-format">
            <span>Rendered from {documentConfig.format.toUpperCase()}</span>
          </div>
          <div
            className="legal-page-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>
      </div>
    </main>
  )
}

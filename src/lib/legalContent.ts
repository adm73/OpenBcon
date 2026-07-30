import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { LegalDocumentConfig } from '../config/platform'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function renderLegalContent(document: LegalDocumentConfig) {
  const html =
    document.format === 'html'
      ? document.content
      : String(marked.parse(document.content))

  return DOMPurify.sanitize(html)
}

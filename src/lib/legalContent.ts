import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { ContentFormat, LegalDocumentConfig } from '../config/platform'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function renderFormattedContent(content: string, format: ContentFormat) {
  const html =
    format === 'html' ? content : String(marked.parse(content))

  return DOMPurify.sanitize(html)
}

export function renderLegalContent(document: LegalDocumentConfig) {
  return renderFormattedContent(document.content, document.format)
}

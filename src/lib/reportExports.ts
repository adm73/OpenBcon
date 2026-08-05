import type { FinancialForecast, GeneratedPackageSection } from '../types'

type DocxModule = typeof import('docx')
type DocxChild = InstanceType<DocxModule['Paragraph']> | InstanceType<DocxModule['Table']>
type PdfTextFont = { widthOfTextAtSize: (text: string, size: number) => number }

export type StrategicReportExportInput = {
  title: string
  businessName: string
  programName: string
  sections: GeneratedPackageSection[]
  forecast?: FinancialForecast
}

export function isCoverPageSection(section: GeneratedPackageSection) {
  if (section.layout) return section.layout === 'cover-page'
  return /(?:^|[-_\s])cover[-_\s]?page$/iu.test(section.id) || /^cover page$/iu.test(section.title.trim())
}

export function coverPageSubtitle(title: string) {
  return /technology|technical/iu.test(title)
    ? 'Technology capability, gaps, and an implementation roadmap.'
    : 'Business analysis, operating model, and execution plan.'
}

function coverPageSection(input: StrategicReportExportInput) {
  return input.sections.find(isCoverPageSection)
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'strategic-report'
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0)
}

function downloadBytes(bytes: Uint8Array, mimeType: string, filename: string) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  downloadBlob(new Blob([buffer], { type: mimeType }), filename)
}

function currencyValue(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`
}

function forecastRows(forecast: FinancialForecast) {
  return [
    ...forecast.rows.map((row) => ({ name: row.name, values: row.values })),
    { name: 'Total revenue', values: forecast.monthly_revenue_totals },
    { name: 'Total expenses', values: forecast.monthly_expense_totals },
    { name: 'Net cash flow', values: forecast.monthly_net_cash_flow },
  ]
}

function isFinancialSection(section: GeneratedPackageSection) {
  return /financial|forecast|cash[-\s]?flow/iu.test(
    `${section.id} ${section.title} ${section.documentLabel}`,
  )
}

function docxCell(docx: DocxModule, value: string, bold = false) {
  return new docx.TableCell({
    children: [
      new docx.Paragraph({
        children: [new docx.TextRun({ text: value, bold })],
      }),
    ],
  })
}

function docxForecastTable(docx: DocxModule, forecast: FinancialForecast, yearIndex: number) {
  const start = yearIndex * 12
  const months = forecast.months.slice(start, start + 12)
  const rows = forecastRows(forecast)
  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: [
      new docx.TableRow({
        children: [docxCell(docx, 'Line item', true), ...months.map((month) => docxCell(docx, month.label, true))],
      }),
      ...rows.map((row) =>
        new docx.TableRow({
          children: [
            docxCell(docx, row.name, row.name.startsWith('Total') || row.name === 'Net cash flow'),
            ...row.values.slice(start, start + 12).map((value) => docxCell(docx, currencyValue(value, forecast.currency))),
          ],
        }),
      ),
    ],
  })
}

export async function downloadStrategicReportDocx(
  input: StrategicReportExportInput,
  filename = `${slugify(input.title)}.docx`,
) {
  const docx = await import('docx')
  const cover = coverPageSection(input)
  const children: Array<DocxChild> = cover
    ? [
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { before: 3000, after: 260 },
          children: [
            new docx.TextRun({
              text: 'STRATEGIC REPORT',
              bold: true,
              color: '5865E8',
              size: 20,
            }),
          ],
        }),
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 260 },
          children: [
            new docx.TextRun({
              text: input.title,
              bold: true,
              size: 34,
            }),
          ],
        }),
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new docx.TextRun({ text: input.businessName, bold: true, size: 22 }),
          ],
        }),
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 520 },
          children: [
            new docx.TextRun({ text: input.programName, color: '69758D', size: 18 }),
          ],
        }),
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 520 },
          children: [
            new docx.TextRun({ text: coverPageSubtitle(input.title), color: '5D6982', size: 18 }),
          ],
        }),
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          children: [
            new docx.TextRun({
              text: new Intl.DateTimeFormat('en-CA', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date()),
              color: '858D9F',
              size: 16,
            }),
          ],
        }),
        new docx.Paragraph({ children: [new docx.PageBreak()] }),
      ]
    : [
        new docx.Paragraph({ text: input.title, heading: docx.HeadingLevel.TITLE }),
        new docx.Paragraph({ text: input.businessName }),
        new docx.Paragraph({ text: input.programName }),
      ]

  input.sections.filter((section) => section !== cover).forEach((section) => {
    children.push(
      new docx.Paragraph({ text: section.title, heading: docx.HeadingLevel.HEADING_1 }),
      new docx.Paragraph({ text: section.body }),
    )
  })

  const forecast = input.forecast
  if (forecast) {
    if (!input.sections.some(isFinancialSection)) {
      children.push(new docx.Paragraph({ text: 'Financial Model', heading: docx.HeadingLevel.HEADING_1 }))
    }
    children.push(new docx.Paragraph({
      text: `${forecast.years}-year monthly financial forecast (${forecast.months.length} months)`,
    }))
    forecast.annual_summaries.forEach((summary, index) => {
      children.push(
        new docx.Paragraph({ text: summary.label, heading: docx.HeadingLevel.HEADING_2 }),
        new docx.Paragraph({
          text: `Revenue ${currencyValue(summary.total_revenue, forecast.currency)} | Expenses ${currencyValue(summary.total_expenses, forecast.currency)} | Net cash flow ${currencyValue(summary.net_cash_flow, forecast.currency)}`,
        }),
        docxForecastTable(docx, forecast, index),
      )
    })
  }

  const document = new docx.Document({ sections: [{ children }] })
  downloadBlob(
    await docx.Packer.toBlob(document),
    filename,
  )
}

function wrapPdfText(text: string, font: PdfTextFont, size: number, maxWidth: number) {
  return text.split(/\s+/u).reduce<string[]>((lines, word) => {
    const current = lines.at(-1) ?? ''
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      if (lines.length === 0) lines.push(candidate)
      else lines[lines.length - 1] = candidate
    } else {
      lines.push(word)
    }
    return lines
  }, [])
}

function drawCenteredPdfText(
  page: { getWidth: () => number; drawText: (text: string, options: Record<string, unknown>) => void },
  text: string,
  y: number,
  size: number,
  font: PdfTextFont,
  color: ReturnType<typeof import('pdf-lib')['rgb']>,
) {
  page.drawText(text, {
    x: (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2,
    y,
    size,
    font,
    color,
  })
}

export async function downloadStrategicReportPdf(
  input: StrategicReportExportInput,
  filename = `${slugify(input.title)}.pdf`,
) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const margin = 42
  const bodySize = 10
  const lineHeight = 15
  let page = pdf.addPage([595, 842])
  let y = page.getHeight() - margin

  const addPage = (width = 595, height = 842) => {
    page = pdf.addPage([width, height])
    y = height - margin
  }

  const addText = (text: string, size = bodySize, font = regular, color = rgb(0.18, 0.22, 0.3)) => {
    const maxWidth = page.getWidth() - margin * 2
    const paragraphs = text.split(/\r?\n/u)
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = wrapPdfText(paragraph || ' ', font, size, maxWidth)
      lines.forEach((line) => {
        if (y < margin + lineHeight) addPage(page.getWidth(), page.getHeight())
        page.drawText(line, { x: margin, y, size, font, color })
        y -= lineHeight
      })
      if (paragraphIndex < paragraphs.length - 1) y -= 5
    })
  }

  const cover = coverPageSection(input)
  if (cover) {
    const coverPage = page
    coverPage.drawRectangle({
      x: 0,
      y: 0,
      width: coverPage.getWidth(),
      height: coverPage.getHeight(),
      color: rgb(0.97, 0.98, 1),
    })
    coverPage.drawRectangle({
      x: 0,
      y: coverPage.getHeight() - 16,
      width: coverPage.getWidth(),
      height: 16,
      color: rgb(0.345, 0.396, 0.91),
    })
    drawCenteredPdfText(coverPage, 'STRATEGIC REPORT', 625, 11, bold, rgb(0.345, 0.396, 0.91))
    drawCenteredPdfText(coverPage, input.title, 560, 29, bold, rgb(0.08, 0.12, 0.22))
    drawCenteredPdfText(coverPage, input.businessName, 510, 17, bold, rgb(0.12, 0.16, 0.25))
    drawCenteredPdfText(coverPage, input.programName, 475, 11, regular, rgb(0.35, 0.4, 0.5))
    const coverLines = wrapPdfText(coverPageSubtitle(input.title), regular, 10, 390)
    coverLines.slice(0, 5).forEach((line, index) => {
      drawCenteredPdfText(coverPage, line, 400 - index * 16, 10, regular, rgb(0.36, 0.41, 0.51))
    })
    drawCenteredPdfText(
      coverPage,
      new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()),
      270,
      10,
      regular,
      rgb(0.52, 0.55, 0.62),
    )
    addPage()
  } else {
    addText(input.title, 22, bold, rgb(0.08, 0.12, 0.22))
    y -= 5
    addText(`${input.businessName} | ${input.programName}`, 10, regular, rgb(0.35, 0.4, 0.5))
    y -= 14
  }

  input.sections.filter((section) => section !== cover).forEach((section) => {
    addText(section.title, 15, bold, rgb(0.2, 0.3, 0.62))
    y -= 3
    addText(section.body)
    y -= 14
  })

  const forecast = input.forecast
  if (forecast) {
    if (!input.sections.some(isFinancialSection)) {
      addText('Financial Model', 15, bold, rgb(0.2, 0.3, 0.62))
    }
    addText(`${forecast.years}-year monthly financial forecast`)
    forecast.annual_summaries.forEach((summary, yearIndex) => {
      const landscapeWidth = 842
      const landscapeHeight = 595
      addPage(landscapeWidth, landscapeHeight)
      const tableMargin = 28
      const tableWidth = landscapeWidth - tableMargin * 2
      const labelWidth = 150
      const monthWidth = (tableWidth - labelWidth) / 12
      const headerY = landscapeHeight - tableMargin
      page.drawText(`${summary.label} | Revenue ${currencyValue(summary.total_revenue, forecast.currency)} | Expenses ${currencyValue(summary.total_expenses, forecast.currency)} | Net ${currencyValue(summary.net_cash_flow, forecast.currency)}`, {
        x: tableMargin,
        y: headerY,
        size: 9,
        font: bold,
        color: rgb(0.08, 0.12, 0.22),
      })
      const start = yearIndex * 12
      const months = forecast.months.slice(start, start + 12)
      const rows = forecastRows(forecast)
      let rowY = headerY - 24
      const drawTableCell = (value: string, x: number, width: number, isHeader = false) => {
        page.drawRectangle({ x, y: rowY - 3, width, height: 16, borderColor: rgb(0.84, 0.87, 0.92), borderWidth: 0.5, color: isHeader ? rgb(0.95, 0.96, 0.98) : rgb(1, 1, 1) })
        page.drawText(value.slice(0, isHeader ? 14 : 16), { x: x + 3, y: rowY + 2, size: 6, font: isHeader ? bold : regular, color: rgb(0.2, 0.25, 0.34) })
      }
      drawTableCell('Line item', tableMargin, labelWidth, true)
      months.forEach((month, index) => drawTableCell(month.label, tableMargin + labelWidth + index * monthWidth, monthWidth, true))
      rowY -= 18
      rows.forEach((row) => {
        drawTableCell(row.name, tableMargin, labelWidth)
        row.values.slice(start, start + 12).forEach((value, index) => drawTableCell(String(Math.round(value)), tableMargin + labelWidth + index * monthWidth, monthWidth))
        rowY -= 18
      })
    })
  }

  downloadBytes(await pdf.save(), 'application/pdf', filename)
}

function xmlEscape(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;')
}

function excelColumn(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function excelCell(row: number, column: number, value: string | number) {
  const reference = `${excelColumn(column)}${row}`
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"><v>${value}</v></c>`
  }
  return `<c r="${reference}" t="inlineStr"><is><t>${xmlEscape(String(value))}</t></is></c>`
}

function excelSheetXml(rows: Array<Array<string | number>>) {
  const rowXml = rows
    .map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => excelCell(rowIndex + 1, columnIndex, value)).join('')}</row>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
}

function xlsxRows(input: StrategicReportExportInput) {
  const rows: Array<Array<string | number>> = [
    ['Strategic Report', input.title],
    ['Business', input.businessName],
    ['Program', input.programName],
    [],
    ['Section', 'Agent', 'Content'],
    ...input.sections.map((section) => [section.title, section.agent, section.body]),
  ]

  if (input.forecast) {
    rows.push([], ['Financial forecast', `${input.forecast.years} years`, `${input.forecast.months.length} months`])
  }
  return rows
}

function forecastSheetRows(forecast: FinancialForecast) {
  return [
    ['Line item', ...forecast.months.map((month) => month.label)],
    ...forecastRows(forecast).map((row) => [row.name, ...row.values]),
  ]
}

export async function downloadStrategicReportXlsx(
  input: StrategicReportExportInput,
  filename = `${slugify(input.title)}.xlsx`,
) {
  const { strToU8, zipSync } = await import('fflate')
  const sheets: Record<string, Uint8Array> = {}
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/>${input.forecast ? '<sheet name="Financial Forecast" sheetId="2" r:id="rId2"/>' : ''}</sheets></workbook>`
  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>${input.forecast ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' : ''}</Relationships>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${input.forecast ? '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : ''}</Types>`

  sheets['[Content_Types].xml'] = strToU8(contentTypes)
  sheets['_rels/.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  sheets['xl/workbook.xml'] = strToU8(workbook)
  sheets['xl/_rels/workbook.xml.rels'] = strToU8(relationships)
  sheets['xl/worksheets/sheet1.xml'] = strToU8(excelSheetXml(xlsxRows(input)))
  if (input.forecast) {
    sheets['xl/worksheets/sheet2.xml'] = strToU8(excelSheetXml(forecastSheetRows(input.forecast)))
  }

  const bytes = zipSync(sheets, { level: 6 })
  downloadBytes(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename)
}

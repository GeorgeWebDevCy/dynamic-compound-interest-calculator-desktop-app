import type { TFunction } from 'i18next'
import { utils, write } from 'xlsx'
import type { YearlyBreakdown } from './projection'

type WithdrawalDate = {
  label: string
}

type TableExportMatrix = {
  headers: string[]
  rows: string[][]
}

type TableExportContext = {
  table: YearlyBreakdown[]
  t: TFunction<'translation'>
  formatYear: (value: number) => string
  formatCurrency: (value: number) => string
  getWithdrawalDate?: (year: number) => WithdrawalDate | null
  fileName?: string
}

const DEFAULT_FILE_BASENAME = 'projection'

const sanitizeFileName = (value?: string) => {
  if (!value) {
    return DEFAULT_FILE_BASENAME
  }

  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized.length ? normalized : DEFAULT_FILE_BASENAME
}

const resolveFileName = (baseName: string | undefined, extension: string) =>
  `${sanitizeFileName(baseName)}.${extension}`

const buildTableMatrix = ({
  table,
  t,
  formatYear,
  formatCurrency,
  getWithdrawalDate,
}: TableExportContext): TableExportMatrix => {
  const headers = [
    t('table.headers.year'),
    t('table.headers.endingBalance'),
    t('table.headers.contributions'),
    t('table.headers.growth'),
    t('table.headers.withdrawal'),
  ]

  const rows = table.map((row) => {
    const withdrawalDetail = getWithdrawalDate?.(row.year)
    const formattedWithdrawal = formatCurrency(row.allowedWithdrawal)
    const withdrawalCell = withdrawalDetail
      ? `${formattedWithdrawal} (${t('table.withdrawalDetailLabel')} ${withdrawalDetail.label})`
      : formattedWithdrawal

    return [
      t('table.yearValue', { value: formatYear(row.year) }),
      formatCurrency(row.endingBalance),
      formatCurrency(row.contributions),
      formatCurrency(row.growth),
      withdrawalCell,
    ]
  })

  return { headers, rows }
}

const encodeCsvValue = (value: string) => {
  const needsQuoting = /[",\n]/.test(value)
  if (!needsQuoting) {
    return value
  }

  return `"${value.replace(/"/g, '""')}"`
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const exportProjectionTableAsCsv = (context: TableExportContext) => {
  if (!context.table.length) {
    return
  }

  const { headers, rows } = buildTableMatrix(context)
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => encodeCsvValue(value)).join(','))
    .join('\r\n')
  const blob = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, resolveFileName(context.fileName, 'csv'))
}

export const exportProjectionTableAsXlsx = (context: TableExportContext) => {
  if (!context.table.length) {
    return
  }

  const { headers, rows } = buildTableMatrix(context)
  const worksheet = utils.aoa_to_sheet([headers, ...rows])
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Projection')
  const buffer = write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, resolveFileName(context.fileName, 'xlsx'))
}

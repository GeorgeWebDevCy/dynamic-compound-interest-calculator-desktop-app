const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SLASH_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/

export const normalizeDateValue = (value: string) => {
  if (!value) {
    return ''
  }

  if (value.includes('/') && !SLASH_DATE_PATTERN.test(value)) {
    return ''
  }

  if (ISO_DATE_PATTERN.test(value)) {
    return value
  }

  if (SLASH_DATE_PATTERN.test(value)) {
    const [day, month, year] = value.split('/').map(Number)
    const isoFromSlash = buildIsoFromParts(year, month, day)
    if (isoFromSlash) {
      return isoFromSlash
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return toIsoDateString(parsed)
}

const toIsoDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildIsoFromParts = (year: number, month: number, day: number) => {
  if (!year || !month || !day) {
    return ''
  }

  const parsed = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return ''
  }

  return toIsoDateString(parsed)
}

const parseNormalizedDate = (value: string): Date | null => {
  if (!value || !ISO_DATE_PATTERN.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

const formatDayMonthYear = (value: Date, separator = '/') => {
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()
  return `${day}${separator}${month}${separator}${year}`
}

export const formatDateForInput = (value: string) => {
  const normalized = normalizeDateValue(value)
  const parsed = parseNormalizedDate(normalized)
  if (!parsed) {
    return ''
  }

  return formatDayMonthYear(parsed)
}

export const formatHoldingsDate = (value: string) => {
  const normalized = normalizeDateValue(value)
  const parsed = parseNormalizedDate(normalized)

  if (!parsed) {
    return '—'
  }

  return formatDayMonthYear(parsed)
}

export const isPurchaseDateInFuture = (
  purchaseDate: string,
  referenceDate = new Date(),
) => {
  const purchase = parseNormalizedDate(normalizeDateValue(purchaseDate))
  if (!purchase) {
    return false
  }

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  return purchase.getTime() > today.getTime()
}

export const getWholeMonthsUntilYearEnd = (
  purchaseDate: string,
  referenceDate = new Date(),
) => {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  if (isPurchaseDateInFuture(purchaseDate, referenceDate)) {
    return 0
  }

  const yearEnd = new Date(today.getFullYear(), 11, 31)
  if (yearEnd.getTime() <= today.getTime()) {
    return 0
  }

  let months =
    (yearEnd.getFullYear() - today.getFullYear()) * 12 +
    (yearEnd.getMonth() - today.getMonth())

  if (yearEnd.getDate() < today.getDate()) {
    months -= 1
  }

  return Math.max(months, 0)
}

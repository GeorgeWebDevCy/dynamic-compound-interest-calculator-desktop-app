const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const normalizeDateValue = (value: string) => {
  if (!value) {
    return ''
  }

  if (ISO_DATE_PATTERN.test(value)) {
    return value
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 10)
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

export const formatHoldingsDate = (value: string, locale?: string) => {
  const normalized = normalizeDateValue(value)
  const parsed = parseNormalizedDate(normalized)

  if (!parsed) {
    return '—'
  }

  return parsed.toLocaleDateString(locale ?? undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

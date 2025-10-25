export type CurrencyFormatter = {
  format(value: number | bigint): string
}

const SIGN_PART_TYPES = new Set<Intl.NumberFormatPart['type']>([
  'minusSign',
  'plusSign',
])

const isWhitespace = (value: string) => value.trim() === ''

export const createPrefixedCurrencyFormatter = (
  locales: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions,
): CurrencyFormatter => {
  const formatter = new Intl.NumberFormat(locales, options)

  return {
    format(value) {
      const parts = formatter.formatToParts(value)
      const currencyPart = parts.find((part) => part.type === 'currency')

      if (!currencyPart) {
        return formatter.format(value)
      }

      const leadingSignParts: Intl.NumberFormatPart[] = []
      const remainderParts: Intl.NumberFormatPart[] = []
      let leading = true

      for (const part of parts) {
        if (part.type === 'currency') {
          continue
        }

        if (leading && SIGN_PART_TYPES.has(part.type)) {
          leadingSignParts.push(part)
          continue
        }

        leading = false
        remainderParts.push(part)
      }

      while (
        remainderParts.length > 0 &&
        remainderParts[remainderParts.length - 1].type === 'literal' &&
        isWhitespace(remainderParts[remainderParts.length - 1].value)
      ) {
        remainderParts.pop()
      }

      return (
        leadingSignParts.map((part) => part.value).join('') +
        currencyPart.value +
        remainderParts.map((part) => part.value).join('')
      )
    },
  }
}

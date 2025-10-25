import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import {
  formatHoldingsDate,
  getWholeMonthsUntilYearEnd,
  isPurchaseDateInFuture,
  normalizeDateValue,
} from './lib/dates'
import { buildProjection, getNetAnnualRate } from './lib/projection'
import {
  COMPOUNDING_OPTIONS,
  CONTRIBUTION_OPTIONS,
  DEFAULT_SETTINGS,
  type CompoundSettings,
} from './types/finance'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type NumericSettingKey = {
  [K in keyof CompoundSettings]: CompoundSettings[K] extends number ? K : never
}[keyof CompoundSettings]

type DateSettingKey = {
  [K in keyof CompoundSettings]: CompoundSettings[K] extends string ? K : never
}[keyof CompoundSettings]

const LANGUAGE_OPTIONS = [
  { value: 'en', labelKey: 'language.en' },
  { value: 'el', labelKey: 'language.el' },
] as const

const resolveLanguageCode = (language?: string) => {
  if (!language) {
    return 'en'
  }

  return language.split('-')[0]
}

const resolveLocale = (language: string) => (language === 'el' ? 'el-GR' : 'en-US')

function App() {
  const { t, i18n } = useTranslation()
  const languageCode = resolveLanguageCode(i18n.resolvedLanguage ?? i18n.language)
  const locale = resolveLocale(languageCode)
  const [settings, setSettings] = useState<CompoundSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  )

  const detailedEuroFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  const usdCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [locale],
  )

  const compactCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 1,
        notation: 'compact',
      }),
    [locale],
  )

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  const decimalFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
      }),
    [locale],
  )

  useEffect(() => {
    if (!window.configAPI) {
      setLoading(false)
      return
    }

    window.configAPI
      .load()
      .then((stored) => {
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored })
        }
      })
      .catch((error) => console.warn('Unable to load saved settings', error))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || !window.configAPI) {
      return
    }

    setSaveState('saving')
    const debounce = window.setTimeout(() => {
      window.configAPI
        ?.save(settings)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 350)

    return () => window.clearTimeout(debounce)
  }, [settings, loading])

  const remainingContributionMonths = useMemo(
    () => getWholeMonthsUntilYearEnd(settings.vuaaPurchaseDate),
    [settings.vuaaPurchaseDate],
  )

  const purchaseDateInFuture = useMemo(
    () => isPurchaseDateInFuture(settings.vuaaPurchaseDate),
    [settings.vuaaPurchaseDate],
  )

  const projection = useMemo(
    () => buildProjection(settings, { remainingContributionMonths }),
    [settings, remainingContributionMonths],
  )
  const expenseDrag = settings.fundExpenseRatio + settings.platformFee
  const netAnnualRate = useMemo(
    () => getNetAnnualRate(settings.annualReturn, expenseDrag),
    [settings.annualReturn, expenseDrag],
  )
  const currentYear = new Date().getFullYear()

  const updateField = <K extends keyof CompoundSettings>(
    field: K,
    value: CompoundSettings[K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleNumericInputChange =
    (field: NumericSettingKey) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const nextValue = Number(event.target.value)
      const sanitizedValue = Number.isNaN(nextValue) ? 0 : nextValue
      updateField(field, sanitizedValue as CompoundSettings[NumericSettingKey])
    }

  const handleDateChange =
    (field: DateSettingKey) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      const normalized = normalizeDateValue(value)
      updateField(field, normalized as CompoundSettings[DateSettingKey])
    }

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value)
  }

  const resetDefaults = () => {
    setSettings({ ...DEFAULT_SETTINGS })
  }

  const renderTable = () =>
    projection.table.map((row) => (
      <tr key={row.year}>
        <td>{t('table.yearValue', { value: decimalFormatter.format(row.year) })}</td>
        <td>{currencyFormatter.format(row.endingBalance)}</td>
        <td>{currencyFormatter.format(row.contributions)}</td>
        <td>{currencyFormatter.format(row.growth)}</td>
      </tr>
    ))

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">{t('header.eyebrow')}</p>
          <h1>{t('header.title')}</h1>
          <p className="subtitle">{t('header.subtitle')}</p>
        </div>
        <div className="header-actions">
          <select
            aria-label={t('language.label')}
            value={languageCode}
            onChange={handleLanguageChange}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <StatusBadge state={loading ? 'saving' : saveState} />
          <button className="ghost" type="button" onClick={resetDefaults}>
            {t('header.reset')}
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('inputs.title')}</h2>
            <span className="panel-meta">{t('inputs.description')}</span>
          </div>

          <div className="input-grid">
            <label>
              <span>{t('inputs.principal')}</span>
              <input
                type="number"
                min={0}
                step={100}
                value={settings.principal}
                onChange={handleNumericInputChange('principal')}
              />
            </label>

            <label>
              <span>{t('inputs.contribution')}</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.contribution}
                onChange={handleNumericInputChange('contribution')}
              />
            </label>

            <label>
              <span>{t('inputs.contributionCadence')}</span>
              <select
                value={settings.contributionFrequency}
                onChange={handleNumericInputChange('contributionFrequency')}
              >
                {CONTRIBUTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t('inputs.compoundingFrequency')}</span>
              <select
                value={settings.compoundingFrequency}
                onChange={handleNumericInputChange('compoundingFrequency')}
              >
                {COMPOUNDING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t('inputs.annualReturn')}</span>
              <input
                type="number"
                min={0}
                max={40}
                step={0.1}
                value={settings.annualReturn}
                onChange={handleNumericInputChange('annualReturn')}
              />
            </label>

            <label>
              <span>{t('inputs.duration')}</span>
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={settings.years}
                onChange={handleNumericInputChange('years')}
              />
            </label>

            <label>
              <span>{t('inputs.expenseRatio')}</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={settings.fundExpenseRatio}
                onChange={handleNumericInputChange('fundExpenseRatio')}
              />
            </label>

            <label>
              <span>{t('inputs.platformFee')}</span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={settings.platformFee}
                onChange={handleNumericInputChange('platformFee')}
              />
            </label>

            <label>
              <span>{t('inputs.euroBalance')}</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.freedom24EuroBalance}
                onChange={handleNumericInputChange('freedom24EuroBalance')}
              />
            </label>

            <label>
              <span>{t('inputs.usdBalance')}</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.freedom24UsdBalance}
                onChange={handleNumericInputChange('freedom24UsdBalance')}
              />
            </label>

            <label>
              <span>{t('inputs.shareCount')}</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={settings.vuaaShareCount}
                onChange={handleNumericInputChange('vuaaShareCount')}
              />
            </label>

            <label>
              <span>{t('inputs.purchasePrice')}</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={settings.vuaaPurchasePrice}
                onChange={handleNumericInputChange('vuaaPurchasePrice')}
              />
            </label>

            <label>
              <span>{t('inputs.purchaseDate.label')}</span>
              <input
                type="date"
                value={normalizeDateValue(settings.vuaaPurchaseDate)}
                onChange={handleDateChange('vuaaPurchaseDate')}
              />
              <span className="input-hint">
                {purchaseDateInFuture
                  ? t('inputs.purchaseDate.hint.future')
                  : remainingContributionMonths === 0
                    ? t('inputs.purchaseDate.hint.none', { year: currentYear })
                    : t('inputs.purchaseDate.hint.remaining', {
                        count: remainingContributionMonths,
                        year: currentYear,
                      })}
              </span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('projection.title')}</h2>
            <span className="panel-meta">
              {t('projection.netReturn', {
                value: percentFormatter.format(netAnnualRate),
              })}
            </span>
          </div>

          <div className="projection-summary">
            <div>
              <p className="eyebrow">{t('projection.projectedBalance.eyebrow')}</p>
              <h3>{currencyFormatter.format(projection.totals.endingBalance)}</h3>
              <p className="muted">
                {t('projection.projectedBalance.summary', {
                  years: settings.years,
                  grossReturn: percentFormatter.format(settings.annualReturn / 100),
                  expenseDrag: percentFormatter.format(expenseDrag / 100),
                })}
              </p>
            </div>
            <div className="stat-grid">
              <StatCard
                label={t('projection.statCards.totalContributions')}
                value={currencyFormatter.format(projection.totals.contributions)}
              />
              <StatCard
                label={t('projection.statCards.growth')}
                value={currencyFormatter.format(projection.totals.growth)}
              />
              <StatCard
                label={t('projection.statCards.expenseDrag')}
                value={t('projection.statCards.expenseDragValue', {
                  value: percentFormatter.format(expenseDrag / 100),
                })}
              />
              <StatCard
                label={t('projection.statCards.contributionCadence')}
                value={t('projection.statCards.contributionCadenceValue', {
                  value: decimalFormatter.format(settings.contributionFrequency),
                })}
              />
            </div>
            <div className="holdings-card">
              <h4>{t('projection.holdings.title')}</h4>
              <dl>
                <div>
                  <dt>{t('projection.holdings.euroBalance')}</dt>
                  <dd>{currencyFormatter.format(settings.freedom24EuroBalance)}</dd>
                </div>
                <div>
                  <dt>{t('projection.holdings.usdBalance')}</dt>
                  <dd>{usdCurrencyFormatter.format(settings.freedom24UsdBalance)}</dd>
                </div>
                <div>
                  <dt>{t('projection.holdings.shareCount')}</dt>
                  <dd>
                    {settings.vuaaShareCount.toLocaleString(locale, {
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div>
                  <dt>{t('projection.holdings.purchasePrice')}</dt>
                  <dd>{detailedEuroFormatter.format(settings.vuaaPurchasePrice)}</dd>
                </div>
                <div>
                  <dt>{t('projection.holdings.purchaseDate')}</dt>
                  <dd>{formatHoldingsDate(settings.vuaaPurchaseDate, locale)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={projection.chartPoints}>
                <defs>
                  <linearGradient id="line" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  stroke="#9ca3af"
                  tickFormatter={(value) => t('chart.year', { value: decimalFormatter.format(value) })}
                />
                <YAxis
                  stroke="#9ca3af"
                  tickFormatter={(value) => compactCurrencyFormatter.format(value)}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatBalance={currencyFormatter.format}
                      formatYear={decimalFormatter.format}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="url(#line)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>{t('table.title')}</h2>
          <span className="panel-meta">{t('table.description')}</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('table.headers.year')}</th>
                <th>{t('table.headers.endingBalance')}</th>
                <th>{t('table.headers.contributions')}</th>
                <th>{t('table.headers.growth')}</th>
              </tr>
            </thead>
            <tbody>{renderTable()}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="stat-card">
    <span className="muted">{label}</span>
    <strong>{value}</strong>
  </div>
)

type StatusLabelKey = 'ready' | 'saving' | 'saved' | 'error'

const StatusBadge = ({ state }: { state: SaveState }) => {
  const { t } = useTranslation()
  let className = 'status ready'
  let labelKey: StatusLabelKey = 'ready'

  if (state === 'saving') {
    className = 'status saving'
    labelKey = 'saving'
  } else if (state === 'saved') {
    className = 'status saved'
    labelKey = 'saved'
  } else if (state === 'error') {
    className = 'status error'
    labelKey = 'error'
  }

  return <span className={className}>{t(`status.${labelKey}`)}</span>
}

const ChartTooltip = ({
  active,
  payload,
  formatBalance,
  formatYear,
}: TooltipProps<number, string> & {
  formatBalance: (value: number) => string
  formatYear: (value: number) => string
}) => {
  const { t } = useTranslation()

  if (!active || !payload || payload.length === 0) {
    return null
  }

  const point = payload[0].payload as { year: number; balance: number }

  return (
    <div className="tooltip-card">
      <span>{t('chart.year', { value: formatYear(point.year) })}</span>
      <strong>{formatBalance(point.balance)}</strong>
    </div>
  )
}

export default App

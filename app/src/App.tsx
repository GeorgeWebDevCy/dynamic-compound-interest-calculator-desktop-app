import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import {
  formatDateForInput,
  formatHoldingsDate,
  getWholeMonthsUntilYearEnd,
  isPurchaseDateInFuture,
  normalizeDateValue,
} from './lib/dates'
import { createPrefixedCurrencyFormatter } from './lib/currency'
import { exportProjectionTableAsCsv, exportProjectionTableAsXlsx } from './lib/export'
import { buildProjection, getNetAnnualRate } from './lib/projection'
import {
  COMPOUNDING_OPTIONS,
  CONTRIBUTION_OPTIONS,
  DEFAULT_SETTINGS,
  type CompoundSettings,
  type Scenario,
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

const resolveLocale = (language: string) => (language === 'el' ? 'el-GR' : 'en-GB')

const DEFAULT_SCENARIO_LIST: Scenario[] = DEFAULT_SETTINGS.map((scenario) => ({
  ...scenario,
  settings: { ...scenario.settings },
}))

const FALLBACK_COLOR = DEFAULT_SCENARIO_LIST[0]?.color ?? '#10b981'
const FALLBACK_SETTINGS: CompoundSettings =
  DEFAULT_SCENARIO_LIST[0]?.settings ?? {
    principal: 0,
    contribution: 0,
    contributionFrequency: 12,
    annualReturn: 0,
    compoundingFrequency: 12,
    years: 1,
    fundExpenseRatio: 0,
    platformFee: 0,
    vuaaShareCount: 0,
    vuaaPurchasePrice: 0,
    vuaaPurchaseDate: '',
  }

const COLOR_PALETTE = [
  '#10b981',
  '#6366f1',
  '#f97316',
  '#f43f5e',
  '#14b8a6',
  '#8b5cf6',
  '#facc15',
  '#0ea5e9',
]

const cloneScenario = (scenario: Scenario): Scenario => ({
  ...scenario,
  settings: { ...scenario.settings },
})

const getDefaultScenarios = () => DEFAULT_SCENARIO_LIST.map((scenario) => cloneScenario(scenario))

const createScenarioId = () => {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return (globalThis.crypto as Crypto).randomUUID()
  }

  return `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getNextColor = (usedColors: Set<string>) => {
  for (const color of COLOR_PALETTE) {
    if (!usedColors.has(color)) {
      usedColors.add(color)
      return color
    }
  }

  const hue = Math.round(((usedColors.size + 1) * 137.508) % 360)
  const generated = `hsl(${hue} 70% 50%)`
  usedColors.add(generated)
  return generated
}

const ensureScenarios = (scenarios: Scenario[]) =>
  scenarios.length ? scenarios.map((scenario) => cloneScenario(scenario)) : getDefaultScenarios()

const INITIAL_SCENARIOS = getDefaultScenarios()

function App() {
  const { t, i18n } = useTranslation()
  const languageCode = resolveLanguageCode(i18n.resolvedLanguage ?? i18n.language)
  const locale = resolveLocale(languageCode)
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    INITIAL_SCENARIOS.map((scenario) => cloneScenario(scenario)),
  )
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    INITIAL_SCENARIOS[0]?.id ?? '',
  )
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [purchaseDateInput, setPurchaseDateInput] = useState(
    () => formatDateForInput(INITIAL_SCENARIOS[0]?.settings.vuaaPurchaseDate ?? '') || '',
  )
  const [isEditingPurchaseDate, setIsEditingPurchaseDate] = useState(false)
  const [formulasOpen, setFormulasOpen] = useState(false)
  const formulaPanelId = 'formulas-panel-body'
  const activeScenario = useMemo(
    () =>
      scenarios.find((scenario) => scenario.id === activeScenarioId) ??
      scenarios[0] ??
      null,
    [scenarios, activeScenarioId],
  )
  const activeSettings = activeScenario?.settings ?? FALLBACK_SETTINGS

  const currencyFormatter = useMemo(
    () =>
      createPrefixedCurrencyFormatter(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  )

  const detailedEuroFormatter = useMemo(
    () =>
      createPrefixedCurrencyFormatter(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  const compactCurrencyFormatter = useMemo(
    () =>
      createPrefixedCurrencyFormatter(locale, {
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

  const factorFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.setAttribute('lang', locale)
  }, [locale])

  useEffect(() => {
    if (!window.configAPI) {
      setScenarios((prev) => (prev.length ? prev : getDefaultScenarios()))
      setLoading(false)
      return
    }

    window.configAPI
      .load()
      .then((stored) => {
        const incoming = ensureScenarios(stored?.scenarios ?? [])
        setScenarios(incoming)
        setActiveScenarioId((current) => {
          if (current && incoming.some((scenario) => scenario.id === current)) {
            return current
          }

          return incoming[0]?.id ?? current
        })
      })
      .catch((error) => console.warn('Unable to load saved settings', error))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!scenarios.length) {
      const defaults = getDefaultScenarios()
      setScenarios(defaults)
      setActiveScenarioId(defaults[0]?.id ?? '')
      return
    }

    if (!activeScenarioId || !scenarios.some((scenario) => scenario.id === activeScenarioId)) {
      setActiveScenarioId(scenarios[0]?.id ?? activeScenarioId)
    }
  }, [scenarios, activeScenarioId])

  useEffect(() => {
    if (loading || !window.configAPI) {
      return
    }

    setSaveState('saving')
    const debounce = window.setTimeout(() => {
      window.configAPI
        ?.save({ scenarios })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 350)

    return () => window.clearTimeout(debounce)
  }, [scenarios, loading])

  useEffect(() => {
    if (isEditingPurchaseDate) {
      return
    }

    setPurchaseDateInput(formatDateForInput(activeSettings.vuaaPurchaseDate) || '')
  }, [activeSettings.vuaaPurchaseDate, isEditingPurchaseDate])

  const scenarioAnalyses = useMemo(
    () =>
      scenarios.map((scenario) => {
        const months = getWholeMonthsUntilYearEnd(scenario.settings.vuaaPurchaseDate)
        return {
          scenario,
          remainingContributionMonths: months,
          projection: buildProjection(scenario.settings, { remainingContributionMonths: months }),
        }
      }),
    [scenarios],
  )

  const activeAnalysis =
    scenarioAnalyses.find((analysis) => analysis.scenario.id === activeScenario?.id) ??
    scenarioAnalyses[0] ??
    null

  const remainingContributionMonths =
    activeAnalysis?.remainingContributionMonths ??
    getWholeMonthsUntilYearEnd(activeSettings.vuaaPurchaseDate)

  const activeProjection =
    activeAnalysis?.projection ??
    buildProjection(activeSettings, { remainingContributionMonths })

  const purchaseDateInFuture = useMemo(
    () => isPurchaseDateInFuture(activeSettings.vuaaPurchaseDate),
    [activeSettings.vuaaPurchaseDate],
  )

  const expenseDrag = activeSettings.fundExpenseRatio + activeSettings.platformFee
  const netAnnualRate = useMemo(
    () => getNetAnnualRate(activeSettings.annualReturn, expenseDrag),
    [activeSettings.annualReturn, expenseDrag],
  )
  const currentYear = new Date().getFullYear()
  const withdrawalTooltipLimit = Math.max(Math.ceil(activeSettings.years), 1)

  const compoundingPeriods = Math.max(activeSettings.compoundingFrequency, 1)
  const grossReturnRate = activeSettings.annualReturn / 100
  const expenseRate = expenseDrag / 100
  const growthFactor = Math.max(1 + netAnnualRate, 0.0001)
  const periodicRate = Math.pow(growthFactor, 1 / compoundingPeriods) - 1
  const contributionPerPeriod =
    activeSettings.contribution *
    (activeSettings.contributionFrequency / compoundingPeriods)
  const normalizedContributionMonths = Math.min(
    Math.max(remainingContributionMonths, 0),
    12,
  )
  const firstYearContributionFactor = normalizedContributionMonths / 12
  const firstYearContributionPerPeriod =
    contributionPerPeriod * firstYearContributionFactor

  const chartData = useMemo(() => {
    const yearMap = new Map<number, Record<string, number | null>>()

    scenarioAnalyses.forEach(({ scenario, projection }) => {
      projection.chartPoints.forEach((point) => {
        const existing = yearMap.get(point.year) ?? {}
        existing[scenario.id] = point.balance
        yearMap.set(point.year, existing)
      })
    })

    return Array.from(yearMap.entries())
      .map(([year, entry]) => ({ year, ...entry }))
      .sort((a, b) => a.year - b.year)
  }, [scenarioAnalyses])

  const updateActiveScenarioField = <K extends keyof CompoundSettings>(
    field: K,
    value: CompoundSettings[K],
  ) => {
    if (!activeScenarioId) {
      return
    }

    setScenarios((prev) =>
      prev.map((scenario) =>
        scenario.id === activeScenarioId
          ? { ...scenario, settings: { ...scenario.settings, [field]: value } }
          : scenario,
      ),
    )
  }

  const handleNumericInputChange =
    (field: NumericSettingKey) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const nextValue = Number(event.target.value)
      const sanitizedValue = Number.isNaN(nextValue) ? 0 : nextValue
      updateActiveScenarioField(field, sanitizedValue as CompoundSettings[NumericSettingKey])
    }

  const handlePurchaseDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    setPurchaseDateInput(rawValue)

    if (!activeScenarioId) {
      return
    }

    if (rawValue.trim() === '') {
      updateActiveScenarioField('vuaaPurchaseDate', '' as CompoundSettings[DateSettingKey])
      return
    }

    const normalized = normalizeDateValue(rawValue)
    if (normalized) {
      updateActiveScenarioField('vuaaPurchaseDate', normalized as CompoundSettings[DateSettingKey])
    }
  }

  const handlePurchaseDateBlur = () => {
    setIsEditingPurchaseDate(false)

    if (!activeScenarioId) {
      return
    }

    if (purchaseDateInput.trim() === '') {
      updateActiveScenarioField('vuaaPurchaseDate', '' as CompoundSettings[DateSettingKey])
      return
    }

    const normalized = normalizeDateValue(purchaseDateInput)
    if (normalized) {
      updateActiveScenarioField('vuaaPurchaseDate', normalized as CompoundSettings[DateSettingKey])
      setPurchaseDateInput(formatDateForInput(normalized) || '')
    } else if (activeScenario) {
      setPurchaseDateInput(formatDateForInput(activeScenario.settings.vuaaPurchaseDate) || '')
    } else {
      setPurchaseDateInput('')
    }
  }

  const handlePurchaseDateFocus = () => setIsEditingPurchaseDate(true)

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value)
  }

  const handleScenarioSwitch = (event: ChangeEvent<HTMLSelectElement>) => {
    setIsEditingPurchaseDate(false)
    setActiveScenarioId(event.target.value)
  }

  const handleScenarioNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value
    if (!activeScenarioId) {
      return
    }

    setScenarios((prev) =>
      prev.map((scenario) =>
        scenario.id === activeScenarioId ? { ...scenario, name: nextName } : scenario,
      ),
    )
  }

  const handleAddScenario = () => {
    setScenarios((prev) => {
      const usedColors = new Set(prev.map((scenario) => scenario.color))
      const nextColor = getNextColor(usedColors)
      const nextScenario: Scenario = {
        id: createScenarioId(),
        name: t('scenarios.defaultName', { index: prev.length + 1 }),
        color: nextColor,
        settings: { ...FALLBACK_SETTINGS },
      }
      setActiveScenarioId(nextScenario.id)
      setIsEditingPurchaseDate(false)
      return [...prev, nextScenario]
    })
  }

  const handleDuplicateScenario = () => {
    if (!activeScenario) {
      return
    }

    setScenarios((prev) => {
      const usedColors = new Set(prev.map((scenario) => scenario.color))
      const nextColor = getNextColor(usedColors)
      const duplicate: Scenario = {
        id: createScenarioId(),
        name: t('scenarios.copyName', { name: activeScenario.name }),
        color: nextColor,
        settings: { ...activeScenario.settings },
      }
      setActiveScenarioId(duplicate.id)
      setIsEditingPurchaseDate(false)
      return [...prev, duplicate]
    })
  }

  const handleDeleteScenario = () => {
    setScenarios((prev) => {
      if (prev.length <= 1) {
        return prev
      }

      const filtered = prev.filter((scenario) => scenario.id !== activeScenarioId)
      if (!filtered.length) {
        return prev
      }

      setActiveScenarioId(filtered[0].id)
      setIsEditingPurchaseDate(false)
      return filtered
    })
  }

  const resetDefaults = () => {
    const defaults = getDefaultScenarios()
    setScenarios(defaults)
    const nextActive = defaults[0]
    setActiveScenarioId(nextActive?.id ?? '')
    setIsEditingPurchaseDate(false)
    setPurchaseDateInput(formatDateForInput(nextActive?.settings.vuaaPurchaseDate ?? '') || '')
  }

  const getWithdrawalDate = (yearValue: number) => {
    const payoutYear = Math.max(currentYear - 1 + Math.ceil(yearValue), currentYear)
    const iso = `${payoutYear}-12-31`
    return {
      iso,
      label: formatDateForInput(iso) || `31/12/${payoutYear}`,
    }
  }

  const withdrawalScheduleSummary = useMemo(() => {
    if (!activeProjection.table.length) {
      return ''
    }

    const limit = Math.min(withdrawalTooltipLimit, activeProjection.table.length)
    const entries = activeProjection.table.slice(0, limit).map((row) => {
      const withdrawalDate = getWithdrawalDate(row.year)
      return t('table.withdrawalScheduleTooltip', {
        year: decimalFormatter.format(row.year),
        amount: currencyFormatter.format(row.allowedWithdrawal),
        date: withdrawalDate.label,
      })
    })

    if (activeProjection.table.length > limit) {
      entries.push(
        t('table.withdrawalScheduleMore', {
          count: activeProjection.table.length - limit,
        }),
      )
    }

    return entries.join('\n')
  }, [
    activeProjection.table,
    t,
    decimalFormatter,
    currencyFormatter,
    withdrawalTooltipLimit,
  ])

  const withdrawalScheduleAriaLabel = withdrawalScheduleSummary
    ? `${t('table.withdrawalScheduleLabel')}: ${withdrawalScheduleSummary.replace(/\n/g, ', ')}`
    : undefined

  const hasTableRows = activeProjection.table.length > 0

  const buildExportContext = () => ({
    table: activeProjection.table,
    t,
    formatYear: (value: number) => decimalFormatter.format(value),
    formatCurrency: (value: number) => currencyFormatter.format(value),
    getWithdrawalDate,
    fileName: activeScenario?.name ?? t('table.title'),
  })

  const handleExportCsv = () => {
    if (!hasTableRows) {
      return
    }

    exportProjectionTableAsCsv(buildExportContext())
  }

  const handleExportXlsx = () => {
    if (!hasTableRows) {
      return
    }

    exportProjectionTableAsXlsx(buildExportContext())
  }

  const renderTable = () =>
    activeProjection.table.map((row) => {
      const withdrawalDate = getWithdrawalDate(row.year)
      return (
        <tr key={row.year}>
          <td>{t('table.yearValue', { value: decimalFormatter.format(row.year) })}</td>
          <td>{currencyFormatter.format(row.endingBalance)}</td>
        <td>{currencyFormatter.format(row.contributions)}</td>
        <td>{currencyFormatter.format(row.growth)}</td>
        <td>
          <div className="withdrawal-cell">
            <strong>{currencyFormatter.format(row.allowedWithdrawal)}</strong>
            <span className="muted withdrawal-detail">
              {t('table.withdrawalDetailLabel')}{' '}
              <time dateTime={withdrawalDate.iso}>{withdrawalDate.label}</time>
            </span>
          </div>
        </td>
      </tr>
      )
    })

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
            className="language-select"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                aria-label={t(option.labelKey)}
                title={t(option.labelKey)}
              >
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

          <div className="scenario-controls">
            <div className="scenario-header">
              <label className="scenario-label">
                <span>{t('scenarios.activeLabel')}</span>
                <div className="scenario-select-wrapper">
                  <span
                    className="scenario-color-dot"
                    aria-hidden="true"
                    style={{ backgroundColor: activeScenario?.color ?? FALLBACK_COLOR }}
                  />
                  <select
                    value={activeScenario?.id ?? ''}
                    onChange={handleScenarioSwitch}
                    className="scenario-select"
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <div className="scenario-actions">
                <button
                  type="button"
                  className="scenario-button"
                  onClick={handleAddScenario}
                >
                  {t('scenarios.add')}
                </button>
                <button
                  type="button"
                  className="scenario-button"
                  onClick={handleDuplicateScenario}
                  disabled={!activeScenario}
                >
                  {t('scenarios.duplicate')}
                </button>
                <button
                  type="button"
                  className="scenario-button"
                  onClick={handleDeleteScenario}
                  disabled={scenarios.length <= 1}
                >
                  {t('scenarios.delete')}
                </button>
              </div>
            </div>
            <label className="scenario-label">
              <span>{t('scenarios.nameLabel')}</span>
              <input
                type="text"
                className="scenario-name-input"
                value={activeScenario?.name ?? ''}
                onChange={handleScenarioNameChange}
              />
            </label>
          </div>

          <div className="input-grid">
            <label>
              <span>{t('inputs.principal')}</span>
              <input
                type="number"
                min={0}
                step={100}
                value={activeSettings.principal}
                onChange={handleNumericInputChange('principal')}
              />
            </label>

            <label>
              <span>{t('inputs.contribution')}</span>
              <input
                type="number"
                min={0}
                step={50}
                value={activeSettings.contribution}
                onChange={handleNumericInputChange('contribution')}
              />
            </label>

            <label>
              <span>{t('inputs.contributionCadence')}</span>
              <select
                value={activeSettings.contributionFrequency}
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
                value={activeSettings.compoundingFrequency}
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
                value={activeSettings.annualReturn}
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
                value={activeSettings.years}
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
                value={activeSettings.fundExpenseRatio}
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
                value={activeSettings.platformFee}
                onChange={handleNumericInputChange('platformFee')}
              />
            </label>

            <label>
              <span>{t('inputs.shareCount')}</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={activeSettings.vuaaShareCount}
                onChange={handleNumericInputChange('vuaaShareCount')}
              />
            </label>

            <label>
              <span>{t('inputs.purchasePrice')}</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={activeSettings.vuaaPurchasePrice}
                onChange={handleNumericInputChange('vuaaPurchasePrice')}
              />
            </label>

            <label>
              <span>{t('inputs.purchaseDate.label')}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d{2}/\\d{2}/\\d{4}"
                placeholder="dd/mm/yyyy"
                value={purchaseDateInput}
                onChange={handlePurchaseDateChange}
                onBlur={handlePurchaseDateBlur}
                onFocus={handlePurchaseDateFocus}
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
              <h3>{currencyFormatter.format(activeProjection.totals.endingBalance)}</h3>
              <p className="muted">
                {t('projection.projectedBalance.summary', {
                  years: activeSettings.years,
                  grossReturn: percentFormatter.format(activeSettings.annualReturn / 100),
                  expenseDrag: percentFormatter.format(expenseDrag / 100),
                })}
              </p>
            </div>
            <div className="stat-grid">
              <StatCard
                label={t('projection.statCards.totalContributions')}
                value={currencyFormatter.format(activeProjection.totals.contributions)}
              />
              <StatCard
                label={t('projection.statCards.growth')}
                value={currencyFormatter.format(activeProjection.totals.growth)}
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
                  value: decimalFormatter.format(activeSettings.contributionFrequency),
                })}
              />
            </div>
            <div className="holdings-card">
              <h4>{t('projection.holdings.title')}</h4>
              <dl>
                <div>
                  <dt>{t('projection.holdings.shareCount')}</dt>
                  <dd>
                    {activeSettings.vuaaShareCount.toLocaleString(locale, {
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div>
                  <dt>{t('projection.holdings.purchasePrice')}</dt>
                  <dd>{detailedEuroFormatter.format(activeSettings.vuaaPurchasePrice)}</dd>
                </div>
                <div>
                  <dt>{t('projection.holdings.purchaseDate')}</dt>
                  <dd>{formatHoldingsDate(activeSettings.vuaaPurchaseDate)}</dd>
                </div>
              </dl>
            </div>
          </div>

        </section>

        <section className="panel chart-panel">
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
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
                <Legend wrapperStyle={{ color: '#f5f6f9' }} iconType="circle" />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatBalance={currencyFormatter.format}
                      formatYear={decimalFormatter.format}
                    />
                  }
                />
                {scenarioAnalyses.map(({ scenario }) => (
                  <Line
                    key={scenario.id}
                    type="monotone"
                    dataKey={scenario.id}
                    name={scenario.name}
                    stroke={scenario.color}
                    strokeWidth={scenario.id === activeScenarioId ? 3 : 2}
                    dot={false}
                    connectNulls
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      <section className="panel table-panel">
        <div className="panel-head">
          <div className="panel-title">
            <h2>{t('table.title')}</h2>
            <span className="panel-meta">{t('table.description')}</span>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className="scenario-button"
              onClick={handleExportCsv}
              disabled={!hasTableRows}
            >
              {t('table.actions.exportCsv')}
            </button>
            <button
              type="button"
              className="scenario-button"
              onClick={handleExportXlsx}
              disabled={!hasTableRows}
            >
              {t('table.actions.exportXlsx')}
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('table.headers.year')}</th>
                <th>{t('table.headers.endingBalance')}</th>
                <th>{t('table.headers.contributions')}</th>
                <th>{t('table.headers.growth')}</th>
                <th className="withdrawal-header">
                  <span>
                    {t('table.headers.withdrawal')}
                    {withdrawalScheduleSummary && (
                      <button
                        type="button"
                        className="info-badge"
                        title={withdrawalScheduleSummary}
                        aria-label={withdrawalScheduleAriaLabel}
                      >
                        i
                      </button>
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>{renderTable()}</tbody>
          </table>
        </div>
      </section>

      <section className={`panel collapsible-panel ${formulasOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="collapsible-trigger"
          aria-expanded={formulasOpen}
          aria-controls={formulaPanelId}
          onClick={() => setFormulasOpen((open) => !open)}
        >
          <div>
            <h2>{t('projection.formulas.title')}</h2>
            <span className="panel-meta">{t('projection.formulas.description')}</span>
          </div>
          <span className="chevron" aria-hidden="true" />
        </button>

        <div className="collapsible-body" id={formulaPanelId} hidden={!formulasOpen}>
          <div className="formula-grid">
            <FormulaBlock
              title={t('projection.formulas.netRate.title')}
              equation={t('projection.formulas.netRate.equation')}
              result={t('projection.formulas.netRate.result', {
                value: percentFormatter.format(netAnnualRate),
              })}
              items={[
                {
                  label: t('projection.formulas.labels.grossReturn'),
                  value: percentFormatter.format(grossReturnRate),
                },
                {
                  label: t('projection.formulas.labels.expenseDrag'),
                  value: percentFormatter.format(expenseRate),
                },
              ]}
            />
            <FormulaBlock
              title={t('projection.formulas.periodicRate.title')}
              equation={t('projection.formulas.periodicRate.equation')}
              result={t('projection.formulas.periodicRate.result', {
                value: percentFormatter.format(periodicRate),
              })}
              items={[
                {
                  label: t('projection.formulas.labels.netReturn'),
                  value: percentFormatter.format(netAnnualRate),
                },
                {
                  label: t('projection.formulas.labels.compounding'),
                  value: t('projection.formulas.periodicRate.compoundingValue', {
                    value: decimalFormatter.format(compoundingPeriods),
                  }),
                },
              ]}
            />
              <FormulaBlock
                title={t('projection.formulas.contribution.title')}
                equation={t('projection.formulas.contribution.equation')}
                result={t('projection.formulas.contribution.result', {
                  value: detailedEuroFormatter.format(contributionPerPeriod),
                })}
                items={[
                  {
                    label: t('projection.formulas.labels.contribution'),
                    value: detailedEuroFormatter.format(activeSettings.contribution),
                  },
                  {
                    label: t('projection.formulas.labels.contributionFrequency'),
                    value: t('projection.formulas.contribution.frequencyValue', {
                      value: decimalFormatter.format(activeSettings.contributionFrequency),
                    }),
                  },
                  {
                    label: t('projection.formulas.labels.compounding'),
                  value: t('projection.formulas.periodicRate.compoundingValue', {
                    value: decimalFormatter.format(compoundingPeriods),
                  }),
                },
              ]}
            />
            <FormulaBlock
              title={t('projection.formulas.firstYear.title')}
              equation={t('projection.formulas.firstYear.equation')}
              result={t('projection.formulas.firstYear.result', {
                value: detailedEuroFormatter.format(firstYearContributionPerPeriod),
                factor: factorFormatter.format(firstYearContributionFactor),
              })}
              items={[
                {
                    label: t('projection.formulas.labels.monthsRemaining'),
                    value: decimalFormatter.format(normalizedContributionMonths),
                  },
                  {
                    label: t('projection.formulas.labels.firstYearFactor'),
                    value: factorFormatter.format(firstYearContributionFactor),
                  },
                  {
                    label: t('projection.formulas.labels.firstYearContribution'),
                    value: detailedEuroFormatter.format(firstYearContributionPerPeriod),
                  },
                ]}
              />
          </div>
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

type FormulaItem = {
  label: string
  value: string
}

const FormulaBlock = ({
  title,
  equation,
  result,
  items,
}: {
  title: string
  equation: string
  result: string
  items: FormulaItem[]
}) => (
  <div className="formula-block">
    <span className="muted formula-block-title">{title}</span>
    <code className="formula-equation">{equation}</code>
    <strong className="formula-result">{result}</strong>
    <div className="formula-values">
      {items.map((item) => (
        <div key={item.label} className="formula-value">
          <span className="formula-value-label">{item.label}</span>
          <span className="formula-value-output">{item.value}</span>
        </div>
      ))}
    </div>
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
  label,
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

  const filtered = payload.filter(
    (entry) => typeof entry.value === 'number' && !Number.isNaN(entry.value),
  )

  if (filtered.length === 0) {
    return null
  }

  const firstPayload = payload[0]?.payload as { year?: number } | undefined
  const fallbackPayload = filtered[0]?.payload as { year?: number } | undefined
  const resolvedYear =
    typeof label === 'number'
      ? label
      : typeof firstPayload?.year === 'number'
        ? firstPayload.year
        : typeof fallbackPayload?.year === 'number'
          ? fallbackPayload.year
          : 0

  return (
    <div className="tooltip-card">
      <span>{t('chart.year', { value: formatYear(resolvedYear) })}</span>
      <ul className="tooltip-series">
        {filtered.map((entry) => (
          <li key={entry.dataKey as string} className="tooltip-series-item">
            <span
              className="tooltip-color"
              style={{ backgroundColor: entry.color ?? FALLBACK_COLOR }}
            />
            <span className="tooltip-name">{entry.name}</span>
            <span className="tooltip-value">{formatBalance(entry.value as number)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
